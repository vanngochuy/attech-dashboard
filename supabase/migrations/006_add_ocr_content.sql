-- 006_add_ocr_content.sql
-- Thêm cột ocr_content vào bảng document_files để lưu kết quả OCR một lần phục vụ Trợ lý AI NotebookLM

ALTER TABLE public.document_files
ADD COLUMN IF NOT EXISTS ocr_content TEXT;
