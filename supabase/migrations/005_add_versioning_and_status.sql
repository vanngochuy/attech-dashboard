-- Migration 005: Thêm trường quản lý vòng đời và phiên bản thay thế văn bản
-- status: 'ACTIVE' (Còn hiệu lực) | 'SUPERSEDED' (Đã hết hiệu lực / Đã bị thay thế) | 'EXPIRED' (Hết hạn)
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- replaces_doc_id: Liên kết tới văn bản cũ mà văn bản này thay thế
ALTER TABLE document_files ADD COLUMN IF NOT EXISTS replaces_doc_id UUID REFERENCES document_files(id) ON DELETE SET NULL;

-- Chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_document_files_status ON document_files(status);
CREATE INDEX IF NOT EXISTS idx_document_files_replaces_doc_id ON document_files(replaces_doc_id);

