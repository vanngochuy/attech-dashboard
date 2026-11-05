'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  FileText,
  ExternalLink,
  X,
  Loader2,
  Paperclip,
  RefreshCw,
  Database,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useAuth } from '@/components/auth-context';
import {
  LicenseItem,
  DEFAULT_LICENSES,
  evaluateExpiry,
  formatToDMY,
  formatToYMD,
} from '@/lib/compliance';

// Cắt tối đa 2 trang đầu của file PDF ngay trên trình duyệt để AI đọc siêu tốc (~1 giây)
async function slicePdfFirst2PagesForLicense(originalFile: File): Promise<File> {
  const isPdf =
    originalFile.type === 'application/pdf' ||
    originalFile.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) return originalFile;

  try {
    const arrayBuffer = await originalFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = srcDoc.getPageCount();

    if (pageCount <= 2) return originalFile;

    const trimmedDoc = await PDFDocument.create();
    const copiedPages = await trimmedDoc.copyPages(srcDoc, [0, 1]);
    copiedPages.forEach((p) => trimmedDoc.addPage(p));

    const trimmedBytes = await trimmedDoc.save();
    return new File(
      [trimmedBytes.buffer as ArrayBuffer],
      `preview_2pages_${originalFile.name}`,
      { type: 'application/pdf' }
    );
  } catch {
    return originalFile;
  }
}

export default function OperatingLicensesPage() {
  const { isAdmin } = useAuth();
  const [licenses, setLicenses] = useState<LicenseItem[]>(DEFAULT_LICENSES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Thêm / Sửa giấy phép (Đồng bộ AI đọc tự động như tab Tài liệu)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LicenseItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formIssuer, setFormIssuer] = useState('');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formIsPermanent, setFormIsPermanent] = useState(false);
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [replaceExistingId, setReplaceExistingId] = useState<string | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Upload nhanh file trực tiếp từ dòng bảng
  const quickUploadInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadTargetId, setQuickUploadTargetId] = useState<string | null>(null);

  // Modal Xem trước file giấy phép
  const [previewItem, setPreviewItem] = useState<LicenseItem | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLicenses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/compliance?type=licenses', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.licenses)) {
        setLicenses(data.licenses);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách giấy phép:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const persistLicenses = async (updated: LicenseItem[], successMsg: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'licenses', records: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu dữ liệu');
      setLicenses(updated);
      showToast('success', successMsg);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi lưu lên Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLicenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return licenses.filter((item) => {
      const ev = evaluateExpiry(item.expiryDate);
      if (statusFilter === 'VALID' && ev.state !== 'ACTIVE' && ev.state !== 'PERMANENT') return false;
      if (statusFilter === 'EXPIRING_SOON' && ev.state !== 'EXPIRING_SOON') return false;
      if (statusFilter === 'EXPIRED' && ev.state !== 'EXPIRED') return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.licenseCode || '').toLowerCase().includes(q) ||
        item.expiryDate.toLowerCase().includes(q)
      );
    });
  }, [licenses, searchQuery, statusFilter]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormIssuer('');
    setFormIssueDate('');
    setFormIsPermanent(false);
    setFormExpiryDate('');
    setFormFileUrl('');
    setFormFileName('');
    setAiFilled(false);
    setReplaceExistingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: LicenseItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.licenseCode || '');
    setFormIssuer(item.issuer || '');
    setFormIssueDate(item.issueDate ? formatToYMD(item.issueDate) : '');
    const isPerm = item.expiryDate.toLowerCase().includes('vô thời hạn');
    setFormIsPermanent(isPerm);
    setFormExpiryDate(isPerm ? '' : formatToYMD(item.expiryDate));
    setFormFileUrl(item.fileUrl || '');
    setFormFileName(item.fileName || '');
    setAiFilled(false);
    setReplaceExistingId(null);
    setIsModalOpen(true);
  };

  // Tìm xem giấy phép vừa quét AI có phải bản gia hạn/cập nhật cho giấy phép đang có hay không
  const matchedRenewalCandidate = useMemo(() => {
    if (editingItem) return null;
    const cleanName = formName.trim().toLowerCase();
    const cleanCode = formCode.trim().toLowerCase();
    if (!cleanName && !cleanCode) return null;

    return (
      licenses.find((lic) => {
        if (cleanCode.length >= 4 && (lic.licenseCode || '').toLowerCase() === cleanCode) {
          return true;
        }
        if (cleanName.length >= 8) {
          const licName = lic.name.toLowerCase();
          if (licName === cleanName || licName.includes(cleanName) || cleanName.includes(licName)) {
            return true;
          }
        }
        return false;
      }) || null
    );
  }, [editingItem, formName, formCode, licenses]);

  // Xử lý kéo thả hoặc chọn file trong Modal: Vừa tải file lên Supabase Storage vừa gọi AI Gemini đọc Số GP, Tên GP, Thời hạn
  const processLicenseFileWithAI = async (file: File) => {
    setIsUploadingFile(true);
    setIsExtractingAI(true);
    setAiFilled(false);

    // 1. Chạy song song: Upload file gốc lên Supabase Storage & Gửi 2 trang đầu cho Gemini AI đọc
    const uploadTask = (async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'licenses');
      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file thất bại');
      setFormFileUrl(data.fileUrl);
      setFormFileName(data.fileName || file.name);
    })();

    const aiExtractTask = (async () => {
      try {
        const lightweightFile = await slicePdfFirst2PagesForLicense(file);
        const aiFd = new FormData();
        aiFd.append('file', lightweightFile);
        aiFd.append('mode', 'license');

        const aiRes = await fetch('/api/documents/extract-metadata', {
          method: 'POST',
          body: aiFd,
        });
        const aiData = await aiRes.json();

        if (aiRes.ok && aiData.success && aiData.metadata) {
          const m = aiData.metadata;
          if (m.title) setFormName(m.title);
          if (m.document_code) setFormCode(m.document_code);
          if (m.issuing_authority) setFormIssuer(m.issuing_authority);
          if (m.issue_date) setFormIssueDate(m.issue_date);
          if (m.is_permanent) {
            setFormIsPermanent(true);
            setFormExpiryDate('');
          } else if (m.expiry_date) {
            setFormIsPermanent(false);
            setFormExpiryDate(formatToYMD(m.expiry_date));
          }
          setAiFilled(true);
        } else {
          // Fallback điền tên file nếu chưa có tên giấy phép
          if (!formName) {
            setFormName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
          }
        }
      } catch (err) {
        console.warn('Không thể trích xuất AI cho giấy phép:', err);
        if (!formName) {
          setFormName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
        }
      }
    })();

    try {
      await Promise.all([uploadTask, aiExtractTask]);
      showToast('success', `Đã tải lên "${file.name}" và trích xuất thông tin bằng AI!`);
    } catch (err: any) {
      showToast('error', err.message || 'Không thể tải file lên');
    } finally {
      setIsUploadingFile(false);
      setIsExtractingAI(false);
    }
  };

  const handleUploadFileInModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processLicenseFileWithAI(file);
  };

  const handleQuickUploadTrigger = (id: string) => {
    setQuickUploadTargetId(id);
    quickUploadInputRef.current?.click();
  };

  const handleQuickUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = quickUploadTargetId;
    e.target.value = '';
    if (!file || !targetId) return;

    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'licenses');

      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file thất bại');

      const updated = licenses.map((lic) =>
        lic.id === targetId
          ? {
              ...lic,
              fileUrl: data.fileUrl,
              fileName: data.fileName || file.name,
              updatedAt: new Date().toISOString(),
            }
          : lic
      );

      await persistLicenses(updated, `Đã đính kèm file "${file.name}"!`);
    } catch (err: any) {
      showToast('error', err.message || 'Không thể đính kèm file');
    } finally {
      setIsSaving(false);
      setQuickUploadTargetId(null);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('error', 'Vui lòng nhập tên giấy phép.');
      return;
    }

    const finalExpiry = formIsPermanent
      ? 'Vô thời hạn'
      : formExpiryDate
        ? formatToDMY(formExpiryDate)
        : 'Vô thời hạn';

    const targetUpdateId = editingItem?.id || replaceExistingId;

    if (targetUpdateId) {
      const updated = licenses.map((lic) =>
        lic.id === targetUpdateId
          ? {
              ...lic,
              name: formName.trim(),
              licenseCode: formCode.trim() || undefined,
              issuer: formIssuer.trim() || undefined,
              issueDate: formIssueDate ? formatToDMY(formIssueDate) : undefined,
              expiryDate: finalExpiry,
              fileUrl: formFileUrl.trim() || undefined,
              fileName: formFileName.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : lic
      );
      await persistLicenses(updated, 'Đã cập nhật giấy phép khai thác!');
    } else {
      const newItem: LicenseItem = {
        id: `lic-${Date.now()}`,
        name: formName.trim(),
        licenseCode: formCode.trim() || undefined,
        issuer: formIssuer.trim() || undefined,
        issueDate: formIssueDate ? formatToDMY(formIssueDate) : undefined,
        expiryDate: finalExpiry,
        fileUrl: formFileUrl.trim() || undefined,
        fileName: formFileName.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await persistLicenses([newItem, ...licenses], 'Đã thêm giấy phép mới!');
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (item: LicenseItem) => {
    if (!confirm(`Bạn có chắc muốn xóa "${item.name}"?`)) return;
    const updated = licenses.filter((lic) => lic.id !== item.id);
    await persistLicenses(updated, `Đã xóa giấy phép "${item.name}".`);
  };

  const getEmbedPreviewUrl = (url: string) => {
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    return url;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans selection:bg-sky-500/20">
      <style>{`
        @keyframes driftCloudHeader1 {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(35px); }
        }
        @keyframes driftCloudHeader2 {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(-30px); }
        }
      `}</style>

      {/* Input ẩn phục vụ đính kèm nhanh file giấy phép */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleQuickUploadChange}
      />

      {/* Khối Tiêu đề: Nền Xanh Bầu Trời & Mây Trắng (Đồng bộ với tab Tài liệu) */}
      <div className="relative bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] border-b border-sky-300 shadow-sm shrink-0 overflow-hidden z-20">
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          <svg
            viewBox="0 0 220 80"
            className="absolute -top-3 left-16 w-48 text-white/25 fill-current"
            style={{ animation: 'driftCloudHeader1 14s ease-in-out infinite' }}
          >
            <path d="M40 65 H180 A18 18 0 0 0 180 30 A24 24 0 0 0 135 14 A30 30 0 0 0 75 20 A22 22 0 0 0 40 65 Z" />
          </svg>
          <svg
            viewBox="0 0 240 80"
            className="absolute top-1 left-[42%] w-52 text-white/30 fill-current"
            style={{ animation: 'driftCloudHeader2 18s ease-in-out infinite' }}
          >
            <path d="M35 65 H195 A20 20 0 0 0 195 28 A26 26 0 0 0 148 12 A32 32 0 0 0 82 18 A24 24 0 0 0 35 65 Z" />
          </svg>
          <svg
            viewBox="0 0 200 80"
            className="absolute -bottom-4 right-24 w-48 text-white/25 fill-current"
            style={{ animation: 'driftCloudHeader1 16s ease-in-out infinite' }}
          >
            <path d="M45 65 H165 A20 20 0 0 0 165 25 A22 22 0 0 0 125 12 A30 30 0 0 0 68 20 A24 24 0 0 0 45 65 Z" />
          </svg>
        </div>

        <header className="h-14 flex items-center justify-between px-6 relative z-10">
          <div className="flex items-center gap-2 text-white font-bold text-sm drop-shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>Quản lý Giấy phép Khai thác Thiết bị &amp; Tần số</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/95 px-2.5 py-1.5 rounded-lg border border-white text-xs shadow-xs">
              <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-600 font-medium">Supabase:</span>
              <span className="text-emerald-600 font-bold font-mono">Ready</span>
            </div>

            <button
              onClick={fetchLicenses}
              disabled={isLoading}
              className="p-2 bg-white/95 hover:bg-white border border-white text-slate-700 hover:text-sky-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {isAdmin && (
              <button
                onClick={openAddModal}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b3252] hover:bg-slate-900 active:scale-95 text-white border border-white/25 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm giấy phép</span>
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Toast thông báo */}
      {toast && (
        <div
          className={`mx-6 mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-[11px] underline ml-3">
            Đóng
          </button>
        </div>
      )}

      {/* Thanh Tìm kiếm & Lọc cố định (Đồng bộ với tab Tài liệu) */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Danh sách giấy phép</span>
            <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
              {filteredLicenses.length}/{licenses.length}
            </span>
          </h3>
          {(statusFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 w-3.5 h-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên giấy phép, số hiệu, thời hạn..."
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('VALID')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                statusFilter === 'VALID'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Còn hiệu lực
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRING_SOON')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                statusFilter === 'EXPIRING_SOON'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Sắp hết hạn
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRED')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                statusFilter === 'EXPIRED'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Quá hạn
            </button>
          </div>
        </div>
      </div>

      {/* Vùng cuộn Bảng dữ liệu (Tiêu đề Freeze giống tab Tài liệu) */}
      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-12">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-500 text-xs gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <span>Đang tải danh sách giấy phép...</span>
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-sky-600" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Không tìm thấy giấy phép phù hợp
            </h4>
            <p className="text-slate-500 text-xs max-w-sm">
              Hãy thử từ khóa khác hoặc đặt lại bộ lọc trạng thái.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl bg-white shadow-xs">
            {/* Table Header - FREEZE (Sticky top-0) */}
            <div className="sticky top-0 z-20 h-11 px-4 flex items-center justify-between bg-slate-100/95 backdrop-blur-md text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 rounded-t-xl shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="w-8 text-center">STT</span>
                <span className="flex-1">TÊN GIẤY PHÉP</span>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-right">
                <span className="w-32 text-left hidden sm:inline">SỐ / KÝ HIỆU</span>
                <span className="w-32 text-center">THỜI HẠN</span>
                <span className="w-40 text-center">HIỆU LỰC</span>
                <span className="w-28 text-right">THAO TÁC</span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100">
              {filteredLicenses.map((item, idx) => {
                const ev = evaluateExpiry(item.expiryDate);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.fileUrl) setPreviewItem(item);
                      else if (isAdmin) openEditModal(item);
                    }}
                    className="h-14 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer last:rounded-b-xl bg-white"
                  >
                    {/* Trái: STT + Icon + Tên giấy phép */}
                    <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                      <span className="w-8 text-center text-xs text-slate-400 font-mono">
                        {idx + 1}
                      </span>
                      <FileText
                        className={`w-4 h-4 shrink-0 ${
                          item.fileUrl ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 truncate"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    {/* Phải: Các cột thông tin & Thao tác gọn */}
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="w-32 text-left font-mono text-xs text-indigo-700 font-semibold truncate hidden sm:inline">
                        {item.licenseCode || '---'}
                      </span>

                      <span className="w-32 text-center font-mono text-xs text-slate-700">
                        {item.expiryDate}
                      </span>

                      <span className="w-40 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${ev.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${ev.dotClass}`} />
                          <span className="truncate">{ev.shortLabel}</span>
                        </span>
                      </span>

                      {/* Cột Thao tác: Chỉ dùng icon gọn w-3.5 h-3.5 giống tab Tài liệu */}
                      <div
                        className="w-28 text-right flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            if (item.fileUrl) setPreviewItem(item);
                            else if (isAdmin) handleQuickUploadTrigger(item.id);
                            else showToast('error', 'Giấy phép này chưa có bản scan đính kèm.');
                          }}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            item.fileUrl
                              ? 'hover:bg-indigo-50 text-indigo-600'
                              : 'hover:bg-slate-100 text-slate-400'
                          }`}
                          title={item.fileUrl ? 'Xem bản scan giấy phép' : 'Chưa có file đính kèm'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleQuickUploadTrigger(item.id)}
                              className="p-1.5 rounded hover:bg-sky-50 text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
                              title={
                                item.fileUrl
                                  ? `Đổi file đính kèm (${item.fileName || 'Đã có file'})`
                                  : 'Đính kèm file PDF/Ảnh giấy phép'
                              }
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Chỉnh sửa giấy phép"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xóa giấy phép"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm / Chỉnh sửa Giấy phép khai thác (Tích hợp AI Gemini đọc tự động giống tab Tài liệu) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 my-4">
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingItem ? 'Chỉnh sửa Giấy phép khai thác' : 'Thêm Giấy phép khai thác mới'}
                  </h3>
                  <p className="text-[11px] text-sky-200/80">
                    Tải file PDF/Ảnh lên để AI Gemini tự động đọc Số giấy phép, Tên &amp; Thời hạn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {/* Khu vực Kéo thả / Chọn File PDF & AI Tự động đọc (Tham chiếu chuẩn tab Tài liệu) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-sky-600" />
                    <span>Bản scan Giấy phép (PDF / Ảnh) — AI Tự động trích xuất</span>
                  </label>
                  {isExtractingAI && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                      <Sparkles className="w-3 h-3" />
                      AI đang đọc Số &amp; Tên giấy phép...
                    </span>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) await processLicenseFileWithAI(dropped);
                  }}
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50'
                      : formFileUrl
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-300 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/30'
                  }`}
                >
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleUploadFileInModal}
                    className="hidden"
                  />

                  {isUploadingFile || isExtractingAI ? (
                    <div className="flex flex-col items-center justify-center py-2 gap-1.5 text-sky-700">
                      <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                      <span className="font-semibold">
                        Đang tải file lên Cloud &amp; dùng AI Gemini đọc thông tin giấy phép...
                      </span>
                    </div>
                  ) : formFileUrl ? (
                    <div className="flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {formFileName || 'Đã đính kèm bản scan giấy phép'}
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Đã lưu trên Supabase Storage • Nhấn để chọn file khác
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormFileUrl('');
                          setFormFileName('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[11px] shrink-0"
                      >
                        Gỡ file
                      </button>
                    </div>
                  ) : (
                    <div className="py-1.5">
                      <UploadCloud className="w-7 h-7 text-sky-600 mx-auto mb-1" />
                      <p className="font-semibold text-slate-800">
                        Kéo thả file PDF / Ảnh giấy phép vào đây hoặc{' '}
                        <span className="text-sky-600 underline">Chọn từ máy tính</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        AI sẽ tự động đọc 2 trang đầu để điền Tên giấy phép, Số giấy phép, Đơn vị cấp và Ngày hết hạn
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cảnh báo thông minh nếu phát hiện Giấy phép tải lên là bản Gia hạn / Cập nhật cho giấy phép cũ */}
              {matchedRenewalCandidate && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-xs">
                        Phát hiện giấy phép tương tự đang có trong danh sách:
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        <strong>{matchedRenewalCandidate.name}</strong> (Số:{' '}
                        <span className="font-mono">{matchedRenewalCandidate.licenseCode || '---'}</span>{' '}
                        • Hạn hiện tại: <span className="font-mono">{matchedRenewalCandidate.expiryDate}</span>)
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none font-semibold text-amber-900 bg-white/80 px-3 py-1.5 rounded-lg border border-amber-300">
                    <input
                      type="checkbox"
                      checked={replaceExistingId === matchedRenewalCandidate.id}
                      onChange={(e) =>
                        setReplaceExistingId(e.target.checked ? matchedRenewalCandidate.id : null)
                      }
                      className="rounded border-amber-400 text-sky-600"
                    />
                    <span>Cập nhật / Gia hạn trực tiếp vào giấy phép này (thay vì tạo dòng mới)</span>
                  </label>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    Tên giấy phép khai thác <span className="text-rose-500">*</span>
                  </label>
                  {aiFilled && formName && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Sparkles className="w-2.5 h-2.5" /> AI tự động điền
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Giấy phép sử dụng tần số và thiết bị vô tuyến điện (DVOR/DME)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Số giấy phép / Ký hiệu
                    </label>
                    {aiFilled && formCode && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="VD: 125/GP-CTS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Cơ quan cấp phép
                    </label>
                    {aiFilled && formIssuer && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formIssuer}
                    onChange={(e) => setFormIssuer(e.target.value)}
                    placeholder="VD: Cục Tần số vô tuyến điện / Cục HKVN"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Ngày cấp phép
                    </label>
                    {aiFilled && formIssueDate && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Thời hạn hiệu lực (Hết hạn)
                    </label>
                    {aiFilled && (formExpiryDate || formIsPermanent) && (
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="date"
                      disabled={formIsPermanent}
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={formIsPermanent}
                        onChange={(e) => setFormIsPermanent(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>Giấy phép Vô thời hạn</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingFile || isExtractingAI}
                  className="px-5 py-2 rounded-xl bg-[#1b3252] hover:bg-slate-800 text-white font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving
                    ? 'Đang lưu...'
                    : editingItem || replaceExistingId
                      ? 'Lưu cập nhật giấy phép'
                      : 'Thêm giấy phép'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem trước File Giấy phép */}
      {previewItem && previewItem.fileUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold truncate">{previewItem.name}</span>
                <span className="text-xs font-mono text-sky-200 bg-white/10 px-2 py-0.5 rounded shrink-0">
                  Hạn: {previewItem.expiryDate}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở tab mới</span>
                </a>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-900">
              {/\.(png|jpe?g|gif|webp)$/i.test(previewItem.fileUrl) ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewItem.fileUrl}
                    alt={previewItem.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <iframe
                  src={getEmbedPreviewUrl(previewItem.fileUrl)}
                  className="w-full h-full border-none bg-white"
                  title={previewItem.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
