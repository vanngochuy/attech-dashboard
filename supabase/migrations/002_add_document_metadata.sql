-- Thêm cột Số/Ký hiệu văn bản, Đơn vị ban hành và Trạng thái đồng bộ Drive
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS document_code TEXT;
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS issuing_authority TEXT;
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- Tạo index tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_document_files_code ON document_files (document_code);
CREATE INDEX IF NOT EXISTS idx_document_files_authority ON document_files (issuing_authority);
CREATE INDEX IF NOT EXISTS idx_document_files_sync_status ON document_files (sync_status);
