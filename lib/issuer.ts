// Rút gọn tên đơn vị ban hành để hiển thị gọn trên giao diện (tên đầy đủ hiện khi rê chuột)
const ISSUER_ABBREVIATIONS: { match: RegExp; short: string }[] = [
  { match: /cục\s*hàng\s*không(?:\s*việt\s*nam)?|\bcaav\b|\bchkvn\b|\bchk\b/i, short: 'CHK' },
  { match: /tổng\s*công\s*ty\s*quản\s*lý\s*bay|\bvatm\b/i, short: 'VATM' },
  { match: /kỹ\s*thuật\s*quản\s*lý\s*bay|\bktqlb\b|\battech\b/i, short: 'ATTECH' },
];

export function abbreviateIssuer(name?: string | null): string {
  const full = (name || '').trim();
  if (!full) return '---';
  for (const rule of ISSUER_ABBREVIATIONS) {
    if (rule.match.test(full)) return rule.short;
  }
  return full;
}

