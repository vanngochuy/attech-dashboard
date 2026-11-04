import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';

// Từ dừng hành chính phổ biến trong văn bản cơ quan nhà nước / doanh nghiệp hàng không
const ADMIN_STOPWORDS = new Set([
  'quyết', 'định', 'về', 'việc', 'vv', 'ban', 'hành', 'sửa', 'đổi', 'bổ', 'sung',
  'thay', 'thế', 'thành', 'lập', 'kiện', 'toàn', 'áp', 'dụng', 'triển', 'khai',
  'tổ', 'chức', 'thực', 'hiện', 'quy', 'trình', 'chế', 'hướng', 'dẫn', 'kế', 'hoạch',
  'thông', 'tư', 'nghị', 'luật', 'tại', 'các', 'cơ', 'sở', 'làm', 'thuộc', 'công', 'ty',
  'tnhh', 'kỹ', 'thuật', 'quản', 'lý', 'bay', 'tổng', 'cục', 'bộ', 'chi', 'nhánh',
  'đài', 'trạm', 'của', 'và', 'cho', 'năm', 'đối', 'với', 'trong', 'theo', 'một',
  'số', 'phê', 'duyệt', 'chấp', 'thuận', 'báo', 'cáo', 'biên', 'bản', 'chức', 'năng',
  'nhiệm', 'vụ', 'quyền', 'hạn', 'công', 'văn', 'thông', 'báo', 'tài', 'liệu',
  'sổ', 'tay', 'hồ', 'sơ', 'danh', 'mục', 'chuẩn', 'mẫu', 'phương', 'án'
]);

// Hàm chuẩn hóa tên cơ quan ban hành (xử lý từ viết tắt phổ biến)
function normalizeIssuer(issuer: string): string {
  const s = issuer.toLowerCase().trim();
  if (s.includes('ktqlb') || s.includes('kỹ thuật quản lý bay')) return 'ktqlb';
  if (s.includes('vatm') || s.includes('tổng công ty quản lý bay')) return 'vatm';
  if (s.includes('gtvt') || s.includes('giao thông vận tải')) return 'gtvt';
  if (s.includes('cục hk') || s.includes('hàng không')) return 'caa';
  return s;
}

// Mở rộng các từ viết tắt chuyên ngành phổ biến để so sánh chính xác nội dung thực
function expandAcronyms(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bpctt\s*&\s*tkcn\b/g, 'phòng chống thiên tai tìm kiếm cứu nạn')
    .replace(/\bpctt\b/g, 'phòng chống thiên tai')
    .replace(/\btkcn\b/g, 'tìm kiếm cứu nạn')
    .replace(/\bpccc\s*&\s*cnch\b/g, 'phòng cháy chữa cháy cứu nạn cứu hộ')
    .replace(/\bpccc\s*&\s*chcn\b/g, 'phòng cháy chữa cháy cứu nạn cứu hộ')
    .replace(/\bpccc\b/g, 'phòng cháy chữa cháy')
    .replace(/\bcnch\b/g, 'cứu nạn cứu hộ')
    .replace(/\bchcn\b/g, 'cứu nạn cứu hộ')
    .replace(/\bsms\b/g, 'an toàn')
    .replace(/\batvsld\b/g, 'an toàn vệ sinh lao động')
    .replace(/\bhđcv\b/g, 'hướng dẫn công việc')
    .replace(/\bhdcv\b/g, 'hướng dẫn công việc')
    .replace(/\bbch\b/g, 'ban chỉ huy');
}

// Trích xuất các từ khóa nội dung cốt lõi (đã loại bỏ từ hành chính dùng chung)
function extractCoreKeywords(title: string): string[] {
  const expanded = expandAcronyms(title);
  return expanded
    .replace(/[0-9]+/g, '')
    .split(/[\s,./\-_()&]+/g)
    .filter((w) => w.length >= 2 && !ADMIN_STOPWORDS.has(w));
}

// Tính độ tương đồng giữa nội dung cốt lõi của 2 văn bản (Jaccard Similarity)
function computeSubjectSimilarity(titleA: string, titleB: string): number {
  const kwA = new Set(extractCoreKeywords(titleA));
  const kwB = new Set(extractCoreKeywords(titleB));

  if (kwA.size === 0 || kwB.size === 0) return 0;

  let intersection = 0;
  kwA.forEach((w) => {
    if (kwB.has(w)) intersection++;
  });

  const union = kwA.size + kwB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        isExactDuplicate: false,
        isPotentialSuperseded: false,
      });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({
        isExactDuplicate: false,
        isPotentialSuperseded: false,
      });
    }

    const body = await request.json();
    const { title, document_code, issuing_authority, issue_date, scope_domain } = body;

    const cleanTitle = (title || '').trim();
    const cleanCode = (document_code || '').trim().toLowerCase();
    const cleanIssuer = (issuing_authority || '').trim().toLowerCase();
    const cleanDate = (issue_date || '').trim();
    const cleanScope = (scope_domain || '').trim();

    if (!cleanTitle && !cleanCode) {
      return NextResponse.json({
        isExactDuplicate: false,
        isPotentialSuperseded: false,
      });
    }

    // Lấy toàn bộ danh sách tài liệu từ Supabase (kèm department_access để đối soát chuyên môn)
    const { data: existingDocs, error } = await supabase
      .from('document_files')
      .select('id, file_name, document_code, issuing_authority, issue_date, status, sync_status, department_access, created_at')
      .order('created_at', { ascending: false });

    if (error || !existingDocs || existingDocs.length === 0) {
      return NextResponse.json({
        isExactDuplicate: false,
        isPotentialSuperseded: false,
      });
    }

    // 1. KIỂM TRA TRÙNG LẶP HOÀN TOÀN (EXACT DUPLICATE)
    for (const doc of existingDocs) {
      const docCode = (doc.document_code || '').trim().toLowerCase();
      const docTitle = (doc.file_name || '').trim().toLowerCase();
      const docIssuer = (doc.issuing_authority || '').trim().toLowerCase();
      const docDate = (doc.issue_date || '').trim();

      // Tiêu chuẩn 1: Trùng Số / Ký hiệu văn bản (nếu số hiệu dài >= 3 ký tự)
      const isCodeMatch = cleanCode.length >= 3 && docCode === cleanCode;

      // Tiêu chuẩn 2: Trùng cả Tên + Đơn vị ban hành + Ngày ban hành
      const isFullIdentityMatch =
        cleanTitle.length > 3 &&
        cleanIssuer.length > 1 &&
        cleanDate.length > 5 &&
        docTitle.includes(cleanTitle.toLowerCase()) &&
        docIssuer.includes(cleanIssuer) &&
        docDate === cleanDate;

      if (isCodeMatch || isFullIdentityMatch) {
        return NextResponse.json({
          isExactDuplicate: true,
          reason: isCodeMatch
            ? `Trùng Số / Ký hiệu văn bản: "${doc.document_code}"`
            : `Trùng Tiêu đề, Đơn vị và Ngày ban hành: ${cleanDate}`,
          exactDuplicateDoc: doc,
          isPotentialSuperseded: false,
        });
      }
    }

    // 2. KIỂM TRA VĂN BẢN BAN HÀNH MỚI / THAY THẾ (POTENTIAL SUPERSEDED)
    // Chỉ so sánh với các văn bản đang CÒN HIỆU LỰC (status !== 'SUPERSEDED')
    for (const doc of existingDocs) {
      if (doc.status === 'SUPERSEDED') continue;

      // Điều kiện A: BẮT BUỘC PHẢI CÙNG LĨNH VỰC CHUYÊN MÔN
      // (Vd: Văn bản PCCC không thể thay thế văn bản PCTT & TKCN)
      if (cleanScope && doc.department_access && Array.isArray(doc.department_access)) {
        if (!doc.department_access.includes(cleanScope)) {
          continue; // Khác chuyên môn -> Bỏ qua, tuyệt đối không cảnh báo thay thế
        }
      }

      const docIssuer = (doc.issuing_authority || '').trim().toLowerCase();
      const docTitle = doc.file_name || '';

      // Điều kiện B: Đơn vị ban hành phải tương đồng
      const isIssuerSimilar =
        !cleanIssuer ||
        !docIssuer ||
        cleanIssuer.includes(docIssuer) ||
        docIssuer.includes(cleanIssuer) ||
        (normalizeIssuer(cleanIssuer) === normalizeIssuer(docIssuer) && normalizeIssuer(cleanIssuer).length >= 3);

      if (!isIssuerSimilar) continue;

      // Điều kiện C: Nội dung cốt lõi của trích yếu phải có độ trùng lặp cao (>= 70%)
      // Sau khi đã loại trừ các từ hành chính dùng chung (Quyết định, thành lập, tại cơ sở, thuộc công ty...)
      const similarity = computeSubjectSimilarity(cleanTitle, docTitle);

      if (similarity >= 0.7) {
        const docDate = (doc.issue_date || '').trim();
        // So sánh ngày ban hành (YYYY-MM-DD): Ngày mới hơn là tài liệu mới (Còn hiệu lực)
        // - 'NEWER': File đang tải lên có ngày ban hành mới hơn (hoặc chưa rõ ngày) -> Thay thế văn bản cũ trên hệ thống
        // - 'OLDER': File đang tải lên có ngày ban hành cũ hơn văn bản đang có trên hệ thống -> Lưu làm văn bản lịch sử (Đã thay thế)
        let relationType: 'NEWER' | 'OLDER' = 'NEWER';
        if (cleanDate.length >= 8 && docDate.length >= 8) {
          if (cleanDate < docDate) {
            relationType = 'OLDER';
          } else {
            relationType = 'NEWER';
          }
        }

        return NextResponse.json({
          isExactDuplicate: false,
          isPotentialSuperseded: true,
          relationType,
          similarity: Math.round(similarity * 100),
          supersededCandidate: doc,
        });
      }
    }

    // Không phát hiện trùng lặp
    return NextResponse.json({
      isExactDuplicate: false,
      isPotentialSuperseded: false,
    });
  } catch (err: any) {
    console.error('[Duplicate Check API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi kiểm tra trùng lặp' },
      { status: 500 }
    );
  }
}
