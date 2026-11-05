'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';

interface LicenseItem {
  id: number;
  name: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED';
}

const INITIAL_LICENSES: LicenseItem[] = [
  {
    id: 1,
    name: 'Giấy phép sử dụng AW 2.4GHz',
    expiryDate: '01/06/2027',
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'Giấy phép sử dụng Avalan 5GHz',
    expiryDate: '24/01/2028',
    status: 'ACTIVE',
  },
  {
    id: 3,
    name: 'Giấy phép sử dụng tần số và thiết bị vô tuyến điện (DVOR/DME)',
    expiryDate: '27/02/2028',
    status: 'ACTIVE',
  },
  {
    id: 4,
    name: 'GCN khai thác VOR/DME TUH 27/07/2025',
    expiryDate: 'Vô thời hạn',
    status: 'ACTIVE',
  },
  {
    id: 5,
    name: 'Giấy phép Khai thác cơ sở CCDV BĐHĐB',
    expiryDate: 'Vô thời hạn',
    status: 'ACTIVE',
  },
];

export default function OperatingLicensesPage() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const filteredLicenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return INITIAL_LICENSES;
    return INITIAL_LICENSES.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.expiryDate.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const showPendingDevToast = (actionLabel: string) => {
    setDevNotice(`Tính năng "${actionLabel}" đang ở chế độ giao diện mẫu (chờ phát triển tích hợp dữ liệu ở giai đoạn tiếp theo).`);
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
      {/* Top Pill Header (Giống mẫu ảnh 1) */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a5f]" />
          <ShieldCheck className="w-4 h-4 text-rose-600" />
          <span className="text-sm font-bold text-slate-900">Giấy phép khai thác</span>
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
        {/* Card Dark Navy Header (Theo đúng mẫu ảnh 1) */}
        <div className="bg-[#1b3252] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Giấy phép khai thác</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Quản lý và tra cứu các giấy phép khai thác thiết bị, tần số của đơn vị
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm giấy phép..."
                className="bg-white text-slate-900 placeholder-slate-400 text-xs rounded-full pl-8 pr-4 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-xs"
              />
            </div>

            {isAdmin && (
              <button
                onClick={() => showPendingDevToast('Thêm giấy phép mới')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer shrink-0"
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
                <th className="py-3.5 px-5 w-16">STT</th>
                <th className="py-3.5 px-5">TÊN GIẤY PHÉP</th>
                <th className="py-3.5 px-5 w-44 text-center">THỜI HẠN</th>
                <th className="py-3.5 px-5 w-44 text-center">TÌNH TRẠNG</th>
                <th className="py-3.5 px-5 w-40 text-center">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLicenses.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                  <td className="py-4 px-5 text-slate-500 font-medium">{idx + 1}</td>
                  <td className="py-4 px-5 font-semibold text-slate-800">{item.name}</td>
                  <td className="py-4 px-5 text-center text-slate-600 font-medium">
                    {item.expiryDate}
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Đang hiệu lực
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => showPendingDevToast(`Xem chi tiết: ${item.name}`)}
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                        title="Xem giấy phép"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => showPendingDevToast(`Chỉnh sửa: ${item.name}`)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors cursor-pointer"
                            title="Chỉnh sửa (Admin)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => showPendingDevToast(`Xóa: ${item.name}`)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Xóa (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs text-slate-500">
          <span>
            Hiển thị 1-{filteredLicenses.length} của {filteredLicenses.length} giấy phép
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
    </div>
  );
}

