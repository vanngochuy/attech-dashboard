// Chuẩn hóa và rút gọn tên đơn vị ban hành hiển thị trên hệ thống (Tab Công việc, Tab Tài liệu, v.v.)
// Tên đầy đủ được giữ trong thuộc tính title để xem khi rê chuột

function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function abbreviateIssuer(name?: string | null): string {
  const full = (name || '').trim();
  if (!full) return '---';

  const normalized = normalizeVietnamese(full);

  // 1. ATTECH: Công ty TNHH Kỹ thuật Quản lý bay (và các biến thể như có dấu 2 chấm, viết tắt KTQLB, ATTECH)
  // Ưu tiên kiểm tra trước VATM vì ATTECH là đơn vị trực thuộc VATM, một số văn bản ghi cả 2 đơn vị
  if (
    normalized.includes('ky thuat quan ly bay') ||
    normalized.includes('ky thuat quan ly bay') ||
    /\b(attech|ktqlb)\b/i.test(normalized) ||
    /kỹ\s*thuật\s*quản\s*lý[:\s]*bay|\battech\b|\bktqlb\b/i.test(full)
  ) {
    return 'ATTECH';
  }

  // 2. CHK: Cục Hàng không Việt Nam (CAAV / CHK / CHKVN)
  if (
    normalized.includes('cuc hang khong') ||
    /\b(caav|chkvn|chk)\b/i.test(normalized) ||
    /cục\s*hàng\s*không(?:\s*việt\s*nam)?|\bcaav\b|\bchkvn\b|\bchk\b/i.test(full)
  ) {
    return 'CHK';
  }

  // 3. VATM: Tổng công ty Quản lý bay Việt Nam (VATM)
  if (
    normalized.includes('tong cong ty quan ly bay') ||
    normalized.includes('quan ly bay vn') ||
    normalized.includes('quan ly bay viet nam') ||
    normalized.includes('quan ly bay') ||
    /\bvatm\b/i.test(normalized) ||
    /tổng\s*công\s*ty\s*(?:quản\s*lý\s*bay)?|\bvatm\b/i.test(full)
  ) {
    return 'VATM';
  }

  return full;
}
