# CẤU TRÚC WEBSITE & SCHEMA CƠ SỞ DỮ LIỆU

## 1. CẤU TRÚC THƯ MỤC SOURCE CODE (NEXT.JS 14 APP ROUTER)

```
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx               # Trang đăng nhập
│   │   └── forgot-password/page.tsx     # Khôi phục mật khẩu
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # Layout chung (Sidebar + Header)
│   │   ├── page.tsx                     # Dashboard tổng quan (KPIs, Thống kê)
│   │   ├── chat/                        # Trợ lý AI Chatbot RAG
│   │   │   ├── [conversationId]/page.tsx
│   │   │   └── page.tsx
│   │   ├── emails/                      # Quản lý Email đã phân loại
│   │   │   └── page.tsx
│   │   ├── tasks/                       # Quản lý Công việc đã giao
│   │   │   └── page.tsx
│   │   ├── documents/                   # Kho lưu trữ tài liệu & file đính kèm
│   │   │   ├── compare/                 # Module So sánh văn bản (Diff View)
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── sop/                         # Module Sinh Hướng dẫn Công việc (SOP Generator)
│   │   │   └── page.tsx
│   │   └── settings/                    # Cấu hình API keys, Google Drive, Hòm thư, Phân quyền
│   │       └── page.tsx
│   ├── api/
│   │   ├── chat/route.ts                # Endpoint RAG Streaming Chatbot
│   │   ├── documents/compare/route.ts   # Endpoint So sánh & Tóm tắt điểm khác biệt (Diff LLM)
│   │   ├── sop/generate/route.ts        # Endpoint Trích xuất & Sinh quy trình SOP từng bước
│   │   └── webhook/email/route.ts       # Endpoint nhận webhook từ n8n
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── chat-message.tsx             # Tin nhắn (User & AI)
│   │   ├── citation-box.tsx             # Hộp trích dẫn tài liệu gốc (kèm link Drive preview)
│   │   └── prompt-suggestions.tsx       # Gợi ý câu hỏi nhanh
│   ├── diff/
│   │   └── document-diff-viewer.tsx     # Component So sánh văn bản (react-diff-viewer / diff-match-patch)
│   ├── sop/
│   │   └── sop-table-generator.tsx      # Component hiển thị Bảng Quy trình SOP từng bước chuẩn
│   ├── ui/                              # Shadcn UI components
│   └── document-preview-modal.tsx       # Modal xem trước PDF qua Google Drive iframe
├── lib/
│   ├── supabase/                        # Supabase client & server helper
│   ├── embeddings.ts                    # Utility sinh vector
│   └── utils.ts
└── types/
    └── index.ts                         # Typescript interfaces
```

---

## 1.1. COMPONENT XEM TRƯỚC TÀI LIỆU (GOOGLE DRIVE PREVIEW MODAL)

File: `components/document-preview-modal.tsx`

Tận dụng Google Drive để nhúng xem trực tiếp qua thẻ `iframe` mà không cần xử lý streaming file phức tạp từ backend:

```tsx
'use client';

import React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    title: string;
    driveFileId: string;
    pageNumber?: number;
    highlightSnippet?: string;
  } | null;
}

export default function DocumentPreviewModal({ isOpen, onClose, document }: DocumentPreviewModalProps) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400"/>
            <h3 className="text-sm font-semibold text-slate-100 truncate max-w-md">{document.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://drive.google.com/file/d/${document.driveFileId}/view`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Mở trên Google Drive"
            >
              <ExternalLink className="w-4 h-4"/>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* Thân Modal: Iframe Google Drive Preview */}
        <div className="flex-1 bg-slate-950">
          <iframe
            src={`https://drive.google.com/file/d/${document.driveFileId}/preview`}
            className="w-full h-full border-none"
            allow="autoplay"
            title={document.title}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 1.2. MODULE SO SÁNH VĂN BẢN (DIFF VIEW COMPONENT)

File: `components/diff/document-diff-viewer.tsx`

Tích hợp thư viện `react-diff-viewer-continued` (hoặc `diff-match-patch`) kết hợp bảng tóm tắt điểm khác biệt do AI Gemini sinh ra:

```tsx
'use client';

import React, { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { Sparkles, FileText, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface DocumentDiffViewerProps {
  oldTitle: string;
  newTitle: string;
  oldContent: string;
  newContent: string;
  aiSummary?: {
    changes_count: number;
    key_updates: string[];
    removed_rules: string[];
    impact_assessment: string;
  };
}

export default function DocumentDiffViewer({
  oldTitle,
  newTitle,
  oldContent,
  newContent,
  aiSummary
}: DocumentDiffViewerProps) {
  const [splitView, setSplitView] = useState<boolean>(true);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
      {/* Control Bar */}
      <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-slate-200">So sánh phiên bản tài liệu</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSplitView(!splitView)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {splitView ? 'Chuyển sang chế độ Inline' : 'Chuyển sang chế độ Side-by-Side'}
          </button>
        </div>
      </div>

      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h4 className="font-semibold text-indigo-200 text-base">Tóm tắt khác biệt từ AI (Gemini LLM)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <span className="text-emerald-400 font-medium block mb-1">📌 Điểm cập nhật / Bổ sung mới:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {aiSummary.key_updates.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <span className="text-rose-400 font-medium block mb-1">🚫 Nội dung bãi bỏ / Sửa đổi:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {aiSummary.removed_rules.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 text-xs text-indigo-300/80 bg-indigo-900/20 p-2 rounded border border-indigo-800/40">
            <strong>Đánh giá tác động kỹ thuật:</strong> {aiSummary.impact_assessment}
          </div>
        </div>
      )}

      {/* Diff Viewer Engine */}
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
        <ReactDiffViewer
          oldValue={oldContent}
          newValue={newContent}
          splitView={splitView}
          leftTitle={oldTitle}
          rightTitle={newTitle}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={true}
          styles={{
            variables: {
              dark: {
                diffViewerBackground: '#090d16',
                addedBackground: '#064e3b33',
                addedColor: '#34d399',
                removedBackground: '#88133733',
                removedColor: '#fb7185',
                wordAdded: '#059669',
                wordRemoved: '#e11d48',
                titleColor: '#cbd5e1'
              }
            }
          }}
        />
      </div>
    </div>
  );
}
```

---

## 1.3. MODULE SINH HƯỚNG DẪN CÔNG VIỆC (SOP GENERATOR COMPONENT)

File: `components/sop/sop-table-generator.tsx`

Tự động trích xuất các bước từ tài liệu Selex/HDCV và render thành Bảng Quy trình từng bước chuẩn chỉnh:

```tsx
'use client';

import React from 'react';
import { Wrench, AlertTriangle, CheckCircle, Printer, Download, BookOpen } from 'lucide-react';

export interface SopStep {
  step_number: number;
  step_name: string;
  action_detail: string;
  tools_required: string[];
  safety_warnings: string;
  acceptance_criteria: string;
}

export interface SopData {
  title: string;
  equipment: string;
  reference_doc: string;
  prepared_by: string;
  steps: SopStep[];
}

interface SopTableGeneratorProps {
  sop: SopData;
}

export default function SopTableGenerator({ sop }: SopTableGeneratorProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
      {/* Header SOP */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" /> Quy trình Kỹ thuật Chuẩn (SOP)
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">{sop.title}</h2>
          <div className="flex gap-4 text-xs text-slate-400 mt-2">
            <span><strong>Thiết bị:</strong> {sop.equipment}</span>
            <span>•</span>
            <span><strong>Căn cứ:</strong> {sop.reference_doc}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> In Quy Trình
          </button>
        </div>
      </div>

      {/* Bảng Các Bước Thực Hiện */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-950 text-slate-300 font-semibold border-b border-slate-800">
              <th className="py-3 px-4 w-16 text-center">Bước</th>
              <th className="py-3 px-4 w-48">Tên Bước</th>
              <th className="py-3 px-4">Nội Dung Thao Tác Chi Tiết</th>
              <th className="py-3 px-4 w-40">Dụng Cụ / Thiết Bị</th>
              <th className="py-3 px-4 w-48">Cảnh Báo An Toàn</th>
              <th className="py-3 px-4 w-48">Tiêu Chuẩn Đạt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300">
            {sop.steps.map((step) => (
              <tr key={step.step_number} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 text-center font-bold text-indigo-400 bg-slate-950/30">
                  {step.step_number}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-200">
                  {step.step_name}
                </td>
                <td className="py-3 px-4 leading-relaxed">
                  {step.action_detail}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {step.tools_required.map((tool, tIdx) => (
                      <span key={tIdx} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded border border-slate-700">
                        <Wrench className="w-3 h-3 text-amber-400" /> {tool}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-rose-300 text-xs">
                  {step.safety_warnings && (
                    <div className="flex items-start gap-1.5 bg-rose-950/30 p-2 rounded border border-rose-900/50">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{step.safety_warnings}</span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-emerald-300 text-xs">
                  <div className="flex items-start gap-1.5 bg-emerald-950/30 p-2 rounded border border-emerald-900/50">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step.acceptance_criteria}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 2. DATABASE SCHEMA (POSTGRESQL + PGVECTOR)

```sql
-- 1. Bật Extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Bảng Phân quyền Người dùng
CREATE TABLE profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'manager', 'employee')) DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng Lưu trữ Email đã xử lý
CREATE TABLE processed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    raw_body TEXT,
    summary TEXT,
    category TEXT, -- 'urgent', 'administrative', 'invoice', 'general'
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    received_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'processed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bảng File đính kèm & Tài liệu nội bộ (Tích hợp Google Drive)
CREATE TABLE document_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES processed_emails(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INT,
    
    -- Các trường tích hợp Google Drive:
    drive_file_id TEXT NOT NULL,        -- ID file trên Google Drive
    drive_view_url TEXT NOT NULL,       -- Link xem: https://drive.google.com/file/d/{ID}/preview
    drive_download_url TEXT,           -- Link tải trực tiếp
    drive_folder_id TEXT,               -- ID thư mục nghiệp vụ (PCCC, Kỹ thuật,...)
    
    scope_domain VARCHAR(30) NOT NULL DEFAULT 'QL_KY_THUAT', 
    -- 'QL_KY_THUAT', 'SMS', 'PCCC_CHCN', 'PCTT_TKCN', 'ATVSLD', 'CONG_TRINH_HK'

    sub_category VARCHAR(50), 
    -- 'DVOR_1150A', 'DME_1119A', 'DIEN_NGUON_MFD', 'HOCHIKI', 'CHONG_SET', v.v.

    doc_type VARCHAR(30), 
    -- 'QUY_TRINH_HDCV', 'BIEN_BAN_KIEM_TRA', 'KE_HOACH_DIEN_TAP', 'GIAY_PHEP_CHUNG_CHI', 'SO_NHAT_KY', 'BAO_CAO'

    equipment_involved TEXT[] DEFAULT '{}', 
    -- ['DVOR1150A', 'DME1119A', 'VietGen_15KVA', 'Tektronix_TDS2024C', 'Hochiki_HCVR3']

    periodic_cycle VARCHAR(20), 
    -- 'HANG_NGAY', 'HANG_TUAN', 'HANG_THANG', 'HANG_QUY', 'HANG_NAM', 'CHUYEN_MUA'

    legal_ref TEXT, 
    -- 'QD_509_ATTECH', 'TT_47_2026_BXD', 'ANNEX_10', 'QD_2471_CHK'

    ocr_content TEXT,
    is_confidential BOOLEAN DEFAULT FALSE,
    department_access TEXT DEFAULT 'all',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index tối ưu truy vấn lọc đa diện
CREATE INDEX IF NOT EXISTS idx_doc_scope_domain ON document_files (scope_domain);
CREATE INDEX IF NOT EXISTS idx_doc_sub_category ON document_files (sub_category);
CREATE INDEX IF NOT EXISTS idx_doc_doc_type ON document_files (doc_type);
CREATE INDEX IF NOT EXISTS idx_equipment_involved ON document_files USING GIN (equipment_involved);

-- 5. Bảng Vector Embeddings cho RAG Chatbot
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES document_files(id) ON DELETE CASCADE,
    chunk_content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB,          -- Lưu {page_number, document_title, drive_file_id, scope_domain}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Bảng Phân công nhiệm vụ (Tasks) tự động từ AI
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID REFERENCES processed_emails(id),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES profiles(id),
    due_date TIMESTAMP WITH TIME ZONE,
    priority TEXT DEFAULT 'medium',
    status TEXT CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Function tìm kiếm Semantic Vector có lọc theo Scope Domain
CREATE OR REPLACE FUNCTION match_documents_by_scope (
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT,
    filter_scope VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        de.id,
        de.document_id,
        de.chunk_content,
        de.metadata,
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM document_embeddings de
    WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
      AND (filter_scope IS NULL OR de.metadata->>'scope_domain' = filter_scope)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
```