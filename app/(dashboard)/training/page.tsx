'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  Search,
  Plus,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Upload,
  FileText,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import {
  StaffTrainingRecord,
  CertificateRow,
  DEFAULT_TRAINING_RECORDS,
  evaluateExpiry,
  formatToDMY,
  formatToYMD,
} from '@/lib/compliance';

export default function TrainingRecordsPage() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<StaffTrainingRecord[]>(DEFAULT_TRAINING_RECORDS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Thêm / Sửa nhân viên & danh sách chứng chỉ
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffTrainingRecord | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formCerts, setFormCerts] = useState<CertificateRow[]>([]);
  const [uploadingCertIdx, setUploadingCertIdx] = useState<number | null>(null);

  // Upload nhanh file chứng chỉ trực tiếp từ bảng
  const quickUploadInputRef = useRef<HTMLInputElement>(null);
  const [quickTarget, setQuickTarget] = useState<{ staffId: string; certId: string } | null>(null);

  // Modal Xem trước file chứng chỉ
  const [previewCert, setPreviewCert] = useState<{
    staffName: string;
    cert: CertificateRow;
  } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTrainingRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/compliance?type=training', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.training)) {
        setRecords(data.training);
      }
    } catch (err) {
      console.error('Lỗi tải hồ sơ huấn luyện:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainingRecords();
  }, []);

  const persistRecords = async (updated: StaffTrainingRecord[], successMsg: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'training', records: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu dữ liệu');
      setRecords(updated);
      showToast('success', successMsg);
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi lưu lên Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  // Thống kê Radar Cảnh báo Hạn trên toàn bộ chứng chỉ của nhân viên
  const radarStats = useMemo(() => {
    let totalCerts = 0;
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;

    records.forEach((staff) => {
      staff.certificates.forEach((cert) => {
        totalCerts++;
        const ev = evaluateExpiry(cert.toDate);
        if (ev.state === 'EXPIRED') expired++;
        else if (ev.state === 'EXPIRING_SOON') expiringSoon++;
        else valid++;
      });
    });

    return {
      staffCount: records.length,
      totalCerts,
      valid,
      expiringSoon,
      expired,
    };
  }, [records]);

  // Lọc danh sách nhân viên và chứng chỉ theo từ khóa & bộ lọc Radar
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return records
      .map((staff) => {
        const matchesStaffInfo =
          !q ||
          staff.fullName.toLowerCase().includes(q) ||
          staff.jobTitle.toLowerCase().includes(q);

        const filteredCerts = staff.certificates.filter((cert) => {
          const ev = evaluateExpiry(cert.toDate);
          if (radarFilter === 'VALID' && ev.state !== 'ACTIVE' && ev.state !== 'PERMANENT')
            return false;
          if (radarFilter === 'EXPIRING_SOON' && ev.state !== 'EXPIRING_SOON') return false;
          if (radarFilter === 'EXPIRED' && ev.state !== 'EXPIRED') return false;

          if (!q || matchesStaffInfo) return true;
          return (
            cert.certName.toLowerCase().includes(q) ||
            cert.fromDate.toLowerCase().includes(q) ||
            cert.toDate.toLowerCase().includes(q) ||
            (cert.reason || '').toLowerCase().includes(q)
          );
        });

        return {
          ...staff,
          certificates: filteredCerts,
        };
      })
      .filter((staff) => staff.certificates.length > 0);
  }, [records, searchQuery, radarFilter]);

  const openAddStaffModal = () => {
    setEditingStaff(null);
    setFormFullName('');
    setFormJobTitle('Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát');
    setFormCerts([
      { id: `c-${Date.now()}-1`, certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { id: `c-${Date.now()}-2`, certName: 'CN ANHK', fromDate: '26/07/2023', toDate: '26/07/2026' },
      { id: `c-${Date.now()}-3`, certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: `c-${Date.now()}-4`, certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: '' },
    ]);
    setIsModalOpen(true);
  };

  const openEditStaffModal = (staff: StaffTrainingRecord) => {
    const fullStaff = records.find((r) => r.id === staff.id) || staff;
    setEditingStaff(fullStaff);
    setFormFullName(fullStaff.fullName);
    setFormJobTitle(fullStaff.jobTitle);
    setFormCerts(fullStaff.certificates.map((c) => ({ ...c })));
    setIsModalOpen(true);
  };

  const handleCertFieldChange = (
    idx: number,
    field: keyof CertificateRow,
    value: string
  ) => {
    setFormCerts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const handleAddCertRow = () => {
    setFormCerts((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}-${prev.length + 1}`,
        certName: '',
        fromDate: '',
        toDate: '',
        reason: '',
      },
    ]);
  };

  const handleRemoveCertRow = (idx: number) => {
    if (formCerts.length <= 1) return;
    setFormCerts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadCertFileInModal = async (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingCertIdx(idx);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'training');

      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file thất bại');

      setFormCerts((prev) =>
        prev.map((c, i) =>
          i === idx
            ? { ...c, fileUrl: data.fileUrl, fileName: data.fileName || file.name }
            : c
        )
      );
      showToast('success', `Đã tải lên file chứng chỉ "${file.name}"`);
    } catch (err: any) {
      showToast('error', err.message || 'Không thể tải file lên');
    } finally {
      setUploadingCertIdx(null);
    }
  };

  const handleQuickUploadTrigger = (staffId: string, certId: string) => {
    setQuickTarget({ staffId, certId });
    quickUploadInputRef.current?.click();
  };

  const handleQuickUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = quickTarget;
    e.target.value = '';
    if (!file || !target) return;

    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'training');

      const res = await fetch('/api/compliance', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải file thất bại');

      const updated = records.map((staff) => {
        if (staff.id !== target.staffId) return staff;
        return {
          ...staff,
          updatedAt: new Date().toISOString(),
          certificates: staff.certificates.map((c) =>
            c.id === target.certId
              ? {
                  ...c,
                  fileUrl: data.fileUrl,
                  fileName: data.fileName || file.name,
                }
              : c
          ),
        };
      });

      await persistRecords(updated, `Đã đính kèm file "${file.name}" vào hồ sơ huấn luyện!`);
    } catch (err: any) {
      showToast('error', err.message || 'Không thể đính kèm file');
    } finally {
      setIsSaving(false);
      setQuickTarget(null);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim()) {
      showToast('error', 'Vui lòng nhập họ và tên nhân viên.');
      return;
    }

    const cleanedCerts = formCerts
      .filter((c) => c.certName.trim() !== '')
      .map((c) => ({
        ...c,
        certName: c.certName.trim(),
        fromDate: formatToDMY(c.fromDate),
        toDate: formatToDMY(c.toDate),
      }));

    if (cleanedCerts.length === 0) {
      showToast('error', 'Vui lòng nhập ít nhất 1 chứng chỉ/giấy phép.');
      return;
    }

    if (editingStaff) {
      const updated = records.map((r) =>
        r.id === editingStaff.id
          ? {
              ...r,
              fullName: formFullName.trim(),
              jobTitle: formJobTitle.trim(),
              certificates: cleanedCerts,
              updatedAt: new Date().toISOString(),
            }
          : r
      );
      await persistRecords(updated, `Đã cập nhật hồ sơ của ${formFullName.trim()}!`);
    } else {
      const newStaff: StaffTrainingRecord = {
        id: `staff-${Date.now()}`,
        fullName: formFullName.trim(),
        jobTitle: formJobTitle.trim(),
        certificates: cleanedCerts,
        updatedAt: new Date().toISOString(),
      };
      await persistRecords([...records, newStaff], `Đã thêm nhân viên ${formFullName.trim()}!`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteStaff = async (staff: StaffTrainingRecord) => {
    if (!confirm(`Bạn có chắc muốn xóa hồ sơ huấn luyện của "${staff.fullName}"?`)) return;
    const updated = records.filter((r) => r.id !== staff.id);
    await persistRecords(updated, `Đã xóa hồ sơ của "${staff.fullName}".`);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getEmbedPreviewUrl = (url: string) => {
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    return url;
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/80 text-slate-800 font-sans overflow-y-auto p-6 space-y-4">
      {/* Input ẩn phục vụ upload nhanh file chứng chỉ */}
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
          <GraduationCap className="w-4 h-4 text-slate-800" />
          <span className="text-sm font-bold text-slate-900">Hồ sơ huấn luyện</span>
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

      {/* 4 Thẻ Radar Cảnh báo Hạn Chứng chỉ (Bấm để lọc nhanh) */}
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
            Tổng nhân sự &amp; Chứng chỉ
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.staffCount}</span>
            <span className="text-xs font-normal opacity-75">
              nhân viên ({radarStats.totalCerts} GP/CC)
            </span>
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
            <span className="text-xs font-normal opacity-75">chứng chỉ đạt chuẩn</span>
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
            <span className="text-xs font-normal opacity-75">cần đăng ký học lại</span>
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
              Đã quá hạn GP/CC
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-1 flex items-baseline gap-1.5">
            <span>{radarStats.expired}</span>
            <span className="text-xs font-normal opacity-75">chứng chỉ quá hạn</span>
          </div>
        </button>
      </div>

      {/* Main Card Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Card Dark Navy Header */}
        <div className="bg-[#1b3252] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Hồ sơ huấn luyện &amp; Chứng chỉ</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Theo dõi năng định, đính kèm bản scan chứng chỉ và tự động cảnh báo thời hạn nghiệp vụ của nhân viên
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhân viên, chứng chỉ..."
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
                onClick={openAddStaffModal}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm nhân viên mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-row Grouped Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#162944] text-slate-200 text-[11px] font-bold uppercase tracking-wider border-t border-slate-700/60">
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-44">
                  HỌ VÀ TÊN
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-52">
                  CHỨC DANH CÔNG VIỆC
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60">
                  GP/CC THEO YÊU CẦU
                </th>
                <th
                  colSpan={3}
                  className="py-2 px-4 text-center border-b border-r border-slate-700/60"
                >
                  THỜI HẠN GP/CC &amp; RADAR CẢNH BÁO
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-36 text-center">
                  FILE HỒ SƠ
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-48">
                  LÝ DO CHƯA ĐÁP ỨNG GP/CC
                </th>
                {isAdmin && (
                  <th rowSpan={2} className="py-3 px-4 text-center w-24">
                    HÀNH ĐỘNG
                  </th>
                )}
              </tr>
              <tr className="bg-[#162944] text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2 px-3 text-center border-r border-slate-700/60 w-24">
                  TỪ NGÀY
                </th>
                <th className="py-2 px-3 text-center border-r border-slate-700/60 w-24">
                  ĐẾN NGÀY
                </th>
                <th className="py-2 px-3 text-center border-r border-slate-700/60 w-36">
                  TRẠNG THÁI HẠN
                </th>
              </tr>
            </thead>

            <tbody className="text-xs divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-sky-600" />
                    Đang tải hồ sơ huấn luyện...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-500">
                    Không có hồ sơ huấn luyện nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((staff, staffIdx) => {
                  const rowCount = staff.certificates.length;
                  const groupBg = staffIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

                  return staff.certificates.map((cert, certIdx) => {
                    const ev = evaluateExpiry(cert.toDate);
                    return (
                      <tr
                        key={`${staff.id}-${cert.id || certIdx}`}
                        className={`${groupBg} hover:bg-indigo-50/30 transition-colors border-b border-slate-100`}
                      >
                        {certIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            className="py-4 px-4 font-bold text-slate-900 align-middle border-r border-slate-200"
                          >
                            {staff.fullName}
                          </td>
                        )}

                        {certIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            className="py-4 px-4 text-slate-600 align-middle border-r border-slate-200 leading-relaxed"
                          >
                            {staff.jobTitle}
                          </td>
                        )}

                        <td className="py-3 px-4 font-semibold text-slate-800 border-r border-slate-100">
                          {cert.certName}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 font-mono border-r border-slate-100">
                          {cert.fromDate}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-800 font-mono font-semibold border-r border-slate-100">
                          {cert.toDate}
                        </td>

                        {/* Trạng thái Radar Cảnh báo Hạn */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${ev.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${ev.dotClass}`} />
                            {ev.shortLabel}
                          </span>
                        </td>

                        {/* Cột File Hồ sơ / Chứng chỉ */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <div className="flex items-center justify-center gap-1">
                            {cert.fileUrl ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewCert({ staffName: staff.fullName, cert })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-semibold transition-colors cursor-pointer max-w-[110px]"
                                  title={cert.fileName || 'Xem bản scan chứng chỉ'}
                                >
                                  <Eye className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Xem file</span>
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickUploadTrigger(staff.id, cert.id)}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600"
                                    title="Đổi file chứng chỉ khác"
                                  >
                                    <Upload className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            ) : isAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleQuickUploadTrigger(staff.id, cert.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-dashed border-slate-300 hover:border-indigo-300 text-[10px] font-medium transition-colors cursor-pointer"
                                title="Đính kèm file PDF/Ảnh chứng chỉ này"
                              >
                                <Upload className="w-3 h-3" />
                                <span>+ Đính kèm</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">---</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 border-r border-slate-100">
                          {cert.reason ? (
                            <span className="text-slate-700">{cert.reason}</span>
                          ) : ev.state === 'EXPIRED' ? (
                            <span className="text-rose-600 font-medium text-[11px]">
                              Chứng chỉ đã hết hạn — Cần cập nhật/học lại
                            </span>
                          ) : (
                            ''
                          )}
                        </td>

                        {isAdmin && certIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            className="py-4 px-3 align-middle text-center border-l border-slate-200"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditStaffModal(staff)}
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors cursor-pointer"
                                title="Chỉnh sửa hồ sơ & chứng chỉ (Admin)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Xóa hồ sơ nhân viên (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh sửa Hồ sơ Huấn luyện Nhân viên */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold">
                  {editingStaff
                    ? `Chỉnh sửa Hồ sơ Huấn luyện: ${editingStaff.fullName}`
                    : 'Thêm Hồ sơ Nhân viên mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Họ và tên nhân viên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="VD: Lê Minh Hoàng"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Chức danh công việc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formJobTitle}
                    onChange={(e) => setFormJobTitle(e.target.value)}
                    placeholder="VD: Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              {/* Danh sách Chứng chỉ / Giấy phép của nhân viên */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Danh mục Giấy phép / Chứng chỉ (GP/CC)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCertRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm dòng GP/CC</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formCerts.map((cert, idx) => (
                    <div
                      key={cert.id || idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Tên GP/CC theo yêu cầu
                        </label>
                        <input
                          type="text"
                          value={cert.certName}
                          onChange={(e) =>
                            handleCertFieldChange(idx, 'certName', e.target.value)
                          }
                          placeholder="VD: NĐ DVOR/DME"
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Từ ngày
                        </label>
                        <input
                          type="date"
                          value={formatToYMD(cert.fromDate)}
                          onChange={(e) =>
                            handleCertFieldChange(idx, 'fromDate', formatToDMY(e.target.value))
                          }
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-[11px]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Đến ngày
                        </label>
                        <input
                          type="date"
                          value={formatToYMD(cert.toDate)}
                          onChange={(e) =>
                            handleCertFieldChange(idx, 'toDate', formatToDMY(e.target.value))
                          }
                          className="w-full px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-[11px]"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Lý do chưa đáp ứng (nếu có)
                        </label>
                        <input
                          type="text"
                          value={cert.reason || ''}
                          onChange={(e) =>
                            handleCertFieldChange(idx, 'reason', e.target.value)
                          }
                          placeholder="Ghi chú lý do..."
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end gap-1.5">
                        <label
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border font-semibold cursor-pointer transition-colors ${
                            cert.fileUrl
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-white hover:bg-sky-50 border-slate-300 text-slate-700'
                          }`}
                          title={cert.fileName || 'Đính kèm file PDF/Ảnh chứng chỉ'}
                        >
                          {uploadingCertIdx === idx ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span className="truncate text-[11px]">
                            {cert.fileUrl ? 'Đã có file' : 'Đính kèm'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => handleUploadCertFileInModal(idx, e)}
                            className="hidden"
                          />
                        </label>

                        {formCerts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCertRow(idx)}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                            title="Xóa dòng chứng chỉ này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || uploadingCertIdx !== null}
                  className="px-5 py-2 rounded-xl bg-[#1b3252] hover:bg-slate-800 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : editingStaff ? 'Lưu thay đổi' : 'Thêm nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem trước File Hồ sơ / Chứng chỉ (PDF / Ảnh) */}
      {previewCert && previewCert.cert.fileUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewCert(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold truncate">
                  {previewCert.staffName} — {previewCert.cert.certName}
                </span>
                <span className="text-xs font-mono text-sky-200 bg-white/10 px-2 py-0.5 rounded shrink-0">
                  Hạn: {previewCert.cert.fromDate} → {previewCert.cert.toDate}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewCert.cert.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở tab mới</span>
                </a>
                <button
                  onClick={() => setPreviewCert(null)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-900">
              {/\.(png|jpe?g|gif|webp)$/i.test(previewCert.cert.fileUrl) ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewCert.cert.fileUrl}
                    alt={previewCert.cert.certName}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <iframe
                  src={getEmbedPreviewUrl(previewCert.cert.fileUrl)}
                  className="w-full h-full border-none bg-white"
                  title={previewCert.cert.certName}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
