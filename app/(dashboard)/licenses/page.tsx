'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  ExternalLink,
  X,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import {
  LicenseItem,
  DEFAULT_LICENSES,
  evaluateExpiry,
  formatToDMY,
  formatToYMD,
  ExpiryState,
} from '@/lib/compliance';

export default function OperatingLicensesPage() {
  const { isAdmin } = useAuth();
  const [licenses, setLicenses] = useState<LicenseItem[]>(DEFAULT_LICENSES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Thêm / Sửa giấy phép
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LicenseItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formIsPermanent, setFormIsPermanent] = useState(false);
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

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

  // Thống kê Radar Cảnh báo Hạn
  const radarStats = useMemo(() => {
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;

    licenses.forEach((lic) => {
      const ev = evaluateExpiry(lic.expiryDate);
      if (ev.state === 'EXPIRED') expired++;
      else if (ev.state === 'EXPIRING_SOON') expiringSoon++;
      else valid++;
    });

    return {
      total: licenses.length,
      valid,
      expiringSoon,
      expired,
    };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return licenses.filter((item) => {
      const ev = evaluateExpiry(item.expiryDate);
      if (radarFilter === 'VALID' && ev.state !== 'ACTIVE' && ev.state !== 'PERMANENT') return false;
      if (radarFilter === 'EXPIRING_SOON' && ev.state !== 'EXPIRING_SOON') return false;
      if (radarFilter === 'EXPIRED' && ev.state !== 'EXPIRED') return false;

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.licenseCode || '').toLowerCase().includes(q) ||
        item.expiryDate.toLowerCase().includes(q)
      );
    });
  }, [licenses, searchQuery, radarFilter]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCode('');
    setFormIsPermanent(false);
    setFormExpiryDate('');
    setFormFileUrl('');
    setFormFileName('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: LicenseItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.licenseCode || '');
    const isPerm = item.expiryDate.toLowerCase().includes('vô thời hạn');
    setFormIsPermanent(isPerm);
    setFormExpiryDate(isPerm ? '' : formatToYMD(item.expiryDate));
    setFormFileUrl(item.fileUrl || '');
    setFormFileName(item.fileName || '');
    setIsModalOpen(true);
  };

  const handleUploadFileInModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'licenses');

      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file thất bại');

      setFormFileUrl(data.fileUrl);
      setFormFileName(data.fileName || file.name);
      showToast('success', `Đã tải lên file "${file.name}"`);
    } catch (err: any) {
      showToast('error', err.message || 'Không thể tải file lên');
    } finally {
      setIsUploadingFile(false);
    }
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

      await persistLicenses(updated, `Đã đính kèm file "${file.name}" vào giấy phép!`);
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

    if (editingItem) {
      const updated = licenses.map((lic) =>
        lic.id === editingItem.id
          ? {
              ...lic,
              name: formName.trim(),
              licenseCode: formCode.trim() || undefined,
              expiryDate: finalExpiry,
              fileUrl: formFileUrl.trim() || undefined,
              fileName: formFileName.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : lic
      );
      await persistLicenses(updated, 'Đã cập nhật thông tin giấy phép!');
    } else {
      const newItem: LicenseItem = {
        id: `lic-${Date.now()}`,
        name: formName.trim(),
        licenseCode: formCode.trim() || undefined,
        expiryDate: finalExpiry,
        fileUrl: formFileUrl.trim() || undefined,
        fileName: formFileName.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await persistLicenses([newItem, ...licenses], 'Đã thêm giấy phép khai thác mới!');
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (item: LicenseItem) => {
    if (!confirm(`Bạn có chắc muốn xóa "${item.name}"?`)) return;
    const updated = licenses.filter((lic) => lic.id !== item.id);
    await persistLicenses(updated, `Đã xóa giấy phép "${item.name}".`);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Chuyển link Google Drive thông thường sang link embed preview nếu cần
  const getEmbedPreviewUrl = (url: string) => {
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    return url;
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/80 text-slate-800 font-sans overflow-y-auto p-6 space-y-4">
      {/* Input ẩn phục vụ đính kèm nhanh file giấy phép */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleQuickUploadChange}
      />

      {/* Top Pill Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a5f]" />
          <ShieldCheck className="w-4 h-4 text-rose-600" />
          <span className="text-sm font-bold text-slate-900">Giấy phép khai thác</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full ml-1">
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            Radar Cảnh báo Hạn tự động
          </span>
        </div>
        <div className="text-xs font-medium text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 capitalize">
          {todayStr}
        </div>
      </div>

      {/* Toast thông báo */}
      {toast && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between shadow-xs animate-in fade-in ${
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
            <span className="font-semibold">{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-[11px] font-semibold underline ml-3">
            Đóng
          </button>
        </div>
      )}

      {/* 4 Thẻ Radar Cảnh báo Hạn tự động (Bấm để lọc nhanh) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setRadarFilter('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            radarFilter === 'ALL'
              ? 'bg-[#1b3252] text-white border-[#1b3252] shadow-md'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
            Tổng số giấy phép
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.total}</span>
            <span className="text-xs font-normal opacity-75">giấy phép</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRadarFilter('VALID')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            radarFilter === 'VALID'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white hover:bg-emerald-50/40 border-emerald-200 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className={radarFilter === 'VALID' ? 'text-white' : 'text-emerald-700'}>
              Đang hiệu lực (&gt; 60 ngày)
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.valid}</span>
            <span className="text-xs font-normal opacity-75">an toàn</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRadarFilter('EXPIRING_SOON')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            radarFilter === 'EXPIRING_SOON'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md'
              : 'bg-white hover:bg-amber-50/50 border-amber-200 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className={radarFilter === 'EXPIRING_SOON' ? 'text-white' : 'text-amber-700'}>
              Sắp hết hạn (≤ 60 ngày)
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.expiringSoon}</span>
            <span className="text-xs font-normal opacity-75">cần chuẩn bị gia hạn</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRadarFilter('EXPIRED')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            radarFilter === 'EXPIRED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
              : 'bg-white hover:bg-rose-50/50 border-rose-200 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span className={radarFilter === 'EXPIRED' ? 'text-white' : 'text-rose-700'}>
              Đã quá hạn
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.expired}</span>
            <span className="text-xs font-normal opacity-75">cần xử lý ngay</span>
          </div>
        </button>
      </div>

      {/* Main Card Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Card Dark Navy Header */}
        <div className="bg-[#1b3252] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Giấy phép khai thác</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Quản lý, đính kèm bản scan PDF và tự động cảnh báo thời hạn giấy phép thiết bị, tần số
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm giấy phép, thời hạn..."
                className="bg-white text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-7 py-2 w-60 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={openAddModal}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm giấy phép mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#162944] text-slate-200 text-[11px] font-bold uppercase tracking-wider border-t border-slate-700/60">
                <th className="py-3.5 px-5 w-14">STT</th>
                <th className="py-3.5 px-5">TÊN GIẤY PHÉP</th>
                <th className="py-3.5 px-5 w-44 text-center">FILE ĐÍNH KÈM</th>
                <th className="py-3.5 px-5 w-40 text-center">THỜI HẠN</th>
                <th className="py-3.5 px-5 w-56 text-center">TÌNH TRẠNG (RADAR)</th>
                <th className="py-3.5 px-5 w-40 text-center">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-sky-600" />
                    Đang tải dữ liệu giấy phép...
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Không có giấy phép nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((item, idx) => {
                  const ev = evaluateExpiry(item.expiryDate);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-4 px-5 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {item.licenseCode && (
                          <span className="inline-block mt-0.5 font-mono text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {item.licenseCode}
                          </span>
                        )}
                      </td>

                      {/* Cột File đính kèm */}
                      <td className="py-4 px-5 text-center">
                        {item.fileUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold transition-colors cursor-pointer max-w-[170px]"
                            title={item.fileName || 'Xem file giấy phép đính kèm'}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.fileName || 'Bản scan PDF'}</span>
                          </button>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleQuickUploadTrigger(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-dashed border-slate-300 hover:border-indigo-300 text-[11px] font-medium transition-colors cursor-pointer"
                            title="Tải lên file PDF/Ảnh cho giấy phép này"
                          >
                            <Upload className="w-3 h-3" />
                            <span>+ Đính kèm file</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Chưa đính kèm</span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-center text-slate-700 font-mono font-semibold">
                        {item.expiryDate}
                      </td>

                      {/* Cột Tình trạng tự động (Compliance Radar) */}
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${ev.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${ev.dotClass}`} />
                          {ev.label}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              if (item.fileUrl) {
                                setPreviewItem(item);
                              } else if (isAdmin) {
                                handleQuickUploadTrigger(item.id);
                              } else {
                                showToast(
                                  'error',
                                  'Giấy phép này chưa được Admin đính kèm bản scan PDF.'
                                );
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              item.fileUrl
                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                            }`}
                            title={
                              item.fileUrl
                                ? 'Xem bản scan giấy phép'
                                : isAdmin
                                  ? 'Chưa có file — Bấm để tải file giấy phép lên'
                                  : 'Chưa có file đính kèm'
                            }
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors cursor-pointer"
                                title="Chỉnh sửa & cập nhật file (Admin)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Xóa giấy phép (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs text-slate-500">
          <span>
            Hiển thị {filteredLicenses.length} / {licenses.length} giấy phép khai thác
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 disabled:opacity-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button className="w-7 h-7 rounded-lg bg-[#1b3252] text-white font-semibold flex items-center justify-center text-xs shadow-2xs">
              1
            </button>
            <button
              disabled
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 disabled:opacity-50"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh sửa Giấy phép khai thác */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold">
                  {editingItem ? 'Chỉnh sửa Giấy phép khai thác' : 'Thêm Giấy phép khai thác mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tên giấy phép khai thác <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Giấy phép sử dụng tần số và thiết bị vô tuyến điện (DVOR/DME)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Số giấy phép / Mã ký hiệu
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="VD: 125/GP-CTS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Thời hạn hiệu lực
                  </label>
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

              {/* Đính kèm file PDF / Ảnh giấy phép */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                    <span>File Giấy phép đính kèm (PDF / Ảnh bản scan)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer transition-colors shadow-2xs">
                    {isUploadingFile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tải lên...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Chọn file từ máy</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleUploadFileInModal}
                      disabled={isUploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {formFileUrl ? (
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-emerald-200 text-emerald-800">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium truncate">
                        {formFileName || 'Đã đính kèm file giấy phép'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormFileUrl('');
                        setFormFileName('');
                      }}
                      className="text-rose-600 hover:underline text-[11px] font-semibold ml-2 shrink-0"
                    >
                      Gỡ file
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formFileUrl}
                    onChange={(e) => {
                      setFormFileUrl(e.target.value);
                      if (!formFileName) setFormFileName('File Google Drive / Link');
                    }}
                    placeholder="Hoặc dán trực tiếp đường link file PDF / Google Drive vào đây..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingFile}
                  className="px-5 py-2 rounded-xl bg-[#1b3252] hover:bg-slate-800 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : editingItem ? 'Lưu thay đổi' : 'Thêm giấy phép'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem trước File Giấy phép (PDF / Ảnh) */}
      {previewItem && previewItem.fileUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
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
