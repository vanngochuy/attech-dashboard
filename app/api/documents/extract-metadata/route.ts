import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { cleanEnv } from '@/lib/supabase';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const apiKey = cleanEnv(process.env.GEMINI_API_KEY);
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      return NextResponse.json(
        {
          error: 'Chưa cấu hình GEMINI_API_KEY hợp lệ trong file .env.local. Hãy bổ sung API key của bạn để sử dụng tính năng AI trích xuất thông tin tự động.'
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const driveFileId = (formData.get('drive_file_id') as string) || '';
    const fileUrl = (formData.get('file_url') as string) || '';
    const mode = (formData.get('mode') as string) || 'document'; // 'document' | 'license'

    let buffer: Buffer;
    let fileName = file ? file.name : 'document.pdf';
    let mimeType = file?.type || 'application/pdf';

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (driveFileId || fileUrl) {
      const downloadUrl = driveFileId
        ? `https://drive.google.com/uc?export=download&id=${driveFileId}`
        : fileUrl;
      const res = await fetch(downloadUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Không thể tải file PDF từ Google Drive để phân tích' },
          { status: 400 }
        );
      }
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } else {
      return NextResponse.json({ error: 'Không tìm thấy tập tin để phân tích' }, { status: 400 });
    }

    let base64Data: string;
    let targetMimeType: string = mimeType;

    // TỐI ƯU HÓA QUOTA: Nếu là file PDF, chỉ cắt và gửi 2 trang đầu tiên
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
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
        targetMimeType = 'application/pdf';
        console.log(`[AI Metadata Extractor] Đã cắt ${pagesToKeep}/${pageCount} trang đầu của PDF. Kích thước giảm còn ${(trimmedBytes.length / 1024).toFixed(1)} KB.`);
      } catch (pdfErr) {
        console.warn('[AI Metadata Extractor] Lỗi cắt trang PDF, fallback gửi bản gốc:', pdfErr);
        base64Data = buffer.toString('base64');
      }
    } else {
      // Nếu là ảnh (JPG, PNG) hoặc file khác
      base64Data = buffer.toString('base64');
    }

    const prompt =
      mode === 'license'
        ? `Bạn là chuyên gia thẩm định Giấy phép khai thác thiết bị hàng không, Giấy phép sử dụng tần số vô tuyến điện và Chứng nhận kỹ thuật CNS tại Việt Nam.
Hãy đọc kỹ trang đầu (và trang 2 nếu có) của giấy phép đính kèm và trích xuất chính xác các thông tin sau:
1. title: Tên đầy đủ của Giấy phép / Giấy chứng nhận kèm tên đài/trạm hoặc thiết bị (Ví dụ: "Giấy phép sử dụng tần số và thiết bị vô tuyến điện (DVOR/DME)", "Giấy phép khai thác cơ sở cung cấp dịch vụ bảo đảm hoạt động bay", "Giấy chứng nhận đủ điều kiện kỹ thuật thiết bị VOR/DME Tuy Hòa").
2. document_code: Số giấy phép / Số ký hiệu trên giấy phép (Ví dụ: "125/GP-CTS", "GP-AW-24", "458/GP-CHK"). Nếu không có thì để chuỗi rỗng.
3. issuing_authority: Cơ quan cấp phép (Ví dụ: "Cục Tần số vô tuyến điện", "Cục Hàng không Việt Nam", "Công ty TNHH Kỹ thuật Quản lý bay").
4. issue_date: Ngày cấp phép theo định dạng YYYY-MM-DD. Nếu không thấy thì để chuỗi rỗng.
5. expiry_date: Ngày hết hạn / Có giá trị đến ngày theo định dạng YYYY-MM-DD (Ví dụ: "Có giá trị đến ngày 27 tháng 02 năm 2028" -> "2028-02-27"). Nếu giấy phép ghi "Vô thời hạn" hoặc không giới hạn thời hạn thì trả về chuỗi rỗng "".
6. is_permanent: true nếu giấy phép có hiệu lực vô thời hạn / không xác định thời hạn, ngược lại false.`
        : `Bạn là chuyên gia thẩm định và phân loại văn bản hành chính Việt Nam theo chuẩn Nghị định 30/2020/NĐ-CP.
Hãy đọc kỹ trang đầu (và trang 2 nếu có) của tài liệu đính kèm và trích xuất chính xác các thông tin quan trọng sau:
1. title: Tên loại văn bản và trích yếu nội dung văn bản (Ví dụ: "Quyết định về việc kiện toàn Ban chỉ huy PCTT&TKCN của Công ty" hoặc "Thông tư quy định về kiểm tra an toàn kỹ thuật...").
2. document_code: Số và ký hiệu văn bản (Ví dụ: "749/QĐ-KTQLB", "03/2009/NĐ-CP"). Nếu không có thì để chuỗi rỗng.
3. issuing_authority: Tên cơ quan, tổ chức ban hành văn bản (Ví dụ: "Công ty TNHH Kỹ thuật Quản lý bay", "Tổng công ty Quản lý bay Việt Nam", "Bộ Giao thông Vận tải").
4. issue_date: Ngày tháng năm ban hành văn bản theo định dạng chuẩn YYYY-MM-DD (Ví dụ: "Hà Nội, ngày 02 tháng 7 năm 2024" -> "2024-07-02"). Nếu không tìm thấy thì để chuỗi rỗng.
5. expiry_date: Ngày hết hiệu lực (nếu có ghi trong văn bản) theo định dạng YYYY-MM-DD, nếu không có để chuỗi rỗng.
6. is_permanent: true nếu không có ngày hết hạn cụ thể, false nếu có ngày hết hạn.
7. scope_domain: Lựa chọn 1 trong các mã chuyên môn phù hợp nhất:
   - "VB_PHAP_LUAT" (Văn bản pháp luật, Luật, Nghị định, Thông tư của Nhà nước/Bộ)
   - "QL_KY_THUAT" (Quản lý kỹ thuật CNS, Selex, radar, đài trạm, thiết bị kỹ thuật)
   - "SMS" (An toàn hàng không, quản lý an toàn SMS)
   - "PCCC_CHCN" (Phòng cháy chữa cháy và Cứu nạn cứu hộ)
   - "PCTT_TKCN" (Phòng chống thiên tai và Tìm kiếm cứu nạn)
   - "ATVSLD" (An toàn vệ sinh lao động, bảo hộ lao động)
   - "CONG_TRINH_HK" (Công trình hàng không, đài trạm xây dựng)
8. doc_type: Lựa chọn 1 trong các mã loại văn bản:
   - "QUY_TRINH_HDCV" (Hướng dẫn công việc, quy trình SOP)
   - "QUY_DINH_QUY_CHE" (Quy định, quy chế, quyết định nội bộ)
   - "BAO_CAO" (Báo cáo kỹ thuật, báo cáo định kỳ)
   - "BIEN_BAN_KIEM_TRA" (Biên bản kiểm tra, nghiệm thu)
   - "KE_HOACH" (Kế hoạch công tác, kế hoạch bảo dưỡng)
   - "SO_NHAT_KY" (Sổ nhật ký đài trạm)`;

    // Gọi Gemini REST API với model gemini-3.5-flash-lite (tốc độ phản hồi cực nhanh ~1 giây)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: targetMimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            document_code: { type: 'STRING' },
            issuing_authority: { type: 'STRING' },
            issue_date: { type: 'STRING' },
            expiry_date: { type: 'STRING' },
            is_permanent: { type: 'BOOLEAN' },
            scope_domain: {
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
            doc_type: {
              type: 'STRING',
              enum: [
                'QUY_TRINH_HDCV',
                'QUY_DINH_QUY_CHE',
                'BAO_CAO',
                'BIEN_BAN_KIEM_TRA',
                'KE_HOACH',
                'SO_NHAT_KY',
              ],
            },
          },
          required: ['title'],
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
      console.error('Gemini API Error:', errText);
      return NextResponse.json(
        { error: 'Lỗi phản hồi từ Gemini API (' + geminiRes.status + '): ' + errText },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json({ error: 'Không nhận được dữ liệu trích xuất từ AI' }, { status: 500 });
    }

    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      success: true,
      metadata: {
        title: parsed.title || '',
        document_code: parsed.document_code || '',
        issuing_authority: parsed.issuing_authority || '',
        issue_date: parsed.issue_date || '',
        expiry_date: parsed.expiry_date || '',
        is_permanent: Boolean(parsed.is_permanent),
        scope_domain: parsed.scope_domain || 'VB_PHAP_LUAT',
        doc_type: parsed.doc_type || 'QUY_TRINH_HDCV',
      },
    });
  } catch (error: any) {
    console.error('Error in extract-metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý trích xuất tài liệu' },
      { status: 500 }
    );
  }
}

