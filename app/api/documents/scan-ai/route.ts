import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { getSupabaseAdminClient, isSupabaseAdminConfigured, cleanEnv } from '@/lib/supabase';

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

export async function POST(request: Request) {
  try {
    const apiKey = cleanEnv(process.env.GEMINI_API_KEY);
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
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

    // 3. Tối ưu: Cắt chính xác 2 trang đầu của PDF để gửi cho AI
    let base64Data: string;
    const isPdf = (doc.file_name || '').toLowerCase().endsWith('.pdf') || buffer.slice(0, 4).toString() === '%PDF';

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
        base64Data = Buffer.from(trimmedBytes).toString('base64');
        console.log(`[Scan AI] Đã cắt ${pagesToKeep}/${pageCount} trang đầu của "${doc.file_name}". Dung lượng gửi AI: ${(trimmedBytes.length / 1024).toFixed(1)} KB.`);
      } catch (pdfErr) {
        console.warn('[Scan AI] Lỗi cắt trang PDF, fallback gửi nguyên bản:', pdfErr);
        base64Data = buffer.toString('base64');
      }
    } else {
      base64Data = buffer.toString('base64');
    }

    // 4. Prompt chuyên sâu trích xuất metadata văn bản hành chính & tài liệu kỹ thuật hàng không
    const prompt = `Bạn là chuyên gia thẩm định và phân loại văn bản hành chính / tài liệu kỹ thuật hàng không của Công ty TNHH Kỹ thuật Quản lý bay (ATTECH).
Hãy đọc kỹ trang 1 và trang 2 của tài liệu đính kèm và trích xuất chính xác các thông tin metadata sau:
1. document_code: Số và ký hiệu văn bản (Ví dụ: "749/QĐ-KTQLB", "03/2009/NĐ-CP", "125/GP-CTS", "Doc 9157", "Annex 14", "QCVN 115:2020/BGTVT"). Nếu không có số hiệu chính thức, trích xuất mã hiệu ấn bản (ví dụ "Edition 6", "Volume 1", "Part 2"), nếu hoàn toàn không có để "".
2. issuing_authority: Tên cơ quan, tổ chức ban hành văn bản (Ví dụ: "Công ty TNHH Kỹ thuật Quản lý bay", "Tổng công ty Quản lý bay Việt Nam", "Bộ Giao thông Vận tải", "Cục Hàng không Việt Nam", "ICAO", "FAA", "Cục Tần số Vô tuyến điện").
3. issue_date: Ngày tháng năm ban hành văn bản theo định dạng chuẩn YYYY-MM-DD (Ví dụ: "2024-07-02"). Nếu văn bản chỉ ghi tháng và năm (ví dụ "July 2013"), quy đổi về ngày đầu tháng ("2013-07-01"). Nếu chỉ có năm (ví dụ "2020"), quy đổi về "2020-01-01". Nếu không tìm thấy năm ban hành thì để "".
4. department_access: Phân loại văn bản vào đúng 1 trong các lĩnh vực chuyên môn:
   - "VB_PHAP_LUAT" (Văn bản Pháp luật & Quy chế, Quyết định, Luật, Nghị định, Thông tư)
   - "QL_KY_THUAT" (Quản lý Kỹ thuật CNS: Radar, VHF, Selex, ILS, DVOR/DME, máy phát/thu, thiết bị kỹ thuật)
   - "SMS" (An toàn SMS hàng không, báo cáo sự cố an toàn)
   - "PCCC_CHCN" (Phòng cháy chữa cháy & Cứu nạn cứu hộ)
   - "PCTT_TKCN" (Phòng chống thiên tai & Tìm kiếm cứu nạn)
   - "ATVSLD" (An toàn Vệ sinh lao động, bảo hộ lao động)
   - "CONG_TRINH_HK" (Công trình Hàng không, đài trạm, đường băng, sân bay)`;

    // 5. Gọi Gemini REST API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: isPdf ? 'application/pdf' : 'application/octet-stream',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
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
          required: ['issuing_authority', 'document_code', 'issue_date', 'department_access'],
        },
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[Scan AI] Gemini API Error:', errText);
      return NextResponse.json(
        { error: `Lỗi từ Gemini AI (${geminiRes.status}): ${errText}` },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json({ error: 'AI không trả về kết quả phân tích.' }, { status: 500 });
    }

    const parsed = JSON.parse(rawText);

    // 6. Xây dựng payload cập nhật Supabase
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const newCode = (parsed.document_code || '').trim();
    const newAuthority = (parsed.issuing_authority || '').trim();
    const newDate = (parsed.issue_date || '').trim();
    const newDept = (parsed.department_access || '').trim();

    // Cập nhật số hiệu nếu AI tìm thấy hoặc nếu hiện tại chưa có
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

    // Cập nhật chuyên môn nếu hiện tại chưa có hoặc đang rỗng
    if (newDept && (!doc.department_access || doc.department_access.length === 0 || doc.department_access[0] === 'QL_KY_THUAT')) {
      updatePayload.department_access = [newDept];
    }

    // 7. Cập nhật vào Supabase
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

    return NextResponse.json({
      success: true,
      docId: doc_id,
      metadata: {
        document_code: updatePayload.document_code ?? doc.document_code ?? '',
        issuing_authority: updatePayload.issuing_authority ?? doc.issuing_authority ?? '',
        issue_date: updatePayload.issue_date ?? doc.issue_date ?? null,
        department_access: updatePayload.department_access ?? doc.department_access ?? ['QL_KY_THUAT'],
      },
      message: `Đã quét AI (2 trang đầu) và cập nhật metadata thành công cho "${doc.file_name}".`,
    });
  } catch (err: any) {
    console.error('[Scan AI] Lỗi máy chủ:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xử lý quét AI' },
      { status: 500 }
    );
  }
}

