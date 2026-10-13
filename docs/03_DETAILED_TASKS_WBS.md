# DANH SÁCH TASK CHI TIẾT (WORK BREAKDOWN STRUCTURE - WBS)

> **Hướng dẫn:** Sử dụng ô đánh dấu `[x]` cho task đã hoàn thành, `[~]` cho task đang thực hiện và `[ ]` cho task chưa thực hiện.

---

## SPRINT 1: HẠ TẦNG CLOUD, GOOGLE DRIVE & TỰ ĐỘNG HÓA WORKFLOW (n8n + AI)

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [x] | **INF-01** | Khởi tạo Supabase Schema | Tạo bảng `processed_emails`, `document_files`, `tasks`, `document_embeddings`, kích hoạt extension `vector`. | 1 ngày | Hoàn thành |
| [x] | **INF-02** | Khởi tạo n8n Workflow Instance | Triển khai n8n Docker local/Serverless, kết nối biến môi trường và thiết lập credentials. | 0.5 ngày | Hoàn thành |
| [x] | **GDR-01** | Tích hợp Google Drive API | Cấu hình Google Drive Service Account / OAuth2 trong n8n để tự động upload file. | 1 ngày | Hoàn thành |
| [~] | **GDR-02** | Subfolder Routing theo Chuyên môn | Cấu hình n8n Node Google Drive: Tìm/Tạo và chuyển file tự động vào subfolder theo `scope_domain` (`QL_KY_THUAT`, `SMS`, `PCCC_CHCN`, v.v.) thay vì để ở thư mục gốc. | 0.5 ngày | Đang bổ sung |
| [x] | **SYNC-01** | API Xóa Tập Trung 2 Chiều | Xây dựng API `/api/documents/delete` vừa xóa bản ghi trong Supabase, vừa gọi n8n xóa file gốc trên Google Drive. | 0.5 ngày | Hoàn thành |
| [~] | **SYNC-02** | Workflow n8n Quét Định Kỳ | Cronjob n8n chạy mỗi đêm quét `drive_file_id`, kiểm tra mã 404/trashed và cập nhật `sync_status = 'missing_on_drive'`. | 0.5 ngày | Đang cấu hình |
| [x] | **WKF-01** | Trigger Email Integration | Cấu hình Node IMAP / Gmail OAuth2 để bắt email đến kèm điều kiện lọc (chỉ đọc email chưa đọc). | 0.5 ngày | Hoàn thành |
| [x] | **WKF-02** | Pipeline Trích xuất Attachment | Tự động tải file đính kèm, upload lên Google Drive, kiểm tra MIME type và chuyển sang node OCR Gemini 1.5 Flash. | 1 ngày | Hoàn thành |
| [x] | **AI-01** | Prompt Phân tích Email & Scope | Viết Prompt JSON Schema trích xuất: Tiêu đề, Số hiệu, Người gửi, Mức ưu tiên, `scope_domain` (1 trong 6 lĩnh vực), Tasks. | 1 ngày | Hoàn thành |
| [x] | **WKF-03** | Dispatcher & Forwarding | Node gửi email thông báo / Telegram Bot / Zalo ZNS cho người được giao việc kèm nút xác nhận. | 1 ngày | Hoàn thành |
| [ ] | **VPS-01** | Deploy n8n lên Cloud VPS | Chuyển n8n từ Docker Local lên Cloud VPS (Ubuntu), thiết lập Nginx Reverse Proxy, SSL Certbot và Domain cố định cho Webhook. | 1 ngày | Chưa bắt đầu |

---

## SPRINT 2: PIPELINE RAG, VECTOR DATABASE & NÂNG CAO AI PROMPTS

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [x] | **RAG-01** | Text Chunking Strategy | Thiết kế quy chế chia nhỏ nội dung file theo đoạn (500-1000 tokens, overlap 100 tokens), gắn metadata (`scope_domain`, `drive_file_id`, `sub_category`). | 1 ngày | Hoàn thành |
| [x] | **RAG-02** | Embedding Generation Pipeline | Tạo Vector Embeddings tự động qua API và upsert vào bảng `document_embeddings`. | 1 ngày | Hoàn thành |
| [x] | **RAG-03** | Postgres Multi-Domain Search | Viết hàm SQL `match_documents_by_scope` trong Supabase để tính cosine similarity kết hợp scope filter. | 1 ngày | Hoàn thành |
| [~] | **RAG-04** | Web File Vectorization Pipeline | Kết nối Workflow n8n từ Web Upload tới Node Chunking & Embeddings để tự động vector hóa file vừa tải lên từ web. | 0.5 ngày | Đang triển khai |
| [x] | **AI-02** | Prompt RAG Knowledge Chatbot | Viết System Prompt cho Chatbot tri thức, trả lời căn cứ theo tài liệu [Tên_văn_bản - Trang X] kèm link Drive. | 0.5 ngày | Hoàn thành |
| [x] | **AI-03** | Prompt Document Diff Summarizer | Thiết lập Prompt Template so sánh 2 phiên bản tài liệu (VD: Quy định BD 4 vs Quy định BD 3) xuất điểm khác biệt. | 1 ngày | Hoàn thành |
| [x] | **AI-04** | Prompt SOP Generator | Thiết lập Prompt Template trích xuất quy trình từng bước từ tài liệu Selex/HDCV (VD: Thay card thu DVOR 1150A). | 1 ngày | Hoàn thành |

---

## SPRINT 3: FRONTEND WEB NEXT.JS, LINEAR UI & CẢNH BÁO ĐỒNG BỘ

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [x] | **FE-01** | Project Setup & UI Shell | Khởi tạo Next.js 14 App Router, Tailwind CSS, Lucide Icons, Shadcn UI components (Sidebar, Navbar, Layout). | 1 ngày | Hoàn thành |
| [x] | **FE-02** | Authentication & Auth Guards | Đăng nhập bằng Email/Password hoặc Magic Link qua Supabase Auth, bảo vệ route admin/dashboard. | 1 ngày | Hoàn thành |
| [x] | **FE-03** | Google Drive Preview Modal | Component `DocumentPreviewModal` nhúng `iframe` Google Drive preview xem nhanh PDF/Word trực tiếp. | 1 ngày | Hoàn thành |
| [x] | **FE-04** | UI Form Upload Tài liệu | Component `UploadDocumentModal` thiết kế Linear style, tải file và phân loại `scope_domain`. | 1 ngày | Hoàn thành |
| [x] | **FE-05** | API Proxy to n8n Webhook | Xây dựng API route `/api/documents/upload` trung chuyển file từ form web sang n8n Webhook xử lý ngầm. | 0.5 ngày | Hoàn thành |
| [x] | **FE-06** | Linear Style Documents UI | Chuyển đổi toàn diện giao diện sang Linear.app: Filter pills ngang, hàng ngang `h-12`, dot màu chuyên môn, phím tắt `⌘K`, `C`, `ESC`. | 1 ngày | Hoàn thành |
| [x] | **FE-07** | Edit Metadata & Delete Modal | Modal chỉnh sửa siêu dữ liệu, đổi chuyên môn và nút Xóa kích hoạt xóa 2 chiều an toàn. | 0.5 ngày | Hoàn thành |
| [x] | **SYNC-03**| Cảnh báo Mất File Google Drive | Hiển thị Banner cảnh báo, badge `Mất file Drive` và chấm đỏ nhấp nháy trên Web khi file bị xóa trên Drive. | 0.5 ngày | Hoàn thành |
| [ ] | **FE-08** | Task Management Dashboard | Bảng Kanban / Table xem danh sách việc AI đã giao từ email, cho phép sửa/duyệt/hoàn thành. | 1.5 ngày | Chưa bắt đầu |
| [ ] | **FE-09** | Streaming Chatbot Route & UI | Xây dựng giao diện Chatbot `/chat` kết nối `/api/chat` sử dụng Vercel AI SDK stream câu trả lời kèm trích dẫn văn bản gốc. | 1.5 ngày | Chưa bắt đầu |

---

## SPRINT 4: MODULE SO SÁNH VĂN BẢN (DIFF VIEW MODULE)

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **DIF-01** | UI Page `/documents/compare` | Xây dựng giao diện chọn 2 tài liệu/quy định (Phiên bản cũ vs Phiên bản mới) từ CSDL hoặc upload trực tiếp. | 1 ngày | Chưa bắt đầu |
| [ ] | **DIF-02** | Tích hợp `react-diff-viewer` | Cấu hình component `DocumentDiffViewer` hiển thị so sánh Side-by-Side và Inline, highlight thêm/xóa/sửa văn bản. | 1 ngày | Chưa bắt đầu |
| [ ] | **DIF-03** | API Route `/api/documents/compare` | Viết backend API gọi LLM với Prompt Template 3 để tóm tắt các điểm thay đổi chính, đánh giá tác động kỹ thuật. | 1 ngày | Chưa bắt đầu |
| [ ] | **DIF-04** | Export Báo cáo Diff | Hỗ trợ xuất kết quả so sánh + tóm tắt LLM ra file PDF hoặc Copy Markdown để gửi báo cáo. | 0.5 ngày | Chưa bắt đầu |

---

## SPRINT 5: MODULE SINH HƯỚNG DẪN CÔNG VIỆC (SOP GENERATOR MODULE)

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **SOP-01** | UI Page `/sop` & Form Nhập | Giao diện nhập yêu cầu (VD: "Tôi muốn thay thế khối card thu đài DVOR 1150A"), chọn thiết bị và loại công việc. | 1 ngày | Chưa bắt đầu |
| [ ] | **SOP-02** | API Route `/api/sop/generate` | Kết hợp RAG tìm tài liệu Selex/HDCV liên quan trong Supabase + LLM Prompt Template 4 để sinh bảng quy trình chi tiết. | 1.5 ngày | Chưa bắt đầu |
| [ ] | **SOP-03** | Component `SopTable` | Render bảng quy trình từng bước chuẩn chỉnh (STT, Bước thực hiện, Chi tiết thao tác, Dụng cụ/Thiết bị, Lưu ý an toàn, Tiêu chuẩn đạt). | 1 ngày | Chưa bắt đầu |
| [ ] | **SOP-04** | In & Xuất SOP (Print/PDF) | Tích hợp nút in quy trình / xuất file PDF / tạo Task giao việc trực tiếp từ bảng SOP vừa tạo. | 0.5 ngày | Chưa bắt đầu |

---

## SPRINT 6: TEST BẢO MẬT, TỐI ƯU & TRIỂN KHAI PWA

| Done | Task ID | Tiêu đề Task | Mô tả chi tiết kỹ thuật | Ước tính | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- |
| [ ] | **OPT-01** | Cấu hình PWA (Progressive Web) | Cấu hình Web App Manifest, Service Worker để cài ứng dụng trực tiếp lên iPhone/Android không cần App Store. | 0.5 ngày | Chưa bắt đầu |
| [ ] | **OPT-02** | Security & RLS Audit | Kiểm tra phân quyền RLS Supabase, mã hóa token Google Drive, bảo mật API routes trên Vercel. | 1 ngày | Chưa bắt đầu |
| [ ] | **OPT-03** | End-to-End Testing | Kiểm thử toàn bộ luồng: Email -> Google Drive -> OCR -> RAG -> Chatbot -> Diff View -> SOP Generator. | 1.5 ngày | Chưa bắt đầu |
