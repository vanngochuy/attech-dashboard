# KẾ HOẠCH TỔNG THỂ PHÁT TRIỂN HỆ THỐNG (MASTER PLAN)
**Chu kỳ dự án:** 4 Giai đoạn (Tổng thời gian: 6 tuần cho MVP hoàn chỉnh)

---

## GIAI ĐOẠN 1: THIẾT LẬP NỀN TẢNG CLOUD, GOOGLE DRIVE & WORKFLOW XỬ LÝ EMAIL (Tuần 1 - 2)
* **Mục tiêu:** Nhận email, tải file đính kèm, đẩy file lên Google Drive, OCR văn bản, phân loại và lưu trữ tự động.
* **Các đầu việc chính:**
  1. Khởi tạo tài khoản và môi trường: Supabase Project, Render/Railway n8n instance, Google Drive API OAuth2/Service Account, Gemini API Keys.
  2. Thiết kế CSDL (PostgreSQL Schema) cho Bảng `processed_emails`, `document_files` (chứa `drive_file_id`), `tasks`, `document_embeddings`.
  3. Xây dựng Workflow n8n:
     * Node IMAP/Gmail Trigger đọc hòm thư theo chu kỳ (hoặc qua Webhook).
     * Node Google Drive Integration: Upload file đính kèm vào đúng Folder theo Lĩnh vực (`scope_domain`).
     * Node trích xuất file đính kèm (PDF scan, docx, jpg, png) & OCR với Gemini 1.5 Flash.
     * Node AI Agent: Phân tích nội dung, xuất JSON có cấu trúc.
     * Node Routing: Gửi thông báo khẩn cấp hoặc tạo task mẫu.

---

## GIAI ĐOẠN 2: HỆ THỐNG TRUY XUẤT TRI THỨC BẢO MẬT & PROMPT MODULES (Tuần 3)
* **Mục tiêu:** Xây dựng quy trình Vector hóa tài liệu, bộ API tìm kiếm ngữ nghĩa và tích hợp các Prompt chuyên sâu (SOP Generator, Document Diff Summarizer).
* **Các đầu việc chính:**
  1. Viết cơ chế Text Chunking thông minh (chia nhỏ văn bản kèm metadata `scope_domain`, `sub_category`, `equipment_involved`, `drive_file_id`).
  2. Chuyển đổi văn bản thành Vector Embeddings (`text-embedding-3-small` hoặc Gemini Embeddings) và lưu vào `pgvector` Supabase.
  3. Thiết lập Prompt Template 3 (Document Diff Summarizer): Tóm tắt so sánh sự thay đổi giữa 2 phiên bản quy định/văn bản.
  4. Thiết lập Prompt Template 4 (SOP Generator): Trích xuất quy trình từng bước từ tài liệu Selex/HDCV khi người dùng yêu cầu thay thế/bảo dưỡng thiết bị (ví dụ: thay card thu DVOR 1150A).
  5. Xây dựng thuật toán Hybrid Search (Kết hợp Vector Similarity Search + Full Text Search tiếng Việt) với filter theo `scope_domain`.
  6. Thiết lập RLS (Row Level Security) theo cấp độ bảo mật tài liệu.

---

## GIAI ĐOẠN 3: XÂY DỰNG GIAO DIỆN WEB / MOBILE PWA & CÁC MODULE CHUYÊN TẮC (Tuần 4 - 5)
* **Mục tiêu:** Ứng dụng Web và Mobile trực quan, hỗ trợ xem PDF qua Google Drive iframe, So sánh Diff View và Sinh SOP tự động.
* **Các đầu việc chính:**
  1. Khởi tạo dự án Next.js 14 (App Router) với Tailwind CSS + Shadcn UI.
  2. Xây dựng Module Xác thực người dùng (Auth) với Supabase (Login, Quản lý Token, Phân quyền).
  3. Thiết kế Giao diện Chatbot thông minh RAG:
     * Hỗ trợ streaming câu trả lời từng từ.
     * Hiển thị hộp trích dẫn nguồn văn bản (Source Citation) mở Modal xem trước file Google Drive iframe.
  4. Xây dựng Module So sánh văn bản (Diff View Module):
     * Tích hợp thư viện `react-diff-viewer` (hoặc `diff-match-patch`) để so sánh văn bản Side-by-Side / Inline.
     * Kết hợp bảng tóm tắt khác biệt sinh từ Gemini LLM Prompt.
  5. Xây dựng Module Sinh Hướng dẫn Công việc (SOP Generator Module):
     * Giao diện nhập nhu cầu ("Tôi muốn thay thế khối card thu đài DVOR 1150A").
     * Đẩy truy vấn qua RAG + SOP Prompt -> Render bảng quy trình chuẩn chỉnh (Bước, Thao tác, Dụng cụ, An toàn, Tiêu chuẩn).
  6. Thiết kế Dashboard Quản trị & Cấu hình PWA (Progressive Web App) để cài đặt trực tiếp lên mobile.

---

## GIAI ĐOẠN 4: TEST BẢO MẬT, TỐI ƯU VÀ TRIỂN KHAI THỰC TẾ (Tuần 6)
* **Mục tiêu:** Đưa vào vận hành thử nghiệm với tập dữ liệu email và hồ sơ đài trạm thực tế (DVOR 1150A, DME 1119A, VietGen, Hochiki).
* **Các đầu việc chính:**
  1. Thử nghiệm với các mẫu văn bản phức tạp (PDF scan mờ, file Word bảng biểu kỹ thuật).
  2. Kiểm thử luồng upload/view file trên Google Drive qua API.
  3. Tối ưu hóa chi phí API (Caching câu hỏi phổ biến, nén prompt).
  4. Bàn giao tài liệu hướng dẫn vận hành và quy trình thêm hòm thư mới.