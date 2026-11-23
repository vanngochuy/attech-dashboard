# Hướng dẫn Triển khai n8n Workflows lên VPS (Production)

Thư mục này chứa toàn bộ 4 luồng workflow n8n cốt lõi của hệ thống **ATTECH Document Management & Compliance Dashboard**, đã được rà soát, kiểm định cú pháp và đồng bộ mới nhất từ hệ thống.

---

## 1. Danh mục 4 Workflows

| Tên File | Tên Workflow | Webhook Path / Trigger | Vai trò |
|---|---|---|---|
| `workflow_1_document_upload.json` | `ATTECH - API: Document Upload & Supabase Ingestion` | `POST /webhook/document-upload` | Nhận file từ Web tải lên, lưu vào đúng thư mục Google Drive theo lĩnh vực chuyên môn, ghi bản ghi vào bảng `document_files` (Supabase). |
| `workflow_2_document_deletion.json` | `ATTECH - API: Document Deletion` | `POST /webhook/document-delete` | Tiếp nhận yêu cầu xóa văn bản từ Web, gọi Google Drive API xóa file gốc và xóa bản ghi trong CSDL Supabase. |
| `workflow_3_drive_sync.json` | `ATTECH - Scheduled & Manual Drive Sync` | `Cron (00:00 hàng ngày)`<br>`POST /webhook/sync-drive-health` | Tự động đối soát định kỳ hàng đêm hoặc khi Admin bấm nút "Quét đối soát" trên Web: kiểm tra tính tồn tại của file trên Drive, gắn cờ cảnh báo `missing_on_drive` hoặc khôi phục `synced`. |
| `workflow_4_email_pdf_scanner.json` | `ATTECH - Email PDF Scanner (tuh@attech.com.vn) -> 03_TAI_LIEU_CHUA_XAC_THUC` | `IMAP Trigger (Hộp thư)`<br>`POST /webhook/scan-email-pdf` | **Nhánh 1:** Lắng nghe email gửi đến hòm thư nghiệp vụ, bóc tách file PDF đính kèm và lưu vào thư mục `03_TÀI LIỆU CHƯA XÁC THỰC`.<br>**Nhánh 2:** Webhook phục vụ màn hình "Tab Công việc / Hộp thư" quét danh sách file Drive để người dùng phê duyệt/đối soát văn bản. |

---

## 2. Các Credentials cần tạo trên n8n VPS

Trước hoặc sau khi Import các workflow vào n8n trên VPS, bạn cần vào menu **Credentials** trên n8n để kết nối 3 tài khoản dịch vụ sau:

### 1. `Google Drive OAuth2 API`
* **Loại Credential:** `Google Drive OAuth2 API`
* **Phạm vi dùng trong luồng:** 
  * `workflow_1_document_upload.json`
  * `workflow_2_document_deletion.json`
  * `workflow_3_drive_sync.json`
  * `workflow_4_email_pdf_scanner.json`
* **Ghi chú cấu hình:** Cần cấp quyền Google Drive API (`.../auth/drive` hoặc `.../auth/drive.file`). Sau khi tạo, hãy mở từng node Google Drive / HTTP Request trên giao diện n8n và chọn đúng Credential này.

### 2. `Postgres account` (Supabase Database Connection)
* **Loại Credential:** `PostgreSQL`
* **Phạm vi dùng trong luồng:**
  * Node `Execute a SQL query` (Workflow 1)
  * Node `Xóa bản ghi (Supabase)` (Workflow 2)
  * Node `Lấy danh sách file (Supabase)1`, `Đánh dấu Cảnh báo`, `Khôi phục trạng thái` (Workflow 3)
* **Thông số kết nối (Lấy từ Supabase Project Settings -> Database):**
  * **Host:** `aws-0-ap-southeast-1.pooler.supabase.com` (hoặc db host của bạn)
  * **Database:** `postgres`
  * **User:** `postgres.<project_ref>`
  * **Port:** `5432` hoặc `6543` (Transaction pooler)
  * **SSL:** `require` hoặc `allow`

### 3. `IMAP account` (Hộp thư nghiệp vụ)
* **Loại Credential:** `IMAP`
* **Phạm vi dùng trong luồng:** `workflow_4_email_pdf_scanner.json` (Node `1A. Email Trigger`)
* **Thông số:**
  * **Host:** Máy chủ mail của công ty (ví dụ mail của ATTECH)
  * **User:** `tuh@attech.com.vn` (hoặc hòm thư tiếp nhận)
  * **Port / SSL:** 993 (SSL/TLS)

---

## 3. Quy trình Import & Kích hoạt trên VPS

1. **Đăng nhập vào n8n VPS** (ví dụ `https://n8n.your-domain.com`).
2. Vào **Workflows** -> Bấm **Add Workflow** -> Menu dấu 3 chấm góc trên bên phải -> Chọn **Import from File...**.
3. Chọn từng file trong folder `attech-dashboard/n8n/` lần lượt từ 1 đến 4.
4. Trong từng Workflow:
   * Kiểm tra các node có chấm đỏ báo thiếu Credential, bấm vào node đó và gán Credential tương ứng đã tạo ở Mục 2.
   * Riêng node `8. Gửi danh sách PDF về Web để đối chiếu` trong `workflow_4`, kiểm tra URL trỏ về Web của bạn (mặc định là `https://docs.bbm.io.vn/api/tasks/email-scan` hoặc domain VPS chính thức của bạn).
5. **Gạt công tắc sang `Active` (Màu xanh)** ở góc trên bên phải của từng Workflow và bấm **Save**.

---

## 4. Cập nhật Biến Môi Trường Web Next.js (`.env` trên VPS)

Khi đưa Web Next.js lên VPS, hãy cập nhật các biến môi trường để trỏ sang địa chỉ n8n trên VPS:

```env
# Địa chỉ n8n VPS của bạn (thay https://n8n.your-domain.com bằng domain hoặc IP thực tế)
N8N_WEBHOOK_URL="https://n8n.your-domain.com/webhook/document-upload"
N8N_DELETE_WEBHOOK_URL="https://n8n.your-domain.com/webhook/document-delete"
N8N_SYNC_WEBHOOK_URL="https://n8n.your-domain.com/webhook/sync-drive-health"
N8N_EMAIL_SCAN_WEBHOOK_URL="https://n8n.your-domain.com/webhook/scan-email-pdf"
```

> **Lưu ý quan trọng:** 
> - URL Webhook Production trong n8n có dạng `/webhook/<path>`.
> - Hãy đảm bảo n8n trên VPS đã cấu hình biến môi trường `WEBHOOK_URL=https://n8n.your-domain.com/` trong Docker Compose để n8n sinh đúng Webhook URL công khai.
