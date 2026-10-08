# KIẾN TRÚC HỆ THỐNG VÀ HẠ TẦNG CLOUD-NATIVE TOÀN DIỆN
**Dự án:** Trợ lý AI Tự động hóa Xử lý Email, Điều phối Công việc & Chatbot Tri thức (Email-to-Task & Secure Knowledge Base)  
**Mục tiêu vận hành:** Hoạt động 100% trên Cloud, không phụ thuộc máy chủ vật lý tại chỗ, chi phí khởi điểm $0 - $15/tháng, bảo mật đa tầng.

---

## 1. SO SÁNH PHƯƠNG ÁN HẠ TẦNG (LOCAL VS CLOUD)

| Tiêu chí | Phương án 1: 100% Cloud-Native (Khuyên dùng) | Phương án 2: On-Premises (Máy chủ cục bộ) |
| :--- | :--- | :--- |
| **Phần cứng đầu tư ban đầu** | **$0** (Không cần mua máy tính/server) | 15 - 35 triệu VNĐ (Mini PC / Workstation / UPS) |
| **Bảo trì & Vận hành** | Tự động nâng cấp, uptime 99.9% từ nhà cung cấp | Tự quản lý mạng, điện, chống cúp điện, hỏng phần cứng |
| **Truy cập mọi nơi** | Sẵn sàng toàn cầu qua HTTPS / Custom Domain | Phải cấu hình DDNS, NAT Port, VPN hoặc Cloudflare Tunnel |
| **Bảo mật & Backup** | Backup tự động (Supabase & Google Drive), mã hóa AES-256 | Tự chịu trách nhiệm sao lưu ổ cứng dự phòng |
| **Khả năng mở rộng** | Scale tức thì từ 10 lên 10,000 người dùng | Bị giới hạn bởi RAM, CPU và băng thông mạng gia đình/cơ quan |

---

## 2. KIẾN TRÚC HẠ TẦNG 100% CLOUD (ZERO-HARDWARE) INTEGRATING GOOGLE DRIVE

Hệ thống hoạt động theo mô hình Serverless / Managed Services kết hợp **Google Drive** làm kho lưu trữ tài liệu tập trung:

```
[ Email Inbound: Gmail / IMAP / Webhook ]
                     │
                     ▼
[ Tầng Điều Phối: n8n Cloud / Render / Railway ]
         ├── Step 1: Phân tích Header & Download Attachments
         ├── Step 2: Upload file gốc lên Google Drive (Tạo Folder theo Scope: Kỹ thuật, PCCC, PCTT...)
         ├── Step 3: Lấy Google Drive File ID & View Link (iframe preview)
         ├── Step 4: Xử lý OCR / Vision qua Gemini 1.5 Flash API
         ├── Step 5: LLM JSON Output (Phân loại Scope, Giao việc, Tóm tắt, SOP, Diff)
         └── Step 6: Đẩy Vector Chunk & Drive Metadata vào Supabase
                     │
                     ├──────────────────────────────────────────┐
                     ▼                                          ▼
[ Kho Lưu Trữ File Gốc: Google Drive API ]     [ Cơ Sở Dữ Liệu: Supabase (Postgres + pgvector) ]
         ├── Phân thư mục tự động theo Lĩnh vực         ├── Auth: JWT / Row Level Security (RLS)
         ├── Nhúng trực tiếp Iframe Preview             ├── Database: Lưu logs, metadata, drive_file_id, task
         └── Quyền truy cập theo tài khoản Google       └── Vector Store: Embedding 1536/768 chiều cho RAG
                     │                                          │
                     └────────────────────┬─────────────────────┘
                                          ▼
[ Tầng Ứng Dụng & Chatbot: Vercel + Next.js 14 ]
         ├── PWA Web/Mobile Chat Interface (Shadcn UI + Tailwind)
         ├── Streaming RAG API Routes (Hỏi đáp tài liệu, Trích xuất SOP)
         ├── Document Diff View Module (react-diff-viewer + LLM Diff Summarizer)
         ├── SOP Generator Module (Sinh bảng hướng dẫn quy trình từng bước)
         └── Embedded Google Drive Document Preview Modal
```

---

## 3. DANH MỤC DỊCH VỤ CLOUD VÀ CHI PHÍ DỰ KIẾN

| Thành phần | Dịch vụ đề xuất | Gói cước | Chi phí / Tháng |
| :--- | :--- | :--- | :--- |
| **Lưu trữ tài liệu gốc & Preview** | **Google Drive API** (Tích hợp Google Workspace/Drive Cơ quan) | 15GB Free / Google Workspace hiện có | **$0** (Tận dụng hạ tầng lưu trữ sẵn có của đơn vị, tích hợp iframe xem trực tiếp) |
| **Tự động hóa Workflow** | Self-hosted n8n trên **Render** hoặc **Railway** | Starter Plan | $5 - $7 / tháng (hoặc $0 nếu dùng Free Tier ban đầu) |
| **Cơ sở dữ liệu & Vector** | **Supabase** (PostgreSQL + pgvector) | Free Tier / Pro Tier | $0 (Free: 500MB DB, 1GB Storage metadata) -> $25 khi scale |
| **Mô hình AI, OCR & SOP/Diff** | **Google Gemini API** (1.5 Flash) / **OpenAI API** | Pay-as-you-go | ~$2 - $5 / tháng (cho ~10,000 email/thắc mắc/tháng) |
| **Frontend & API Host** | **Vercel** (Next.js 14 App Router) | Hobby / Pro | $0 / tháng (Hobby đủ cho giai đoạn đầu) |
| **Tên miền & DNS** | Cloudflare | Free Tier + Domain | ~$10 / năm (~$0.8/tháng) |
| **TỔNG CHI PHÍ BAN ĐẦU** | | | **~$5 - $15 / THÁNG** |

---

## 4. CHIẾN LƯỢC BẢO MẬT & QUẢN LÝ TÀI LIỆU VỚI GOOGLE DRIVE

1. **Phân vùng lưu trữ trên Google Drive (Folder Hierarchy):**
   * Mỗi lĩnh vực nghiệp vụ (`scope_domain`: `QL_KY_THUAT`, `SMS`, `PCCC_CHCN`, `PCTT_TKCN`, `ATVSLD`, `CONG_TRINH_HK`) tương ứng với một Folder cha trên Google Drive.
   * File được n8n tự động đặt tên chuẩn hóa (mã hiệu văn bản + ngày ban hành) và upload vào đúng Folder tương ứng.
2. **Nhúng xem trực tiếp qua Iframe Google Drive:**
   * Hệ thống frontend Next.js lưu trữ `drive_file_id` trong Supabase. Khi người dùng click xem trích dẫn hoặc xem tài liệu, giao diện gọi iframe `https://drive.google.com/file/d/{drive_file_id}/preview` giúp xem PDF/Word mượt mà, không tốn băng thông server Vercel.
3. **Bảo mật truy cập (Row Level Security - RLS):**
   * Kết hợp Supabase Auth RLS và phân quyền xem link Drive theo cấp bậc (*Super Admin, Lãnh đạo, Trưởng phòng, Nhân viên*).
4. **Mã hóa tài liệu (Encryption at Rest & in Transit):**
   * 100% dữ liệu truyền qua giao thức HTTPS / TLS 1.3 và cơ chế mã hóa tiêu chuẩn của Google Cloud Engine & Supabase.
5. **Chính sách không huấn luyện lại mô hình (Zero Data Retention):**
   * Sử dụng Gemini 1.5 Flash API Key chính thức cam kết không retention dữ liệu nghiệp vụ của cơ quan.