import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { executeWithGeminiKeyRotation, getAllGeminiApiKeys } from '@/lib/gemini-keys';

export const maxDuration = 60;

/**
 * Tải file từ Google Drive với cơ chế tự động xử lý trang xác nhận virus của Google
 */
async function downloadFromDrive(driveFileId: string, fallbackUrl?: string): Promise<Buffer> {
  const directUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  let res = await fetch(directUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'follow',
  });

  let contentType = res.headers.get('content-type') || '';
  let ab = await res.arrayBuffer();
  let buffer = Buffer.from(ab);

  // Nếu Google Drive trả về trang HTML cảnh báo (khi file quá lớn)
  if (contentType.includes('text/html')) {
    const htmlText = buffer.toString('utf-8');
    const confirmMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/);
    if (confirmMatch && confirmMatch[1]) {
      const confirmUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=${confirmMatch[1]}`;
      const confirmRes = await fetch(confirmUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      if (confirmRes.ok) {
        ab = await confirmRes.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    } else if (fallbackUrl) {
      const fbRes = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      if (fbRes.ok) {
        ab = await fbRes.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    }
  }

  return buffer;
}

/**
 * Trích xuất văn bản từ file Word .docx (Unzip file word/document.xml qua zlib)
 */
function extractTextFromDocx(buffer: Buffer): string {
  try {
    const target = Buffer.from('word/document.xml');
    const idx = buffer.indexOf(target);
    if (idx === -1) return '';
    const headerIdx = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), idx);
    if (headerIdx === -1) return '';
    const compSize = buffer.readUInt32LE(headerIdx + 18);
    const nameLen = buffer.readUInt16LE(headerIdx + 26);
    const extraLen = buffer.readUInt16LE(headerIdx + 28);
    const dataStart = headerIdx + 30 + nameLen + extraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);
    const uncompressed = zlib.inflateRawSync(compressed);
    const xml = uncompressed.toString('utf8');
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (e: any) {
    console.warn('[Scan AI] Lỗi giải nén .docx:', e.message);
    return '';
  }
}

/**
 * Trích xuất văn bản từ file Word 97-2003 .doc (tìm các chuỗi UTF-16LE và UTF-8)
 */
function extractTextFromDoc(buffer: Buffer): string {
  try {
    const pattern = new RegExp('[\\p{L}\\p{N}\\s,./\\-:()]{10,}', 'gu');
    const str = buffer.toString('utf16le');
    const matches = str.match(pattern) || [];
    if (matches.length > 5) {
      return matches.slice(0, 40).map((s) => s.trim()).filter(Boolean).join('\n');
    }
    const utf8 = buffer.toString('utf8');
    const m2 = utf8.match(pattern) || [];
    return m2.slice(0, 40).map((s) => s.trim()).filter(Boolean).join('\n');
  } catch (e: any) {
    console.warn('[Scan AI] Lỗi đọc text .doc:', e.message);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const keys = getAllGeminiApiKeys();
    if (keys.length === 0) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trong file .env.local.' },
        { status: 400 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình Supabase Admin trong hệ thống.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Không thể kết nối Supabase Client.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { doc_id } = body;

    if (!doc_id) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mã văn bản (doc_id) để quét AI.' },
        { status: 400 }
      );
    }

    // 1. Lấy thông tin tài liệu từ Supabase
    const { data: doc, error: fetchErr } = await supabase
      .from('document_files')
      .select('*')
      .eq('id', doc_id)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json(
        { error: 'Không tìm thấy tài liệu trong cơ sở dữ liệu.' },
        { status: 404 }
      );
    }

    if (!doc.drive_file_id && !doc.drive_download_url) {
      return NextResponse.json(
        { error: 'Tài liệu không có liên kết file trên Google Drive để quét.' },
        { status: 400 }
      );
    }

    // 2. Tải nội dung tập tin
    let buffer: Buffer;
    try {
      buffer = await downloadFromDrive(doc.drive_file_id, doc.drive_download_url);
    } catch (dlErr: any) {
      console.error('[Scan AI] Lỗi tải file từ Google Drive:', dlErr);
      return NextResponse.json(
        { error: `Không thể tải file "${doc.file_name}" từ Google Drive: ${dlErr.message || 'Lỗi mạng'}` },
        { status: 500 }
      );
    }

    const lowerName = (doc.file_name || '').toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || buffer.subarray(0, 4).toString() === '%PDF';
    const isDocx = lowerName.endsWith('.docx') || buffer.subarray(0, 4).toString() === 'PK\x03\x04';
    const isDoc = lowerName.endsWith('.doc') || buffer.subarray(0, 4).toString('hex') === 'd0cf11e0';

    // 3. Prompt chuyên sâu trích xuất metadata văn bản hành chính & tài liệu kỹ thuật hàng không
    const prompt = `Bạn là chuyên gia thẩm định và phân loại văn bản hành chính / tài liệu kỹ thuật hàng không của Công ty TNHH Kỹ thuật Quản lý bay (ATTECH).
Hãy đọc kỹ nội dung tài liệu đính kèm (ưu tiên 2 trang đầu) và trích xuất chính xác các thông tin metadata sau:
1. title: Tên loại văn bản và trích yếu đầy đủ, chuẩn ngữ nghĩa tiếng Việt (Ví dụ: "Nghị định quy định xử phạt vi phạm hành chính trong lĩnh vực phòng cháy và chữa cháy", "Hướng dẫn nhập số liệu trên phần mềm SIRMS", "Quy định phát NOTAM trong tổ chức cung cấp dịch vụ CNS", "Hướng dẫn khai thác bảo dưỡng máy tạo tín hiệu cao tần 8648B"). Tuyệt đối KHÔNG giữ các tên file thô tắt như "52ND - PCCC-CHCN".
2. document_code: Số và ký hiệu văn bản chính thức (Ví dụ: "52/2012/NĐ-CP", "749/QĐ-KTQLB", "125/GP-CTS", "08/2018/TT-BCA"). Nếu là tài liệu kỹ thuật/quy trình/hướng dẫn không có số hiệu chính thức, trích xuất mã ấn bản hoặc tên mã rút gọn (Ví dụ: "HD-SIRMS", "HD-8648B", "QĐ-NOTAM").
3. issuing_authority: Tên cơ quan, tổ chức ban hành (Ví dụ: "Chính phủ", "Bộ Giao thông Vận tải", "Bộ Công an", "Công ty TNHH Kỹ thuật Quản lý bay", "Tổng công ty Quản lý bay Việt Nam", "Cục Hàng không Việt Nam", "ICAO").
4. issue_date: Ngày tháng năm ban hành văn bản theo định dạng chuẩn YYYY-MM-DD (Ví dụ: "2012-06-14"). Nếu không có ngày cụ thể, tìm năm ban hành hoặc phiên bản (ví dụ "2023-01-01"). Nếu hoàn toàn không có để "".
5. department_access: Phân loại vào 1 trong các lĩnh vực:
   - "VB_PHAP_LUAT" (Văn bản Pháp luật, Luật, Nghị định, Thông tư, Quyết định quy chế)
   - "QL_KY_THUAT" (Quản lý Kỹ thuật CNS: Radar, VHF, Selex, ILS, DVOR/DME, SIRMS, thiết bị)
   - "SMS" (An toàn SMS hàng không, an toàn khai thác bay)
   - "PCCC_CHCN" (Phòng cháy chữa cháy & Cứu nạn cứu hộ)
   - "PCTT_TKCN" (Phòng chống thiên tai & Tìm kiếm cứu nạn)
   - "ATVSLD" (An toàn Vệ sinh lao động, bảo hộ lao động)
   - "CONG_TRINH_HK" (Công trình Hàng không, đài trạm, đường băng)`;

    let geminiParts: any[] = [];

    if (isPdf) {
      try {
        const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pageCount = srcDoc.getPageCount();
        const pagesToKeep = Math.min(pageCount, 2);

        const trimmedDoc = await PDFDocument.create();
        const copiedPages = await trimmedDoc.copyPages(
          srcDoc,
          Array.from({ length: pagesToKeep }, (_, i) => i)
        );
        copiedPages.forEach((p) => trimmedDoc.addPage(p));

        const trimmedBytes = await trimmedDoc.save();
        const base64Data = Buffer.from(trimmedBytes).toString('base64');
        console.log(`[Scan AI] Đã cắt ${pagesToKeep}/${pageCount} trang đầu của "${doc.file_name}".`);

        geminiParts = [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
        ];
      } catch (pdfErr) {
        console.warn('[Scan AI] Lỗi cắt trang PDF, fallback gửi nguyên bản PDF:', pdfErr);
        geminiParts = [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: buffer.toString('base64'),
            },
          },
        ];
      }
    } else {
      // Đối với file Word (.docx, .doc) hoặc file văn bản: trích xuất nội dung text
      let text = '';
      if (isDocx) {
        text = extractTextFromDocx(buffer);
      }
      if (!text) {
        text = extractTextFromDoc(buffer);
      }

      if (!text) {
        text = `Tên tài liệu: ${doc.file_name}`;
      }

      console.log(`[Scan AI] Trích xuất text từ file Word/Văn bản (${text.length} ký tự).`);
      geminiParts = [
        { text: `${prompt}\n\nNỘI DUNG VĂN BẢN TRÍCH XUẤT:\n${text.slice(0, 4500)}` },
      ];
    }

    // 4. Cấu hình Gemini REST API Payload
    const geminiPayload = {
      contents: [{ role: 'user', parts: geminiParts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            document_code: { type: 'STRING' },
            issuing_authority: { type: 'STRING' },
            issue_date: { type: 'STRING' },
            department_access: {
              type: 'STRING',
              enum: [
                'VB_PHAP_LUAT',
                'QL_KY_THUAT',
                'SMS',
                'PCCC_CHCN',
                'PCTT_TKCN',
                'ATVSLD',
                'CONG_TRINH_HK',
              ],
            },
          },
          required: ['title', 'issuing_authority', 'document_code', 'issue_date', 'department_access'],
        },
      },
    };

    // Gọi Gemini REST API qua pool xoay vòng key tự động
    const geminiData = await executeWithGeminiKeyRotation(async (key) => {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lỗi từ Gemini AI (${res.status}): ${errText}`);
      }

      return await res.json();
    });

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: 'AI không trả về kết quả phân tích.' }, { status: 500 });
    }

    const parsed = JSON.parse(rawText);

    // 5. Xây dựng payload cập nhật Supabase
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const newTitle = (parsed.title || '').trim();
    const newCode = (parsed.document_code || '').trim();
    const newAuthority = (parsed.issuing_authority || '').trim();
    const newDate = (parsed.issue_date || '').trim();
    const newDept = (parsed.department_access || '').trim();

    // Cập nhật tên văn bản / trích yếu đầy đủ nếu AI tìm thấy tiêu đề có ý nghĩa
    if (newTitle && newTitle.length >= 6) {
      updatePayload.file_name = newTitle;
    }

    // Cập nhật số hiệu nếu AI tìm thấy
    if (newCode) {
      updatePayload.document_code = newCode;
    } else if (!doc.document_code) {
      updatePayload.document_code = '';
    }

    // Cập nhật cơ quan ban hành
    if (newAuthority) {
      updatePayload.issuing_authority = newAuthority;
    }

    // Cập nhật ngày ban hành (nếu đúng chuẩn YYYY-MM-DD)
    if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      updatePayload.issue_date = newDate;
    }

    // Cập nhật chuyên môn nếu có
    if (newDept) {
      updatePayload.department_access = [newDept];
    }

    // 6. Cập nhật vào Supabase
    const { error: updateErr } = await supabase
      .from('document_files')
      .update(updatePayload)
      .eq('id', doc_id);

    if (updateErr) {
      console.error('[Scan AI] Lỗi cập nhật Supabase:', updateErr);
      return NextResponse.json(
        { error: `Không thể lưu metadata vào Supabase: ${updateErr.message}` },
        { status: 500 }
      );
    }

    const finalFileName = updatePayload.file_name || doc.file_name;
    const finalCode = updatePayload.document_code ?? doc.document_code ?? '';
    const finalAuth = updatePayload.issuing_authority ?? doc.issuing_authority ?? '';
    const finalDate = updatePayload.issue_date ?? doc.issue_date ?? null;
    const finalDept = updatePayload.department_access ?? doc.department_access ?? ['QL_KY_THUAT'];

    return NextResponse.json({
      success: true,
      docId: doc_id,
      metadata: {
        file_name: finalFileName,
        document_code: finalCode,
        issuing_authority: finalAuth,
        issue_date: finalDate,
        department_access: finalDept,
      },
      message: `Đã quét AI (2 trang đầu) và cập nhật metadata thành công cho "${finalFileName}".`,
    });
  } catch (err: any) {
    console.error('[Scan AI] Lỗi máy chủ:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xử lý quét AI' },
      { status: 500 }
    );
  }
}
