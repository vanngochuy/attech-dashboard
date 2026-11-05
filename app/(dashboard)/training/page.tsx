'use client';

import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Search,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

interface CertificateRow {
  certName: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

interface StaffTrainingRecord {
  id: number;
  fullName: string;
  jobTitle: string;
  certificates: CertificateRow[];
}

const INITIAL_TRAINING_RECORDS: StaffTrainingRecord[] = [
  {
    id: 1,
    fullName: 'Văn Ngọc Huy',
    jobTitle: 'Đài trưởng',
    certificates: [
      { certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { certName: 'CN ANHK', fromDate: '23/03/2022', toDate: '23/03/2025' },
      { certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024' },
    ],
  },
  {
    id: 2,
    fullName: 'Châu Trọng Linh',
    jobTitle: 'Nhân viên Kỹ thuật thông tin, dẫn đường, giám sát',
    certificates: [
      { certName: 'NĐ DVOR/DME', fromDate: '15/11/2025', toDate: '15/11/2027' },
      { certName: 'CN ANHK', fromDate: '19/05/2021', toDate: '19/05/2024' },
      { certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024' },
    ],
  },
  {
    id: 3,
    fullName: 'Lương Minh Tuấn',
    jobTitle: 'Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát',
    certificates: [
      { certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { certName: 'CN ANHK', fromDate: '28/07/2023', toDate: '28/07/2026' },
      { certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024' },
    ],
  },
  {
    id: 4,
    fullName: 'Nguyễn Hoàng Hải',
    jobTitle: 'Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát',
    certificates: [
      { certName: 'NĐ DVOR/DME', fromDate: '15/11/2025', toDate: '15/11/2027' },
      { certName: 'CN ANHK', fromDate: '26/07/2023', toDate: '26/07/2026' },
      { certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024' },
      { certName: 'CN HL KT,BD VOR', fromDate: '11/05/2026', toDate: '27/05/2026' },
    ],
  },
];

export default function TrainingRecordsPage() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return INITIAL_TRAINING_RECORDS;
    return INITIAL_TRAINING_RECORDS.filter(
      (rec) =>
        rec.fullName.toLowerCase().includes(q) ||
        rec.jobTitle.toLowerCase().includes(q) ||
        rec.certificates.some((c) => c.certName.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const showPendingDevToast = (actionLabel: string) => {
    setDevNotice(
      `Tính năng "${actionLabel}" đang ở chế độ giao diện mẫu (chờ phát triển tích hợp dữ liệu ở giai đoạn tiếp theo).`
    );
    setTimeout(() => setDevNotice(null), 4000);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full bg-slate-100/80 text-slate-800 font-sans overflow-y-auto p-6 space-y-5">
      {/* Top Pill Header (Giống mẫu ảnh 2) */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a5f]" />
          <GraduationCap className="w-4 h-4 text-slate-800" />
          <span className="text-sm font-bold text-slate-900">Hồ sơ huấn luyện</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full ml-2">
            <Clock className="w-3 h-3 text-amber-600" />
            Giao diện mẫu · Chờ phát triển
          </span>
        </div>
        <div className="text-xs font-medium text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 capitalize">
          {todayStr}
        </div>
      </div>

      {/* Thông báo khi bấm nút thao tác (Chờ dev sau) */}
      {devNotice && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-medium">{devNotice}</span>
          </div>
          <button
            onClick={() => setDevNotice(null)}
            className="text-[11px] font-semibold underline ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main Card Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Card Dark Navy Header (Theo đúng mẫu ảnh 2) */}
        <div className="bg-[#1b3252] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Hồ sơ huấn luyện &amp; Chứng chỉ</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Theo dõi năng định, giấy phép và thời hạn chứng chỉ nghiệp vụ của nhân viên
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm hồ sơ..."
                className="bg-white text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-xs"
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => showPendingDevToast('Thêm nhân viên mới')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0"
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
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-56">
                  CHỨC DANH CÔNG VIỆC
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60">
                  GP/CC THEO YÊU CẦU
                </th>
                <th
                  colSpan={2}
                  className="py-2 px-4 text-center border-b border-r border-slate-700/60"
                >
                  THỜI HẠN GP/CC
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-slate-700/60 w-52">
                  LÝ DO CHƯA ĐÁP ỨNG GP/CC
                </th>
                {isAdmin && (
                  <th rowSpan={2} className="py-3 px-4 text-center w-28">
                    HÀNH ĐỘNG
                  </th>
                )}
              </tr>
              <tr className="bg-[#162944] text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2 px-3 text-center border-r border-slate-700/60 w-28">
                  TỪ NGÀY
                </th>
                <th className="py-2 px-3 text-center border-r border-slate-700/60 w-28">
                  ĐẾN NGÀY
                </th>
              </tr>
            </thead>

            <tbody className="text-xs divide-y divide-slate-200">
              {filteredRecords.map((staff, staffIdx) => {
                const rowCount = staff.certificates.length;
                const groupBg = staffIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

                return staff.certificates.map((cert, certIdx) => (
                  <tr
                    key={`${staff.id}-${certIdx}`}
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
                    <td className="py-3 px-3 text-center text-slate-600 font-mono border-r border-slate-100">
                      {cert.toDate}
                    </td>
                    <td className="py-3 px-4 text-slate-500 border-r border-slate-100">
                      {cert.reason || ''}
                    </td>

                    {isAdmin && certIdx === 0 && (
                      <td
                        rowSpan={rowCount}
                        className="py-4 px-4 align-middle text-center border-l border-slate-200"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => showPendingDevToast(`Chỉnh sửa hồ sơ: ${staff.fullName}`)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors cursor-pointer"
                            title="Chỉnh sửa hồ sơ (Admin)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => showPendingDevToast(`Xóa hồ sơ: ${staff.fullName}`)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Xóa hồ sơ (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

