/**
 * Danh sách 24 Đơn vị / Đài trạm CNS theo quy chuẩn thực tế của hệ thống ATTECH
 * Trích xuất chuẩn xác theo danh mục phân quyền và biên chế tại các Đài trạm
 */
export const ATTECH_STATIONS = [
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
  'Đài NDB Long Khánh',
  'Đài CVOR/DME Phan Thiết',
  'Đài DVOR/DME Cần Thơ',
  'Trạm CNS Côn Sơn',
  'Đài DVOR/DME Pleiku',
  'Đài DVOR/DME Rạch Giá',
  'Đài DVOR/DME & ADS-B Thọ Xuân',
  'Đài DVOR/DME Chu Lai',
  'Đài DVOR/DME Tuy Hòa',
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
