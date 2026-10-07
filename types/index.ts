export interface ProcessedEmail {
  id: string;
  message_id: string;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
  processed_at: string;
  raw_content: string | null;
  ai_summary: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  assignee: string | null;
  due_date: string | null;
  source_email_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFile {
  id: string;
  drive_file_id: string;
  file_name: string;
  drive_view_url: string | null;
  drive_download_url: string | null;
  ocr_content: string | null;
  department_access: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentEmbedding {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  created_at: string;
}

export interface MatchDocumentResult {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  drive_file_id: string;
  drive_view_url: string;
  file_name: string;
}
