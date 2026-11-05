'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  X,
  UploadCloud,
  File,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Ban,
  GitBranch,
  Loader2,
  ChevronDown,
  Plus,
  Sparkles,
  Calendar
} from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'VB_PHAP_LUAT', label: 'Văn bản Pháp luật & Quy chế', dot: 'bg-blue-500' },
  { value: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật', dot: 'bg-indigo-500' },
  { value: 'SMS', label: 'An toàn (SMS)', dot: 'bg-emerald-500' },
  { value: 'PCCC_CHCN', label: 'PCCC & CHCN', dot: 'bg-rose-500' },
  { value: 'PCTT_TKCN', label: 'PCTT & TKCN', dot: 'bg-cyan-500' },
  { value: 'ATVSLD', label: 'An toàn VSLĐ', dot: 'bg-amber-500' },
  { value: 'CONG_TRINH_HK', label: 'Công trình Hàng không', dot: 'bg-purple-500' },
];

const DOC_TYPES = [
  { value: 'QUY_TRINH_HDCV', label: 'Hướng dẫn công việc (SOP)' },
  { value: 'QUY_DINH_QUY_CHE', label: 'Quy định / Quy chế' },
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
  const [documentCode, setDocumentCode] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [scopeDomain, setScopeDomain] = useState('VB_PHAP_LUAT');
  const [docType, setDocType] = useState('QUY_TRINH_HDCV');
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Trạng thái kiểm tra trùng lặp & văn bản thay thế
  const [duplicateInfo, setDuplicateInfo] = useState<{
    isExactDuplicate: boolean;
    reason?: string;
    exactDoc?: any;
    isPotentialSuperseded: boolean;
    relationType?: 'NEWER' | 'OLDER';
    supersededCandidate?: any;
  }>({
    isExactDuplicate: false,
    isPotentialSuperseded: false,
  });
  const [replacementMode, setReplacementMode] = useState<'REPLACE' | 'STANDALONE'>('REPLACE');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm gọi API đối soát trùng lặp
  const checkDuplicate = async (t: string, code: string, issuer: string, date: string, scope: string) => {
    if (!t && !code) {
      setDuplicateInfo({ isExactDuplicate: false, isPotentialSuperseded: false });
      return;
    }
    try {
      const res = await fetch('/api/documents/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          document_code: code,
          issuing_authority: issuer,
          issue_date: date,
          scope_domain: scope,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDuplicateInfo({
          isExactDuplicate: !!data.isExactDuplicate,
          reason: data.reason,
          exactDoc: data.exactDuplicateDoc,
          isPotentialSuperseded: !!data.isPotentialSuperseded,
          relationType: data.relationType || 'NEWER',
          supersededCandidate: data.supersededCandidate,
        });
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra trùng lặp:', err);
    }
  };

  // Tự động kiểm tra trùng lặp khi người dùng sửa, AI điền hoặc đổi chuyên môn
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || documentCode) {
        checkDuplicate(title, documentCode, issuingAuthority, issueDate, scopeDomain);
      } else {
        setDuplicateInfo({ isExactDuplicate: false, isPotentialSuperseded: false });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [title, documentCode, issuingAuthority, issueDate, scopeDomain]);

  if (!isOpen) return null;

  // Hàm gọi AI đọc 2 trang đầu và tự điền thông tin (tối ưu cắt ngay tại trình duyệt để tăng tốc độ)
  const scanFileWithAI = async (selectedFile: File) => {
    setIsScanning(true);
    setIsAiFilled(false);
    try {
      let fileToSend: Blob = selectedFile;

      // Tối ưu mạng & tốc độ: Cắt trước 2 trang đầu ngay trên trình duyệt (giảm từ 20MB -> 150KB gửi đi)
      if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          const pagesToKeep = Math.min(srcDoc.getPageCount(), 2);
          const trimmedDoc = await PDFDocument.create();
          const copiedPages = await trimmedDoc.copyPages(
            srcDoc,
            Array.from({ length: pagesToKeep }, (_, i) => i)
          );
          copiedPages.forEach((p) => trimmedDoc.addPage(p));
          const trimmedBytes = await trimmedDoc.save();
          fileToSend = new Blob([trimmedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        } catch (clientSliceErr) {
          console.warn('Cắt client thất bại, fallback gửi file gốc:', clientSliceErr);
          fileToSend = selectedFile;
        }
      }

      const scanFormData = new FormData();
      scanFormData.append('file', fileToSend, selectedFile.name);

      const res = await fetch('/api/documents/extract-metadata', {
        method: 'POST',
        body: scanFormData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.metadata) {
        const m = data.metadata;
        if (m.title) setTitle(m.title);
        if (m.document_code) setDocumentCode(m.document_code);
        if (m.issuing_authority) setIssuingAuthority(m.issuing_authority);
        if (m.issue_date) setIssueDate(m.issue_date);
        if (m.scope_domain) setScopeDomain(m.scope_domain);
        if (m.doc_type) setDocType(m.doc_type);
        setIsAiFilled(true);
      } else {
        console.warn('AI Extraction warning:', data.error);
      }
    } catch (err: any) {
      console.warn('AI Extraction failed (non-blocking):', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
      // Tự động kích hoạt AI quét metadata
      scanFileWithAI(selectedFile);
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
      // Tự động kích hoạt AI quét metadata
      scanFileWithAI(droppedFile);
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

    if (duplicateInfo.isExactDuplicate) {
      setError('Tài liệu này đã tồn tại trên hệ thống (Trùng lặp). Không thể tải lên.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim());
    formData.append('document_code', documentCode.trim());
    formData.append('issuing_authority', issuingAuthority.trim());
    formData.append('issue_date', issueDate.trim());
    formData.append('scope_domain', scopeDomain);
    formData.append('doc_type', docType);

    // Nếu người dùng chọn áp dụng quy tắc hiệu lực theo ngày ban hành
    if (
      duplicateInfo.isPotentialSuperseded &&
      replacementMode === 'REPLACE' &&
      duplicateInfo.supersededCandidate?.id
    ) {
      if (duplicateInfo.relationType === 'OLDER') {
        // Tài liệu đang tải lên có ngày ban hành CŨ HƠN bản đang có trên hệ thống -> Lưu bản tải lên là SUPERSEDED, giữ bản trên hệ thống ACTIVE
        formData.append('initial_status', 'SUPERSEDED');
      } else {
        // Tài liệu đang tải lên có ngày ban hành MỚI HƠN -> Thay thế văn bản cũ trên hệ thống
        formData.append('replaces_doc_id', duplicateInfo.supersededCandidate.id);
      }
    }

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
    setDocumentCode('');
    setIssuingAuthority('');
    setIssueDate('');
    setScopeDomain('VB_PHAP_LUAT');
    setDocType('QUY_TRINH_HDCV');
    setError(null);
    setSuccess(false);
    setIsUploading(false);
    setIsScanning(false);
    setIsAiFilled(false);
    setDuplicateInfo({ isExactDuplicate: false, isPotentialSuperseded: false });
    setReplacementMode('REPLACE');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tải Lên Tài Liệu Mới
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              ESC
            </span>
            <button
              onClick={handleClose}
              disabled={isUploading || isScanning}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Tải lên thành công!</h4>
              <p className="text-slate-600 text-xs max-w-xs">
                Tài liệu đã được gửi sang n8n để tải lên thư mục Google Drive tương ứng và đồng bộ vào Supabase.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Banner Cảnh báo Trùng lặp hoàn toàn (ĐỎ - Chặn tải lên) */}
              {duplicateInfo.isExactDuplicate && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-in fade-in space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Ban className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <strong className="text-rose-900 block text-xs font-semibold mb-0.5">
                        Tài liệu này đã tồn tại trên hệ thống (Trùng lặp)!
                      </strong>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        {duplicateInfo.reason || 'Hệ thống phát hiện văn bản này đã được lưu trữ trước đó.'}
                      </p>
                    </div>
                  </div>
                  {duplicateInfo.exactDoc && (
                    <div className="bg-white border border-rose-200 rounded p-2 text-[11px] text-slate-800 flex items-center justify-between shadow-xs">
                      <div className="truncate mr-2">
                        <span className="font-mono text-rose-600 font-semibold mr-1.5">
                          DOC-{duplicateInfo.exactDoc.id.slice(0, 6).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900">{duplicateInfo.exactDoc.file_name}</span>
                      </div>
                      {duplicateInfo.exactDoc.document_code && (
                        <span className="font-mono text-slate-500 shrink-0">
                          {duplicateInfo.exactDoc.document_code}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-rose-600 italic">
                    * Hệ thống tạm khóa nút tải lên để bảo vệ tính toàn vẹn dữ liệu và tránh trùng lặp.
                  </div>
                </div>
              )}

              {/* Banner Cảnh báo Văn bản ban hành mới / Thay thế theo Ngày ban hành (VÀNG CAM - Cho phép chọn) */}
              {!duplicateInfo.isExactDuplicate && duplicateInfo.isPotentialSuperseded && duplicateInfo.supersededCandidate && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs animate-in fade-in space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <strong className="text-amber-900 block text-xs font-semibold mb-0.5">
                        {duplicateInfo.relationType === 'OLDER'
                          ? 'Trên hệ thống đã có văn bản ban hành MỚI HƠN!'
                          : 'Phát hiện văn bản cũ tương tự trên hệ thống (Ngày ban hành cũ hơn)'}
                      </strong>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {duplicateInfo.relationType === 'OLDER' ? 'Văn bản mới hơn trên hệ thống: ' : 'Văn bản cũ trên hệ thống: '}
                        <span className="font-semibold text-slate-900">{duplicateInfo.supersededCandidate.file_name}</span>
                        {duplicateInfo.supersededCandidate.document_code && (
                          <span className="font-mono text-indigo-700 ml-1 font-semibold">({duplicateInfo.supersededCandidate.document_code})</span>
                        )}
                        {duplicateInfo.supersededCandidate.issue_date && (
                          <span className="text-slate-600 ml-1">- Ban hành: {new Date(duplicateInfo.supersededCandidate.issue_date).toLocaleDateString('vi-VN')}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Tùy chọn cơ chế quản lý văn bản thay thế theo Ngày ban hành */}
                  <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-2 shadow-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="replacementMode"
                        checked={replacementMode === 'REPLACE'}
                        onChange={() => setReplacementMode('REPLACE')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="text-[11px] leading-snug">
                        <span className="font-semibold text-slate-900 block">
                          {duplicateInfo.relationType === 'OLDER'
                            ? 'Lưu bản này làm văn bản lịch sử "Đã thay thế" (Khuyến nghị)'
                            : 'Ban hành mới thay thế văn bản cũ (Khuyến nghị)'}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          {duplicateInfo.relationType === 'OLDER'
                            ? 'Do ngày ban hành cũ hơn, văn bản tải lên sẽ gắn nhãn "Đã thay thế"; văn bản mới hơn trên hệ thống vẫn giữ nguyên "Còn hiệu lực".'
                            : 'Do ngày ban hành mới hơn, văn bản tải lên sẽ "Còn hiệu lực"; văn bản cũ trên hệ thống tự động chuyển sang "Đã thay thế".'}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer pt-1.5 border-t border-slate-100">
                      <input
                        type="radio"
                        name="replacementMode"
                        checked={replacementMode === 'STANDALONE'}
                        onChange={() => setReplacementMode('STANDALONE')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="text-[11px] leading-snug">
                        <span className="font-medium text-slate-800 block">
                          Lưu độc lập song song
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          Cả hai văn bản đều cùng hoạt động độc lập và giữ nguyên hiệu lực.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Hàng 1: Tiêu đề văn bản */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Tên tài liệu / Tiêu đề văn bản *
                  </label>
                  {isAiFilled && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 animate-in fade-in">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> AI Tự động điền
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề hoặc trích yếu nội dung văn bản..."
                  className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                    isAiFilled
                      ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/20'
                      : 'border-slate-300 hover:border-slate-400 focus:border-indigo-600'
                  }`}
                />
              </div>

              {/* Hàng 2 (3 cột): Số hiệu - Đơn vị ban hành - Ngày ban hành */}
              <div className="grid grid-cols-3 gap-3">
                {/* Số / Ký hiệu */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số / Ký hiệu
                  </label>
                  <input
                    type="text"
                    value={documentCode}
                    onChange={(e) => setDocumentCode(e.target.value)}
                    placeholder="Vd: 749/QĐ-KTQLB"
                    className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
                  />
                </div>

                {/* Đơn vị ban hành */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Đơn vị ban hành
                  </label>
                  <input
                    type="text"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    placeholder="Vd: KTQLB, TCT QLB"
                    className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
                  />
                </div>

                {/* Ngày ban hành */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
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

              {/* Hàng 3: Khung Kéo & Thả file */}
              <div>
                <div
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                    isScanning
                      ? 'border-indigo-500 bg-indigo-50 animate-pulse'
                      : file
                      ? 'border-indigo-400 bg-indigo-50/30'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => !isScanning && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />

                  {isScanning ? (
                    <div className="flex items-center justify-center gap-2.5 py-2 text-indigo-800">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <div className="text-left">
                        <div className="text-xs font-bold text-indigo-900">✨ AI đang đọc và trích xuất thông tin văn bản...</div>
                        <div className="text-[10px] text-indigo-600">Đang quét thể thức văn bản từ 2 trang đầu...</div>
                      </div>
                    </div>
                  ) : file ? (
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-700">
                          <File className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{file.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-md border border-indigo-200 transition-all shadow-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (file) scanFileWithAI(file);
                          }}
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" /> Quét lại AI
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-rose-600 transition-colors px-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setIsAiFilled(false);
                          }}
                        >
                          Đổi file
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-2">
                      <UploadCloud className="w-7 h-7 text-indigo-600 mb-1.5" />
                      <span className="text-xs font-semibold text-slate-800">
                        Kéo thả file vào đây hoặc nhấn để duyệt
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Hỗ trợ PDF, Word, Excel (Tự động đọc 2 trang đầu bằng AI)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hàng 4: Chuyên môn & Loại văn bản */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Lĩnh vực chuyên môn */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Lĩnh vực chuyên môn
                  </label>
                  <div className="relative">
                    <select
                      value={scopeDomain}
                      onChange={(e) => setScopeDomain(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-medium rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600 transition-colors appearance-none pr-6 cursor-pointer shadow-xs"
                    >
                      {SCOPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Loại văn bản */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Loại văn bản
                  </label>
                  <div className="relative">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-medium rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-600 transition-colors appearance-none pr-6 cursor-pointer shadow-xs"
                    >
                      {DOC_TYPES.map((dt) => (
                        <option key={dt.value} value={dt.value} className="bg-white text-slate-900">
                          {dt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isUploading || isScanning}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading || isScanning || !file || duplicateInfo.isExactDuplicate}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white transition-all shadow-sm ${
                    duplicateInfo.isExactDuplicate
                      ? 'bg-rose-600 cursor-not-allowed opacity-60'
                      : duplicateInfo.isPotentialSuperseded && replacementMode === 'REPLACE'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30 active:scale-95'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang tải lên n8n...
                    </>
                  ) : duplicateInfo.isExactDuplicate ? (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      Trùng lặp (Không thể tải)
                    </>
                  ) : duplicateInfo.isPotentialSuperseded && replacementMode === 'REPLACE' ? (
                    <>
                      <GitBranch className="w-3.5 h-3.5" />
                      Tải lên & Thay thế bản cũ
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
