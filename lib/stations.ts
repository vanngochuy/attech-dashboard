/**
 * Danh sách Đài trạm dẫn đường & Giám sát CNS/ATM thực tế của ATTECH
 * Trích xuất chuẩn xác theo Công văn số 1726/KTQLB-KTATCL (VATM/ATTECH)
 */
export const ATTECH_STATIONS = [
  'Đài DVOR/DME Tuy Hòa',
  'Đài DVOR/DME & ADS-B Nội Bài',
  'Đài DVOR/DME Đầu Tây Nội Bài',
  'Đài DVOR/DME VÀ NDB Nam Hà',
  'Đài DVOR/DME & ADS-B Vinh',
  'Đài DVOR/DME & ADS-B Đồng Hới',
  'Đài DVOR/DME & ADS-B Cát Bi',
  'Đài DVOR/DME & ADS-B Điện Biên',
  'Đài DVOR/DME & ADS-B Đà Nẵng',
  'Đài DVOR/DME Phú Bài',
  'Đài DVOR/DME Phù Cát',
  'Đài DVOR/DME & ADS-B Cam Ranh',
  'Đài DVOR/DME Liên Khương',
  'Đài DVOR/DME Phú Quốc',
  'Đài DVOR/DME Buôn Ma Thuột',
  'Đài DVOR/DME Tân Sơn Nhất',
  'Đài DVOR/DME Long Thành',
  'Đài NDB Long Khánh',
  'Đài CVOR/DME Phan Thiết',
  'Đài DVOR/DME Cần Thơ',
  'Trạm CNS Côn Sơn',
  'Đài DVOR/DME Pleiku',
  'Đài DVOR/DME Rạch Giá',
  'Đài DVOR/DME & ADS-B Thọ Xuân',
  'Đài DVOR/DME Chu Lai',
  'Đài DVOR/DME Vân Đồn',
  'Đài DVOR/DME Cà Mau',
  'Trạm VHF Song Tử Tây (Quần đảo Trường Sa)',
  'Trạm VHF Trường Sa Lớn (Quần đảo Trường Sa)',
  'Trạm VHF Đất Mũi (Hòn Khoai)',
  'Trạm CNS Thổ Chu / Giàn khoan',
  'Khối Cơ quan Công ty (Toàn hệ thống)',
] as const;

export type AttechStation = typeof ATTECH_STATIONS[number];

/**
 * Danh sách nhân sự được cấp quyền tại Đài DVOR/DME Tuy Hòa
 * Gồm: huyvn, hainh, linhct, hoanglm / Mật khẩu: 1234
 */
export const TUY_HOA_STAFF_ACCOUNTS: Record<string, { fullName: string; defaultPass: string }> = {
  huyvn: { fullName: 'Văn Ngọc Huy (huyvn)', defaultPass: '1234' },
  hainh: { fullName: 'Nguyễn Hữu Hải (hainh)', defaultPass: '1234' },
  linhct: { fullName: 'Cao Thùy Linh (linhct)', defaultPass: '1234' },
  hoanglm: { fullName: 'Lê Minh Hoàng (hoanglm)', defaultPass: '1234' },
};
