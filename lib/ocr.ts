import { PDFDocument } from 'pdf-lib';
import { cleanEnv } from '@/lib/supabase';

const MAX_OCR_PAGES = 20;

/**
 * Đọc OCR toàn bộ nội dung văn bản (tối đa 20 trang) bằng Gemini Flash-Lite
 * chỉ 1 lần duy nhất khi tải lên và trả về văn bản có đánh dấu [Trang X]
 * để lưu vào cột ocr_content trên Supabase.
 */
export async function extractDocumentOcr(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string | null> {
  const apiKey = cleanEnv(process.env.GEMINI_API_KEY);
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('[OCR] Chưa cấu hình GEMINI_API_KEY, bỏ qua OCR.');
    return null;
  }

  let base64Data: string;
  let targetMimeType = mimeType || 'application/pdf';
  let totalPages = 1;
  let keptPages = 1;

  if (targetMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    targetMimeType = 'application/pdf';
    try {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      totalPages = srcDoc.getPageCount();
      keptPages = Math.min(totalPages, MAX_OCR_PAGES);

      if (totalPages > MAX_OCR_PAGES) {
        const trimmedDoc = await PDFDocument.create();
        const pages = await trimmedDoc.copyPages(
          srcDoc,
          Array.from({ length: keptPages }, (_, i) => i)
        );
        pages.forEach((p) => trimmedDoc.addPage(p));
        const trimmedBytes = await trimmedDoc.save();
        base64Data = Buffer.from(trimmedBytes).toString('base64');
      } else {
        base64Data = buffer.toString('base64');
      }
    } catch (err) {
      console.warn('[OCR] Không thể đọc số trang PDF bằng pdf-lib, gửi nguyên bản:', err);
      base64Data = buffer.toString('base64');
    }
  } else {
    base64Data = buffer.toString('base64');
  }

  const prompt = `Bạn là hệ thống số hóa và OCR văn bản hành chính/kỹ thuật chuyên nghiệp của Công ty TNHH Kỹ thuật Quản lý bay (ATTECH).
Hãy đọc toàn bộ tài liệu đính kèm và chuyển thành văn bản chữ (Text/Markdown) chuẩn xác theo đúng định dạng sau:

=== TÓM TẮT NỘI DUNG ===
- Tóm tắt ngắn gọn 3 - 5 gạch đầu dòng về mục đích, đối tượng áp dụng và nội dung cốt lõi của văn bản.

=== NỘI DUNG CHI TIẾT ===
--- [Trang 1] ---
(Trích xuất đầy đủ, nguyên văn nội dung chữ trên trang 1, giữ nguyên cấu trúc Điều, Khoản, Điểm, Bảng biểu...)

--- [Trang 2] ---
(Trích xuất đầy đủ nội dung trang 2...)

Lưu ý:
- Đánh dấu rõ "--- [Trang X] ---" ở đầu mỗi trang để phục vụ trích dẫn nguồn.
- Giữ chính xác số hiệu, ngày tháng, con số, tên đơn vị, chức danh người ký.
- Không bình luận thêm ngoài nội dung tài liệu.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[OCR] Lỗi gọi Gemini OCR:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    const note =
      totalPages > keptPages
        ? `\n\n[Ghi chú hệ thống: Văn bản có ${totalPages} trang, đã trích xuất ${keptPages} trang đầu.]`
        : '';

    console.log(`[OCR] Hoàn tất trích xuất "${fileName}" (${keptPages}/${totalPages} trang, ${text.length} ký tự).`);
    return text + note;
  } catch (err) {
    console.error('[OCR] Lỗi ngoại lệ khi trích xuất OCR:', err);
    return null;
  }
}

