'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Wrench,
  ShieldCheck,
  Flame,
  Waves,
  HardHat,
  Building2,
  List,
  LayoutGrid,
  CheckCircle2,
  FileText,
  FileCode,
  FileSpreadsheet,
  Clock,
  Cloud,
  Database,
  ChevronRight,
  Filter,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import UploadDocumentModal from '@/components/upload-document-modal';
import EditDocumentModal from '@/components/edit-document-modal';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Danh mục Chuyên môn chuẩn Linear Design System
const DEPARTMENTS = [
  { id: 'ALL', label: 'Tất cả', dot: 'bg-zinc-400', icon: Layers },
  { id: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật', dot: 'bg-indigo-400', icon: Wrench },
  { id: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-400', icon: ShieldCheck },
  { id: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-400', icon: Flame },
  { id: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-400', icon: Waves },
  { id: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-400', icon: HardHat },
  { id: 'CONG_TRINH_HK', label: 'Công trình HK', dot: 'bg-purple-400', icon: Building2 },
];

export default function DocumentsPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);

  // Lấy dữ liệu Supabase
  const fetchDocuments = async () => {
    setIsLoading(true);
    let query = supabase.from('document_files').select('*').order('created_at', { ascending: false });

    if (activeFilter !== 'ALL') {
      query = query.contains('department_access', [activeFilter]);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Lỗi nạp dữ liệu từ Supabase:', error);
    } else if (data) {
      setDocuments(data);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeFilter]);

  // Bộ lọc tìm kiếm real-time
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.file_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMissing = filterMissingOnly ? doc.sync_status === 'missing_on_drive' : true;
      return matchesSearch && matchesMissing;
    });
  }, [documents, searchQuery, filterMissingOnly]);

  // Đếm số lượng file bị mất trên Google Drive
  const missingDriveCount = useMemo(() => {
    return documents.filter((doc) => doc.sync_status === 'missing_on_drive').length;
  }, [documents]);

  const activeDept = DEPARTMENTS.find((d) => d.id === activeFilter) || DEPARTMENTS[0];

  const getDeptConfig = (code: string) => {
    const found = DEPARTMENTS.find((d) => d.id === code);
    return found || { id: code, label: code || 'Chung', dot: 'bg-zinc-500', icon: FileText };
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (ext === 'doc' || ext === 'docx') return <FileCode className="w-4 h-4 text-blue-400" />;
    return <FileText className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0b0d] text-zinc-100 font-sans selection:bg-indigo-500/20">
      {/* Linear Top Bar */}
      <header className="h-14 border-b border-white/[0.06] bg-[#0d0e12]/80 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Tài liệu
          </span>
          <ChevronRight className="w-3 h-3 text-zinc-600" />
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${activeDept.dot}`} />
            {activeDept.label}
          </span>
          <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
            {filteredDocuments.length}
          </span>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc tài liệu..."
              className="bg-[#14151a] border border-white/[0.06] hover:border-white/[0.12] focus:border-indigo-500/60 rounded-md pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all w-48 focus:w-64"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 pointer-events-none">
              ⌘K
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="p-1.5 bg-[#14151a] border border-white/[0.06] hover:border-white/[0.12] text-zinc-400 hover:text-zinc-200 rounded-md transition-colors disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* View toggle */}
          <div className="flex items-center p-0.5 bg-[#14151a] border border-white/[0.06] rounded-md">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'list' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Chế độ Danh sách (List)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Chế độ Thẻ (Grid)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New Document Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-md text-xs font-medium transition-all shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm tài liệu</span>
            <span className="text-[10px] text-indigo-200/60 font-mono ml-0.5">C</span>
          </button>
        </div>
      </header>

      {/* Linear Sub-header / Filter Pills Bar */}
      <div className="border-b border-white/[0.06] bg-[#0c0d10] px-6 py-2 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
        {/* Department Pills */}
        <div className="flex items-center gap-1.5">
          <div className="text-zinc-500 text-[11px] uppercase tracking-wider font-semibold mr-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Chuyên môn:
          </div>
          {DEPARTMENTS.map((dept) => {
            const isActive = activeFilter === dept.id;
            return (
              <button
                key={dept.id}
                onClick={() => {
                  setActiveFilter(dept.id);
                  setFilterMissingOnly(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-medium border border-white/[0.12] shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                <span>{dept.label}</span>
              </button>
            );
          })}
        </div>

        {/* Integration Status Badges */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3 h-3 text-indigo-400" />
            <span>Google Drive:</span>
            <span className="text-zinc-300 font-mono">Synced</span>
          </div>
          <span className="text-zinc-700">•</span>
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>Supabase RAG:</span>
            <span className="text-zinc-300 font-mono">Ready</span>
          </div>
        </div>
      </div>

      {/* Cảnh báo nếu phát hiện file bị mất trên Google Drive */}
      {missingDriveCount > 0 && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Cảnh báo đồng bộ định kỳ:</strong> Phát hiện{' '}
              <strong className="text-amber-200 underline">{missingDriveCount} tài liệu</strong> đã bị xóa hoặc chuyển vào thùng rác trên Google Drive.
            </span>
          </div>
          <button
            onClick={() => setFilterMissingOnly(!filterMissingOnly)}
            className="px-2.5 py-1 rounded text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 transition-colors"
          >
            {filterMissingOnly ? 'Hiện tất cả tài liệu' : 'Lọc tài liệu lỗi'}
          </button>
        </div>
      )}

      {/* Main Document Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-zinc-500 text-xs gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <span>Đang đồng bộ dữ liệu từ Supabase...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-zinc-500 text-xs gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-zinc-600">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-zinc-400 font-medium">Không tìm thấy tài liệu phù hợp</span>
            <p className="text-zinc-600 max-w-sm text-center">
              {filterMissingOnly
                ? 'Không có tài liệu nào bị lỗi mất file Google Drive.'
                : 'Chưa có tài liệu nào thuộc chuyên đề này. Nhấn nút "Thêm tài liệu" để đưa tài liệu mới vào hệ thống.'}
            </p>
            {filterMissingOnly ? (
              <button
                onClick={() => setFilterMissingOnly(false)}
                className="mt-2 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] transition-colors"
              >
                Quay lại danh sách
              </button>
            ) : (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-2 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs border border-white/[0.06] transition-colors"
              >
                + Tải lên ngay
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* LINEAR LIST VIEW */
          <div className="divide-y divide-white/[0.04]">
            {filteredDocuments.map((doc) => {
              const deptCode = doc.department_access?.[0] || '';
              const dept = getDeptConfig(deptCode);
              const docCode = `DOC-${doc.id.slice(0, 6).toUpperCase()}`;
              const isMissingOnDrive = doc.sync_status === 'missing_on_drive';

              return (
                <div
                  key={doc.id}
                  className={`h-12 px-6 flex items-center justify-between hover:bg-white/[0.02] transition-colors group cursor-pointer ${
                    isMissingOnDrive ? 'bg-rose-500/[0.02]' : ''
                  }`}
                  onClick={() => {
                    if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                    else setEditingDoc(doc);
                  }}
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    {/* Status circle Linear style */}
                    {isMissingOnDrive ? (
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-rose-500/50 bg-rose-500/20 flex items-center justify-center shrink-0"
                        title="Cảnh báo: File không còn tồn tại trên Google Drive"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      </div>
                    ) : (
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0"
                        title="Đã đồng bộ Google Drive & Supabase"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                    )}

                    {/* ID */}
                    <span className="font-mono text-xs text-zinc-500 shrink-0 font-medium">
                      {docCode}
                    </span>

                    {/* File icon */}
                    <div className="shrink-0">{getFileIcon(doc.file_name)}</div>

                    {/* Title */}
                    <span
                      className={`text-xs font-medium truncate ${
                        isMissingOnDrive
                          ? 'text-zinc-300 line-through decoration-rose-500/40'
                          : 'text-zinc-200 group-hover:text-white'
                      }`}
                    >
                      {doc.file_name}
                    </span>

                    {/* Cảnh báo mất file Drive badge */}
                    {isMissingOnDrive && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-rose-400" /> Mất file Drive
                      </span>
                    )}
                  </div>

                  {/* Right metadata and actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Domain Pill Linear style */}
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.06] text-zinc-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                      <span>{dept.label}</span>
                    </span>

                    {/* Date */}
                    <span className="text-[11px] font-mono text-zinc-500 w-16 text-right">
                      {new Date(doc.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </span>

                    {/* Hover Linear Action Pill Buttons */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isMissingOnDrive && (
                        <button
                          onClick={() => setPreviewDoc(doc.drive_file_id)}
                          className="p-1.5 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Xem trước tài liệu"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setEditingDoc(doc)}
                        className="p-1.5 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                        title="Chỉnh sửa siêu dữ liệu / Xóa"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {!isMissingOnDrive && doc.drive_view_url && (
                        <a
                          href={doc.drive_view_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Mở Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LINEAR GRID / BOARD VIEW */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              const deptCode = doc.department_access?.[0] || '';
              const dept = getDeptConfig(deptCode);
              const docCode = `DOC-${doc.id.slice(0, 6).toUpperCase()}`;
              const isMissingOnDrive = doc.sync_status === 'missing_on_drive';

              return (
                <div
                  key={doc.id}
                  className={`bg-[#121316] border ${
                    isMissingOnDrive
                      ? 'border-rose-500/30 hover:border-rose-500/50'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  } rounded-xl p-4 transition-all hover:bg-[#14151a] group cursor-pointer flex flex-col justify-between`}
                  onClick={() => {
                    if (!isMissingOnDrive) setPreviewDoc(doc.drive_file_id);
                    else setEditingDoc(doc);
                  }}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-500 font-semibold">
                          {docCode}
                        </span>
                        {isMissingOnDrive ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] border border-white/[0.06] text-zinc-300">
                        <span className={`w-1.5 h-1.5 rounded-full ${dept.dot}`} />
                        {dept.label}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="mt-0.5 shrink-0">{getFileIcon(doc.file_name)}</div>
                      <h4
                        className={`text-xs font-semibold line-clamp-2 transition-colors ${
                          isMissingOnDrive
                            ? 'text-zinc-300 line-through decoration-rose-500/40'
                            : 'text-zinc-200 group-hover:text-white'
                        }`}
                      >
                        {doc.file_name}
                      </h4>
                    </div>

                    {/* Warning badge in grid */}
                    {isMissingOnDrive && (
                      <div className="mb-3 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3 text-rose-400" /> Mất file trên Google Drive
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between pt-3 border-t border-white/[0.05] text-[11px] text-zinc-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="font-mono">
                      {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                    </span>

                    <div className="flex items-center gap-1">
                      {!isMissingOnDrive && (
                        <button
                          onClick={() => setPreviewDoc(doc.drive_file_id)}
                          className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Xem trước"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingDoc(doc)}
                        className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                        title="Sửa metadata / Xóa"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {!isMissingOnDrive && doc.drive_view_url && (
                        <a
                          href={doc.drive_view_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Mở Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Upload */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchDocuments();
        }}
      />

      {/* Modal Sửa Metadata */}
      <EditDocumentModal
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        document={editingDoc}
        onSuccess={() => {
          fetchDocuments();
        }}
      />

      {/* Modal Xem Trước File */}
      {previewDoc && (
        <DocumentPreviewModal
          fileId={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
