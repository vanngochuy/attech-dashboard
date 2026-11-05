export interface LicenseItem {
  id: string;
  name: string;
  licenseCode?: string;
  expiryDate: string; // 'DD/MM/YYYY', 'YYYY-MM-DD', hoặc 'Vô thời hạn'
  fileUrl?: string;
  fileName?: string;
  notes?: string;
  updatedAt?: string;
}

export interface CertificateRow {
  id: string;
  certName: string;
  fromDate: string; // 'DD/MM/YYYY'
  toDate: string;   // 'DD/MM/YYYY' hoặc 'Vô thời hạn'
  reason?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface StaffTrainingRecord {
  id: string;
  fullName: string;
  jobTitle: string;
  certificates: CertificateRow[];
  updatedAt?: string;
}

export type ExpiryState = 'PERMANENT' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';

export interface ExpiryEvaluation {
  state: ExpiryState;
  daysRemaining: number | null;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Chuyển chuỗi ngày 'DD/MM/YYYY' hoặc 'YYYY-MM-DD' thành đối tượng Date
 */
export function parseFlexibleDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed || trimmed.toLowerCase().includes('vô thời hạn')) return null;

  // Định dạng DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day, 23, 59, 59);
    if (!isNaN(d.getTime())) return d;
  }

  // Định dạng YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day, 23, 59, 59);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Chuyển đổi 'YYYY-MM-DD' sang 'DD/MM/YYYY' để hiển thị đồng nhất
 */
export function formatToDMY(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (trimmed.toLowerCase().includes('vô thời hạn')) return 'Vô thời hạn';
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[3].padStart(2, '0')}/${ymdMatch[2].padStart(2, '0')}/${ymdMatch[1]}`;
  }
  return trimmed;
}

/**
 * Chuyển đổi 'DD/MM/YYYY' sang 'YYYY-MM-DD' cho thẻ <input type="date">
 */
export function formatToYMD(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) return trimmed;
  return '';
}

/**
 * Đánh giá tự động tình trạng hạn sử dụng (Compliance & Expiry Radar)
 * Ngưỡng cảnh báo sớm mặc định: 60 ngày trước khi hết hạn
 */
export function evaluateExpiry(dateStr: string | undefined | null, warningDays = 60): ExpiryEvaluation {
  if (!dateStr || !dateStr.trim()) {
    return {
      state: 'UNKNOWN',
      daysRemaining: null,
      label: 'Chưa rõ hạn',
      shortLabel: 'Chưa rõ',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
      dotClass: 'bg-slate-400',
    };
  }

  if (dateStr.trim().toLowerCase().includes('vô thời hạn')) {
    return {
      state: 'PERMANENT',
      daysRemaining: null,
      label: 'Đang hiệu lực (Vô thời hạn)',
      shortLabel: 'Vô thời hạn',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300',
      dotClass: 'bg-sky-500',
    };
  }

  const target = parseFlexibleDate(dateStr);
  if (!target) {
    return {
      state: 'UNKNOWN',
      daysRemaining: null,
      label: 'Đang hiệu lực',
      shortLabel: 'Đang hiệu lực',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      dotClass: 'bg-emerald-500',
    };
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      state: 'EXPIRED',
      daysRemaining: days,
      label: `Đã quá hạn (${overdue} ngày)`,
      shortLabel: `Quá hạn ${overdue} ngày`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
      dotClass: 'bg-rose-500 animate-ping',
    };
  }

  if (days <= warningDays) {
    return {
      state: 'EXPIRING_SOON',
      daysRemaining: days,
      label: `Sắp hết hạn (Còn ${days} ngày)`,
      shortLabel: `Còn ${days} ngày`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-400',
      dotClass: 'bg-amber-500 animate-pulse',
    };
  }

  return {
    state: 'ACTIVE',
    daysRemaining: days,
    label: `Đang hiệu lực (Còn ${days} ngày)`,
    shortLabel: 'Đang hiệu lực',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-400',
    dotClass: 'bg-emerald-500',
  };
}

export const DEFAULT_LICENSES: LicenseItem[] = [
  {
    id: 'lic-1',
    name: 'Giấy phép sử dụng AW 2.4GHz',
    licenseCode: 'GP-AW-24',
    expiryDate: '01/06/2027',
  },
  {
    id: 'lic-2',
    name: 'Giấy phép sử dụng Avalan 5GHz',
    licenseCode: 'GP-AVALAN-5G',
    expiryDate: '24/01/2028',
  },
  {
    id: 'lic-3',
    name: 'Giấy phép sử dụng tần số và thiết bị vô tuyến điện (DVOR/DME)',
    licenseCode: 'GP-TS-DVORDME',
    expiryDate: '27/02/2028',
  },
  {
    id: 'lic-4',
    name: 'GCN khai thác VOR/DME TUH 27/07/2025',
    licenseCode: 'GCN-VORDME-TUH',
    expiryDate: 'Vô thời hạn',
  },
  {
    id: 'lic-5',
    name: 'Giấy phép Khai thác cơ sở CCDV BĐHĐB',
    licenseCode: 'GP-CCDV-BDHDB',
    expiryDate: 'Vô thời hạn',
  },
];

export const DEFAULT_TRAINING_RECORDS: StaffTrainingRecord[] = [
  {
    id: 'staff-1',
    fullName: 'Văn Ngọc Huy',
    jobTitle: 'Đài trưởng',
    certificates: [
      { id: 'c-1-1', certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { id: 'c-1-2', certName: 'CN ANHK', fromDate: '23/03/2022', toDate: '23/03/2025', reason: 'Đang chờ lịch học định kỳ lại' },
      { id: 'c-1-3', certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: 'c-1-4', certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: 'Chờ Công ty tổ chức huấn luyện định kỳ' },
    ],
  },
  {
    id: 'staff-2',
    fullName: 'Châu Trọng Linh',
    jobTitle: 'Nhân viên Kỹ thuật thông tin, dẫn đường, giám sát',
    certificates: [
      { id: 'c-2-1', certName: 'NĐ DVOR/DME', fromDate: '15/11/2025', toDate: '15/11/2027' },
      { id: 'c-2-2', certName: 'CN ANHK', fromDate: '19/05/2021', toDate: '19/05/2024', reason: 'Đang chờ lịch học định kỳ lại' },
      { id: 'c-2-3', certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: 'c-2-4', certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: 'Chờ Công ty tổ chức huấn luyện định kỳ' },
    ],
  },
  {
    id: 'staff-3',
    fullName: 'Lương Minh Tuấn',
    jobTitle: 'Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát',
    certificates: [
      { id: 'c-3-1', certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { id: 'c-3-2', certName: 'CN ANHK', fromDate: '28/07/2023', toDate: '28/07/2026' },
      { id: 'c-3-3', certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: 'c-3-4', certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: 'Chờ Công ty tổ chức huấn luyện định kỳ' },
    ],
  },
  {
    id: 'staff-4',
    fullName: 'Nguyễn Hoàng Hải',
    jobTitle: 'Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát',
    certificates: [
      { id: 'c-4-1', certName: 'NĐ DVOR/DME', fromDate: '15/11/2025', toDate: '15/11/2027' },
      { id: 'c-4-2', certName: 'CN ANHK', fromDate: '26/07/2023', toDate: '26/07/2026' },
      { id: 'c-4-3', certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: 'c-4-4', certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: 'Chờ Công ty tổ chức huấn luyện định kỳ' },
      { id: 'c-4-5', certName: 'CN HL KT,BD VOR', fromDate: '11/05/2026', toDate: '27/05/2026' },
    ],
  },
  {
    id: 'staff-5',
    fullName: 'Lê Minh Hoàng',
    jobTitle: 'Nhân viên Khai thác thiết bị thông tin, dẫn đường, giám sát',
    certificates: [
      { id: 'c-5-1', certName: 'NĐ DVOR/DME', fromDate: '01/07/2026', toDate: '01/07/2028' },
      { id: 'c-5-2', certName: 'CN ANHK', fromDate: '26/07/2023', toDate: '26/07/2026' },
      { id: 'c-5-3', certName: 'CN HL NVPC&CC', fromDate: '07/07/2026', toDate: '07/07/2031' },
      { id: 'c-5-4', certName: 'CN HLATVSLĐ (nhóm 6) / Thẻ ATLĐ', fromDate: '30/06/2022', toDate: '30/06/2024', reason: 'Chờ Công ty tổ chức huấn luyện định kỳ' },
    ],
  },
];

