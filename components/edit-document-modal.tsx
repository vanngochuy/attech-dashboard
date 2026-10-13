'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Tag,
  Calendar,
  Cloud,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Check
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SCOPE_OPTIONS = [
  { value: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật', dot: 'bg-indigo-400', desc: 'CNS, Selex, DVOR/DME, Radar' },
  { value: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-400', desc: 'Hệ thống an toàn, Báo cáo sự cố' },
  { value: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-400', desc: 'Phòng cháy chữa cháy & Cứu nạn' },
  { value: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-400', desc: 'Phòng chống thiên tai & TKCN' },
  { value: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-400', desc: 'Bảo hộ, An toàn điện, Làm việc trên cao' },
  { value: 'CONG_TRINH_HK', label: 'Công trình Hàng không', dot: 'bg-purple-400', desc: 'Hạ tầng đài trạm, Nhà trạm, Anten' },
];

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    file_name: string;
    drive_file_id: string;
    drive_view_url: string;
    department_access?: string[];
    created_at?: string;
    sync_status?: string;
  } | null;
  onSuccess: () => void;
}

export default function EditDocumentModal({ isOpen, onClose, document, onSuccess }: EditDocumentModalProps) {
  const [fileName, setFileName] = useState('');
  const [scopeDomain, setScopeDomain] = useState('QL_KY_THUAT');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (document) {
      setFileName(document.file_name || '');
      setScopeDomain(document.department_access?.[0] || 'QL_KY_THUAT');
      setError(null);
      setConfirmDelete(false);
      setSaveSuccess(false);
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const isMissingOnDrive = document.sync_status === 'missing_on_drive';

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fileName.trim()) {
      setError('Vui lòng nhập tên tài liệu.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('document_files')
        .update({
          file_name: fileName.trim(),
          department_access: [scopeDomain],
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (updateError) throw updateError;

      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Lỗi cập nhật metadata:', err);
      setError(err.message || 'Không thể cập nhật metadata.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Gọi API xóa tập trung: vừa xóa trong Supabase vừa gọi n8n xóa file trên Google Drive
      const res = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: document.id,
          drive_file_id: document.drive_file_id
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi xóa tài liệu.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xóa tài liệu:', err);
      setError(err.message || 'Không thể xóa tài liệu.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#121316] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Linear Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#14151a]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400 font-semibold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.06]">
              DOC-{document.id.slice(0, 6).toUpperCase()}
            </span>
            <span className="text-zinc-500 text-xs">/</span>
            <span className="text-xs font-medium text-zinc-300">Chi tiết siêu dữ liệu (Metadata)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.05]">
              ESC
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Cảnh báo nếu file bị xóa trên Google Drive */}
          {isMissingOnDrive && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-300 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-rose-200 mb-0.5">
                  Cảnh báo: Tệp gốc không tồn tại trên Google Drive
                </strong>
                Hệ thống kiểm tra định kỳ phát hiện file này đã bị xóa hoặc chuyển vào thùng rác trên Google Drive. Bạn có thể xóa bản ghi này khỏi hệ thống để tránh lỗi dữ liệu.
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Đã lưu siêu dữ liệu thành công!</span>
            </div>
          )}

          {/* Title input Linear style */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Tên tài liệu / Văn bản
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nhập tiêu đề hoặc số hiệu văn bản..."
              className="w-full bg-[#18191f] border border-white/[0.08] hover:border-white/[0.15] focus:border-indigo-500/70 rounded-lg px-3.5 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all"
            />
          </div>

          {/* Linear Properties Table */}
          <div className="border border-white/[0.06] rounded-lg overflow-hidden divide-y divide-white/[0.05] bg-[#16171d]">
            {/* Property: Chuyên môn */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-zinc-400 flex items-center gap-2 font-medium">
                <Tag className="w-3.5 h-3.5 text-zinc-500" /> Chuyên môn phân loại
              </span>
              <div className="relative">
                <select
                  value={scopeDomain}
                  onChange={(e) => setScopeDomain(e.target.value)}
                  className="bg-[#1f2027] border border-white/[0.08] text-zinc-200 text-xs font-medium rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none pr-8"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#1f2027] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Property: Trạng thái Drive */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-zinc-400 flex items-center gap-2 font-medium">
                <Cloud className="w-3.5 h-3.5 text-zinc-500" /> Trạng thái Drive
              </span>
              <div>
                {isMissingOnDrive ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Không tìm thấy file
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Đã đồng bộ Drive
                  </span>
                )}
              </div>
            </div>

            {/* Property: Google Drive File ID */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-zinc-400 flex items-center gap-2 font-medium">
                <Cloud className="w-3.5 h-3.5 text-zinc-500" /> File ID
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                <span>{document.drive_file_id}</span>
                {document.drive_view_url && (
                  <a
                    href={document.drive_view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    title="Mở Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Property: Ngày tạo */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-zinc-400 flex items-center gap-2 font-medium">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Ngày số hóa
              </span>
              <span className="text-zinc-400 font-mono text-[11px]">
                {document.created_at
                  ? new Date(document.created_at).toLocaleString('vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'Vừa xong'}
              </span>
            </div>
          </div>
        </div>

        {/* Linear Action Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.06] bg-[#14151a]">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Xác nhận xóa ngay!
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-zinc-400 hover:text-white px-1.5"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 transition-colors p-1"
                title="Xóa khỏi hệ thống và kích hoạt xóa trên Google Drive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa văn bản</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-sm shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
