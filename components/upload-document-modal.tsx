'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  File,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Tag,
  FileText,
  ChevronDown,
  Plus
} from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật', dot: 'bg-indigo-400' },
  { value: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-400' },
  { value: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-400' },
  { value: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-400' },
  { value: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-400' },
  { value: 'CONG_TRINH_HK', label: 'Công trình Hàng không', dot: 'bg-purple-400' },
];

const DOC_TYPES = [
  { value: 'QUY_TRINH_HDCV', label: 'Hướng dẫn công việc (SOP)' },
  { value: 'BAO_CAO', label: 'Báo cáo kỹ thuật' },
  { value: 'BIEN_BAN_KIEM_TRA', label: 'Biên bản kiểm tra' },
  { value: 'KE_HOACH', label: 'Kế hoạch bảo dưỡng' },
  { value: 'SO_NHAT_KY', label: 'Sổ nhật ký đài trạm' },
];

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadDocumentModal({ isOpen, onClose, onSuccess }: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [scopeDomain, setScopeDomain] = useState('QL_KY_THUAT');
  const [docType, setDocType] = useState('QUY_TRINH_HDCV');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      if (!title) {
        const nameWithoutExt = droppedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Vui lòng chọn một tập tin để tải lên.');
      return;
    }
    if (!title.trim()) {
      setError('Vui lòng nhập tên tài liệu.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('scope_domain', scopeDomain);
    formData.append('doc_type', docType);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Có lỗi xảy ra khi tải lên tài liệu.');
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setTitle('');
    setScopeDomain('QL_KY_THUAT');
    setDocType('QUY_TRINH_HDCV');
    setError(null);
    setSuccess(false);
    setIsUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#121316] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Linear Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#14151a]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Tải Lên Tài Liệu Mới (New Document)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.05]">
              ESC
            </span>
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-100 mb-1">Tải lên thành công!</h4>
              <p className="text-zinc-500 text-xs max-w-xs">
                Tài liệu đã được đẩy sang n8n để tải lên Google Drive và đồng bộ vào Supabase.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title input Linear style */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tên tài liệu hoặc số hiệu công văn..."
                  className="w-full bg-[#18191f] border border-white/[0.08] hover:border-white/[0.15] focus:border-indigo-500/70 rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all"
                />
              </div>

              {/* Drag & Drop Zone */}
              <div>
                <div
                  className={`border border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    file
                      ? 'border-indigo-500/50 bg-indigo-500/[0.03]'
                      : 'border-white/[0.1] hover:border-white/[0.2] bg-[#16171d]/60 hover:bg-[#16171d]'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />

                  {file ? (
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                          <File className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">{file.name}</div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                      >
                        Đổi file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <UploadCloud className="w-8 h-8 text-zinc-500 mb-2" />
                      <span className="text-xs font-medium text-zinc-300">
                        Kéo thả file vào đây hoặc nhấn để duyệt
                      </span>
                      <span className="text-[11px] text-zinc-500 mt-1 font-mono">
                        Hỗ trợ PDF, Word, Excel (Max 50MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linear Properties Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Chuyên môn */}
                <div className="bg-[#16171d] border border-white/[0.06] rounded-lg p-2.5">
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                    Chuyên môn
                  </label>
                  <div className="relative">
                    <select
                      value={scopeDomain}
                      onChange={(e) => setScopeDomain(e.target.value)}
                      className="w-full bg-[#1e2027] border border-white/[0.06] text-zinc-200 text-xs font-medium rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none pr-6 cursor-pointer"
                    >
                      {SCOPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Loại văn bản */}
                <div className="bg-[#16171d] border border-white/[0.06] rounded-lg p-2.5">
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                    Loại văn bản
                  </label>
                  <div className="relative">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full bg-[#1e2027] border border-white/[0.06] text-zinc-200 text-xs font-medium rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none pr-6 cursor-pointer"
                    >
                      {DOC_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value}>
                          {dt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Action Buttons Linear style */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-sm shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang xử lý n8n...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Tải lên hệ thống
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
