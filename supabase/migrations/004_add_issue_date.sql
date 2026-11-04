-- Thêm cột Ngày ban hành (issue_date) cho bảng document_files
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Tạo index tìm kiếm nhanh theo ngày ban hành
CREATE INDEX IF NOT EXISTS idx_document_files_issue_date ON document_files (issue_date);

