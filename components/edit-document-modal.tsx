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
  ChevronDown,
  Check,
  Building,
  Hash,
  History,
  ShieldCheck
} from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'VB_PHAP_LUAT', label: 'Văn bản Pháp luật & Quy chế', dot: 'bg-blue-500', desc: 'Luật, Nghị định, Thông tư, Quy chế chung' },
  { value: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật (CNS, Selex, TUH)', dot: 'bg-indigo-500', desc: 'CNS, Selex, DVOR/DME, Radar, HDCV, TUH' },
  { value: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-500', desc: 'Hệ thống an toàn, Báo cáo sự cố' },
  { value: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-500', desc: 'Phòng cháy chữa cháy & Cứu nạn' },
  { value: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-500', desc: 'Phòng chống thiên tai & TKCN' },
  { value: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-500', desc: 'Bảo hộ, An toàn điện, Làm việc trên cao' },
  { value: 'CONG_TRINH_HK', label: 'Công trình Hàng không', dot: 'bg-purple-500', desc: 'Hạ tầng đài trạm, Nhà trạm, Anten, ANHK' },
];

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    file_name: string;
    document_code?: string;
    issuing_authority?: string;
    issue_date?: string | null;
    status?: 'ACTIVE' | 'SUPERSEDED' | string;
    drive_file_id: string;
    drive_view_url: string;
    department_access?: string[];
    created_at?: string;
    sync_status?: string;
  } | null;
  onSuccess: () => void;
}

export default function EditDocumentModal({
  isOpen,
  onClose,
  document,
  onSuccess,
}: EditDocumentModalProps) {
  const [fileName, setFileName] = useState('');
  const [documentCode, setDocumentCode] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'SUPERSEDED'>('ACTIVE');
  const [scopeDomain, setScopeDomain] = useState('VB_PHAP_LUAT');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (document) {
      setFileName(document.file_name || '');
      setDocumentCode(document.document_code || '');
      setIssuingAuthority(document.issuing_authority || '');
      setIssueDate(document.issue_date || '');
      setStatus((document.status as 'ACTIVE' | 'SUPERSEDED') || 'ACTIVE');
      setScopeDomain(document.department_access?.[0] || 'VB_PHAP_LUAT');
      setConfirmDelete(false);
      setError(null);
      setSaveSuccess(false);
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const isMissingOnDrive = document.sync_status === 'missing_on_drive';

  const handleSave = async () => {
    if (!fileName.trim()) {
      setError('Tên tài liệu không được để trống.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: document.id,
          file_name: fileName.trim(),
          document_code: documentCode.trim(),
          issuing_authority: issuingAuthority.trim(),
          issue_date: issueDate.trim() || null,
          status,
          department_access: [scopeDomain],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật siêu dữ liệu.');
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-indigo-700 font-semibold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
              DOC-{document.id.slice(0, 6).toUpperCase()}
            </span>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-sm font-bold text-slate-900">Chi tiết siêu dữ liệu (Metadata)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              ESC
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Cảnh báo nếu file bị xóa trên Google Drive */}
          {isMissingOnDrive && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-rose-900 mb-0.5">
                  Cảnh báo: Tệp gốc không tồn tại trên Google Drive
                </strong>
                Hệ thống kiểm tra phát hiện file này đã bị xóa hoặc chuyển vào thùng rác trên Google Drive.
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Đã lưu siêu dữ liệu thành công!</span>
            </div>
          )}

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên tài liệu / Tiêu đề văn bản *
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Nhập tiêu đề hoặc trích yếu văn bản..."
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
            />
          </div>

          {/* Row 2: Số hiệu văn bản & Đơn vị ban hành & Ngày ban hành */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-slate-400" /> Số / Ký hiệu văn bản
              </label>
              <input
                type="text"
                value={documentCode}
                onChange={(e) => setDocumentCode(e.target.value)}
                placeholder="Vd: 123/QĐ-KTQLB"
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building className="w-3 h-3 text-slate-400" /> Đơn vị ban hành
              </label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="Vd: KTQLB, TCT QLB"
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-indigo-600" /> Ngày ban hành
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none transition-all cursor-pointer shadow-xs"
              />
            </div>
          </div>

          {/* Properties Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
            {/* Property: Trạng thái Hiệu lực */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-700 flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-slate-500" /> Trạng thái hiệu lực
              </span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatus('ACTIVE')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Còn hiệu lực
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('SUPERSEDED')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    status === 'SUPERSEDED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3 h-3 text-amber-600" /> Hết hiệu lực (Đã thay thế)
                </button>
              </div>
            </div>

            {/* Property: Chuyên môn */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-700 flex items-center gap-2 font-medium">
                <Tag className="w-4 h-4 text-slate-500" /> Lĩnh vực chuyên môn
              </span>
              <div className="relative">
                <select
                  value={scopeDomain}
                  onChange={(e) => setScopeDomain(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-900 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-600 transition-colors cursor-pointer appearance-none pr-8 shadow-xs"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* Property: Trạng thái Drive */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-700 flex items-center gap-2 font-medium">
                <Cloud className="w-4 h-4 text-slate-500" /> Trạng thái Drive
              </span>
              <div>
                {isMissingOnDrive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Không tìm thấy file
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đã đồng bộ Drive
                  </span>
                )}
              </div>
            </div>

            {/* Property: Google Drive File ID */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-700 flex items-center gap-2 font-medium">
                <Cloud className="w-4 h-4 text-slate-500" /> File ID
              </span>
              <div className="flex items-center gap-2 font-mono text-xs text-slate-700">
                <span>{document.drive_file_id}</span>
                {document.drive_view_url && (
                  <a
                    href={document.drive_view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Mở Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Property: Ngày tạo */}
            <div className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="text-slate-700 flex items-center gap-2 font-medium">
                <Calendar className="w-4 h-4 text-slate-500" /> Ngày số hóa
              </span>
              <span className="text-slate-700 font-mono text-xs">
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

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Xác nhận xóa ngay!
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-md transition-colors"
                title="Xóa khỏi hệ thống và kích hoạt xóa trên Google Drive"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa văn bản</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
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
