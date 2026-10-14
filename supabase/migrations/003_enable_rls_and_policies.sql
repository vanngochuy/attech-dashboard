-- 1. Bật Row Level Security (RLS) cho bảng document_files để triệt tiêu cảnh báo bảo mật trên Supabase
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

-- 2. Khởi tạo các Security Policies cho document_files
DROP POLICY IF EXISTS "Allow read access to document_files" ON document_files;
DROP POLICY IF EXISTS "Allow update access to document_files" ON document_files;
DROP POLICY IF EXISTS "Allow insert access to document_files" ON document_files;
DROP POLICY IF EXISTS "Allow delete access to document_files" ON document_files;
DROP POLICY IF EXISTS "Allow all access to document_files" ON document_files;

CREATE POLICY "Allow read access to document_files" 
ON document_files 
FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow update access to document_files" 
ON document_files 
FOR UPDATE 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow insert access to document_files" 
ON document_files 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Allow delete access to document_files" 
ON document_files 
FOR DELETE 
TO anon, authenticated 
USING (true);

-- 3. Security Policies cho document_embeddings
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to document_embeddings" ON document_embeddings;
CREATE POLICY "Allow all access to document_embeddings" 
ON document_embeddings 
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

-- 4. Security Policies cho tasks và processed_emails
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to tasks" ON tasks;
CREATE POLICY "Allow all access to tasks" 
ON tasks 
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to processed_emails" ON processed_emails;
CREATE POLICY "Allow all access to processed_emails" 
ON processed_emails 
FOR ALL 
TO anon, authenticated 
USING (true)
WITH CHECK (true);
