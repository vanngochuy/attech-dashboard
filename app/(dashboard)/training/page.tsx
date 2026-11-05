'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  Search,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Upload,
  FileText,
  ExternalLink,
  X,
  Loader2,
  RefreshCw,
  Database,
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
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

  // Lọc danh sách nhân viên và chứng chỉ theo từ khóa & bộ lọc trạng thái
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
          if (statusFilter === 'VALID' && ev.state !== 'ACTIVE' && ev.state !== 'PERMANENT')
            return false;
          if (statusFilter === 'EXPIRING_SOON' && ev.state !== 'EXPIRING_SOON') return false;
          if (statusFilter === 'EXPIRED' && ev.state !== 'EXPIRED') return false;

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
  }, [records, searchQuery, statusFilter]);

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

      await persistRecords(updated, `Đã đính kèm file "${file.name}"!`);
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

      {/* Input ẩn phục vụ upload nhanh file chứng chỉ */}
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
            <GraduationCap className="w-4 h-4 text-white" />
            <span>Hồ sơ Huấn luyện &amp; Chứng chỉ Nghiệp vụ</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <div className="hidden md:flex items-center gap-1.5 bg-white/40 backdrop-blur-[35px] px-2.5 py-1.5 rounded-lg border border-white/60 text-xs text-[#0f2043] shadow-xs">
              <span className="p-0.5 rounded bg-white/50 border border-white/60 text-sky-700">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <span className="text-[#0f2043] font-semibold">Drive:</span>
              <span className="text-[#0f2043] font-bold font-mono">01_CHỨNG CHỈ</span>
            </div>

            <button
              onClick={fetchTrainingRecords}
              disabled={isLoading}
              className="p-2 bg-white/40 hover:bg-white/55 border border-white/60 hover:border-white/80 text-[#0f2043] rounded-lg transition-colors backdrop-blur-[35px] shadow-xs disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {isAdmin && (
              <button
                onClick={openAddStaffModal}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b3252] hover:bg-slate-900 active:scale-95 text-white border border-white/25 rounded-lg text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm nhân viên</span>
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
            <span>Danh sách hồ sơ huấn luyện</span>
            <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
              {filteredRecords.length}/{records.length} nhân viên
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
              placeholder="Tìm theo tên nhân viên, chức danh, chứng chỉ..."
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
            <span>Đang tải hồ sơ huấn luyện...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
              <GraduationCap className="w-6 h-6 text-sky-600" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">
              Không tìm thấy hồ sơ huấn luyện phù hợp
            </h4>
            <p className="text-slate-500 text-xs max-w-sm">
              Hãy thử từ khóa khác hoặc đặt lại bộ lọc trạng thái.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl bg-white shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 shadow-2xs">
                <tr>
                  <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200 w-44 rounded-tl-xl">
                    HỌ VÀ TÊN
                  </th>
                  <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200 w-52">
                    CHỨC DANH CÔNG VIỆC
                  </th>
                  <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200">
                    GP/CC THEO YÊU CẦU
                  </th>
                  <th
                    colSpan={2}
                    className="py-1.5 px-3 text-center border-b border-r border-slate-200"
                  >
                    THỜI HẠN GP/CC
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200 w-36 text-center">
                    HIỆU LỰC
                  </th>
                  <th rowSpan={2} className="py-2.5 px-4 border-r border-slate-200 w-48">
                    LÝ DO CHƯA ĐÁP ỨNG GP/CC
                  </th>
                  <th rowSpan={2} className="py-2.5 px-3 text-center w-24 rounded-tr-xl">
                    THAO TÁC
                  </th>
                </tr>
                <tr className="text-[10px] text-slate-600">
                  <th className="py-1.5 px-3 text-center border-r border-slate-200 w-24">
                    TỪ NGÀY
                  </th>
                  <th className="py-1.5 px-3 text-center border-r border-slate-200 w-24">
                    ĐẾN NGÀY
                  </th>
                </tr>
              </thead>

              <tbody className="text-xs divide-y divide-slate-200">
                {filteredRecords.map((staff, staffIdx) => {
                  const rowCount = staff.certificates.length;
                  const groupBg = staffIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

                  return staff.certificates.map((cert, certIdx) => {
                    const ev = evaluateExpiry(cert.toDate);
                    return (
                      <tr
                        key={`${staff.id}-${cert.id || certIdx}`}
                        className={`${groupBg} hover:bg-slate-50 transition-colors border-b border-slate-100`}
                      >
                        {certIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            className="py-3.5 px-4 font-bold text-slate-900 align-middle border-r border-slate-200"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{staff.fullName}</span>
                              {isAdmin && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => openEditStaffModal(staff)}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                                    title="Sửa hồ sơ nhân viên"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStaff(staff)}
                                    className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Xóa nhân viên"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {certIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            className="py-3.5 px-4 text-slate-600 align-middle border-r border-slate-200 leading-relaxed"
                          >
                            {staff.jobTitle}
                          </td>
                        )}

                        <td className="py-2.5 px-4 font-semibold text-slate-800 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            <FileText
                              className={`w-3.5 h-3.5 shrink-0 ${
                                cert.fileUrl ? 'text-indigo-600' : 'text-slate-400'
                              }`}
                            />
                            <span>{cert.certName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 font-mono border-r border-slate-100">
                          {cert.fromDate}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-800 font-mono font-medium border-r border-slate-100">
                          {cert.toDate}
                        </td>

                        {/* Trạng thái hiệu lực gọn giống tab Tài liệu */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-100">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${ev.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${ev.dotClass}`} />
                            {ev.shortLabel}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-slate-600 border-r border-slate-100">
                          {cert.reason || ''}
                        </td>

                        {/* Cột Thao tác gọn (Chỉ dùng icon w-3.5 h-3.5) */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (cert.fileUrl) {
                                  setPreviewCert({ staffName: staff.fullName, cert });
                                } else if (isAdmin) {
                                  handleQuickUploadTrigger(staff.id, cert.id);
                                } else {
                                  showToast('error', 'Chứng chỉ này chưa có file đính kèm.');
                                }
                              }}
                              className={`p-1.5 rounded transition-colors cursor-pointer ${
                                cert.fileUrl
                                  ? 'hover:bg-indigo-50 text-indigo-600'
                                  : 'hover:bg-slate-100 text-slate-400'
                              }`}
                              title={
                                cert.fileUrl
                                  ? `Xem file: ${cert.fileName || cert.certName}`
                                  : 'Chưa có file đính kèm'
                              }
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleQuickUploadTrigger(staff.id, cert.id)}
                                className="p-1.5 rounded hover:bg-sky-50 text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
                                title={
                                  cert.fileUrl
                                    ? `Đổi file chứng chỉ (${cert.fileName || 'Đã có file'})`
                                    : 'Đính kèm file PDF/Ảnh chứng chỉ'
                                }
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Thêm / Chỉnh sửa Hồ sơ Huấn luyện Nhân viên */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-400" />
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
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
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

      {/* Modal Xem trước File Hồ sơ / Chứng chỉ */}
      {previewCert && previewCert.cert.fileUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewCert(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-[#1b3252] text-white flex items-center justify-between shrink-0">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
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
