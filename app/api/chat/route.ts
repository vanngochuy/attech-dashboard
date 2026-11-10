import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { getNextGeminiApiKey } from '@/lib/gemini-keys';

export const maxDuration = 30;

const MAX_LIST_DOCS = 100;
const MAX_OCR_CHARS_PER_DOC = 45000; // Giới hạn an toàn ~10k-12k token mỗi văn bản để bảo vệ Free Tier

export async function POST(req: Request) {
  try {
    const google = createGoogleGenerativeAI({ apiKey: getNextGeminiApiKey() });
    const { messages, documents, scopeLabel, selectedDocIds } = await req.json();

    // 1. Cắt ngắn lịch sử hội thoại (Sliding Window: giữ tối đa 6 tin nhắn gần nhất để tiết kiệm Quota)
    const recentMessages = Array.isArray(messages) ? messages.slice(-6) : [];

    // 2. Danh sách văn bản đang lọc trên màn hình (Metadata nhẹ)
    const docs: any[] = Array.isArray(documents) ? documents.slice(0, MAX_LIST_DOCS) : [];
    const pinnedIds: string[] = Array.isArray(selectedDocIds) ? selectedDocIds : [];

    // 3. Nếu người dùng tích chọn văn bản (chế độ NotebookLM), lấy toàn văn ocr_content từ Supabase
    let deepDocsContext = '';
    const foundDbIds = new Set<string>();
    const contextBlocks: string[] = [];

    if (pinnedIds.length > 0 && isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: fullDocs } = await supabase
          .from('document_files')
          .select('id, file_name, document_code, issuing_authority, issue_date, status, ocr_content')
          .in('id', pinnedIds);

        if (fullDocs && fullDocs.length > 0) {
          fullDocs.forEach((d, idx) => {
            foundDbIds.add(String(d.id));
            const code = `DOC-${String(d.id || '').slice(0, 6).toUpperCase()}`;
            const statusText =
              d.status === 'SUPERSEDED'
                ? '⚠️ ĐÃ HẾT HIỆU LỰC (Đã bị thay thế bởi văn bản mới)'
                : '✅ Còn hiệu lực';
            const rawOcr = (d.ocr_content || '').trim();
            const truncatedOcr =
              rawOcr.length > MAX_OCR_CHARS_PER_DOC
                ? rawOcr.slice(0, MAX_OCR_CHARS_PER_DOC) + '\n...[Nội dung tiếp theo được lược bớt]...'
                : rawOcr;

            contextBlocks.push(`==================================================
TÀI LIỆU ĐƯỢC CHỌN #${idx + 1}: [${code}] ${d.file_name}
- Số / Ký hiệu: ${d.document_code || 'Không rõ'}
- Đơn vị ban hành: ${d.issuing_authority || 'Không rõ'}
- Ngày ban hành: ${d.issue_date || 'Không rõ'}
- Trạng thái hiệu lực: ${statusText}
--------------------------------------------------
${
  truncatedOcr
    ? `NỘI DUNG TOÀN VĂN (Đã trích xuất OCR):\n${truncatedOcr}`
    : `[CHƯA CÓ NỘI DUNG OCR]: Văn bản này được tải lên trước khi bật tính năng OCR tự động. Hãy nhắc người dùng bấm nút "Đọc OCR 1 lần" bên cạnh tên văn bản trong khung chat để nạp nội dung chi tiết.`
}
==================================================`);
          });
        }
      }
    }

    // Bổ sung ngữ cảnh cho các văn bản dự thảo/email từ tab Công việc được ghim hỏi trực tiếp
    if (pinnedIds.length > 0) {
      pinnedIds.forEach((pid) => {
        if (!foundDbIds.has(pid)) {
          const clientDoc = docs.find((d) => String(d.id) === String(pid));
          if (clientDoc) {
            const code = `DOC-${String(clientDoc.id || '').slice(0, 6).toUpperCase()}`;
            contextBlocks.push(`==================================================
TÀI LIỆU ĐƯỢC CHỌN: [${code}] ${clientDoc.file_name}
- Số / Ký hiệu: ${clientDoc.document_code || 'Chưa gắn số'}
- Đơn vị ban hành: ${clientDoc.issuing_authority || 'ATTECH'}
- Ngày văn bản: ${clientDoc.issue_date || 'Không rõ'}
- Trạng thái: ${clientDoc.status || 'Văn bản từ Email / Drive'}
--------------------------------------------------
${clientDoc.extra_context || 'Thông tin văn bản dự thảo/công việc được chọn từ danh sách.'}
==================================================`);
          }
        }
      });
    }

    deepDocsContext = contextBlocks.join('\n\n');

    // 4. Danh mục tóm tắt các văn bản đang hiển thị trên bộ lọc
    const catalogContext = docs.length
      ? docs
          .map((d, i) => {
            const code = `DOC-${String(d.id || '').slice(0, 6).toUpperCase()}`;
            const hasOcrBadge = d.has_ocr ? 'Đã có nội dung OCR' : 'Chỉ có metadata';
            return `${i + 1}. [${code}] ${d.file_name} | Số hiệu: ${d.document_code || '---'} | Đơn vị: ${d.issuing_authority || '---'} | Ngày: ${d.issue_date || '---'} | Hiệu lực: ${d.status === 'SUPERSEDED' ? 'ĐÃ HẾT HIỆU LỰC' : 'Còn hiệu lực'} (${hasOcrBadge})`;
          })
          .join('\n')
      : 'Không có văn bản nào đang được hiển thị.';

    const systemPrompt = `Bạn là Trợ lý ATTECH AI (hoạt động theo cơ chế Google NotebookLM nội bộ) của Công ty TNHH Kỹ thuật Quản lý bay (ATTECH).

PHẠM VI BỘ LỌC HIỆN TẠI TRÊN WEB: ${scopeLabel || 'Tất cả chuyên môn'} (${docs.length} văn bản).
SỐ VĂN BẢN ĐANG ĐƯỢC TÍCH CHỌN ĐỂ ĐỌC SÂU: ${pinnedIds.length} văn bản.

${
  deepDocsContext
    ? `### NGUỒN TÀI LIỆU ĐƯỢC TÍCH CHỌN ĐỂ ĐỌC SÂU (ƯU TIÊN SỐ 1):\n${deepDocsContext}\n\n`
    : ''
}### DANH MỤC VĂN BẢN ĐANG HIỂN THỊ TRÊN MÀN HÌNH:
${catalogContext}

QUY TẮC TRẢ LỜI BẮT BUỘC (CHUẨN NOTEBOOKLM):
1. CHỈ DỰA TRÊN NGUỒN NỘI BỘ: Chỉ trả lời dựa trên thông tin có trong các văn bản trên. Tuyệt đối không tự bịa số liệu hay điều khoản ngoài văn bản.
2. TRÍCH DẪN NGUỒN & TRANG RÕ RÀNG:
   - Khi lấy thông tin từ văn bản nào, luôn ghi rõ mã định danh \`[DOC-XXXXXX]\` kèm Số hiệu và số Trang (ví dụ: *Theo Quyết định 750/QĐ-KTQLB [DOC-DC5C9D], Trang 2*).
3. CẢNH BÁO HIỆU LỰC: Nếu người dùng hỏi về một văn bản có trạng thái "ĐÃ HẾT HIỆU LỰC", bạn PHẢI cảnh báo rõ ở đầu câu trả lời rằng văn bản này đã hết hiệu lực / đã bị thay thế.
4. KHI CHƯA CHỌN VĂN BẢN ĐỂ ĐỌC SÂU: Nếu người dùng hỏi chi tiết điều khoản bên trong mà chưa tích chọn văn bản đó (hoặc văn bản đó chưa có nội dung OCR), hãy hướng dẫn họ bấm tích chọn văn bản đó ở mục Nguồn tài liệu để bạn đọc toàn văn.
5. Trình bày ngắn gọn, rõ ràng bằng tiếng Việt, dùng gạch đầu dòng hoặc bảng so sánh dễ nhìn.`;

    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      system: systemPrompt,
      messages: recentMessages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
