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

// Hàm chuẩn hóa định dạng ngày sang YYYY-MM-DD
function normalizeDateStr(val?: string | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return str;
}

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
    // Theo quy chế văn thư hành chính, số ký hiệu văn bản bắt đầu lại từ ngày 1/1 hàng năm
    // nên việc trùng số hiệu giữa các năm khác nhau hoặc khác ngày ban hành là hoàn toàn bình thường.
    const inputDate = normalizeDateStr(cleanDate);

    for (const doc of existingDocs) {
      const docCode = (doc.document_code || '').trim().toLowerCase();
      const docTitle = (doc.file_name || '').trim().toLowerCase();
      const docIssuer = (doc.issuing_authority || '').trim().toLowerCase();
      const docDate = normalizeDateStr(doc.issue_date);

      // So sánh đơn vị ban hành
      const isIssuerSimilar =
        !cleanIssuer ||
        !docIssuer ||
        cleanIssuer.includes(docIssuer) ||
        docIssuer.includes(cleanIssuer) ||
        (normalizeIssuer(cleanIssuer) === normalizeIssuer(docIssuer) && normalizeIssuer(cleanIssuer).length >= 3);

      // Độ tương đồng nội dung cốt lõi của trích yếu/tiêu đề
      const similarity = computeSubjectSimilarity(cleanTitle, docTitle);
      const isTitleSimilar = similarity >= 0.5 || docTitle.includes(cleanTitle) || cleanTitle.includes(docTitle);

      const isCodeMatch = cleanCode.length >= 3 && docCode === cleanCode;
      const bothHaveDates = inputDate.length >= 8 && docDate.length >= 8;
      const isSameDate = bothHaveDates && inputDate === docDate;
      const isDifferentDate = bothHaveDates && inputDate !== docDate;

      // NGUYÊN TẮC VÀNG: Nếu cả 2 đều có ngày ban hành và KHÁC NHAU -> TUYỆT ĐỐI KHÔNG TRÙNG LẶP
      if (isDifferentDate) {
        continue;
      }

      // TH1: Cùng Số hiệu + CÙNG NGÀY BAN HÀNH + Đơn vị tương đồng
      const isExactCodeAndDateMatch = isCodeMatch && isSameDate && isIssuerSimilar;

      // TH2: Cùng Số hiệu + (1 trong 2 thiếu ngày) + Đơn vị tương đồng + Nội dung trích yếu tương đồng
      const isCodeAndTitleMatchNoDate = isCodeMatch && !bothHaveDates && isTitleSimilar && isIssuerSimilar;

      // TH3: Trùng cả Tiêu đề + Đơn vị ban hành + Ngày ban hành (dành cho văn bản không có số hiệu hoặc khác số)
      const isFullIdentityMatch =
        cleanTitle.length > 5 &&
        cleanIssuer.length > 1 &&
        isSameDate &&
        (docTitle.includes(cleanTitle) || cleanTitle.includes(docTitle)) &&
        isIssuerSimilar;

      if (isExactCodeAndDateMatch || isCodeAndTitleMatchNoDate || isFullIdentityMatch) {
        return NextResponse.json({
          isExactDuplicate: true,
          reason: isExactCodeAndDateMatch
            ? `Trùng Số / Ký hiệu "${doc.document_code}", cùng Ngày ban hành (${docDate}) và cùng Đơn vị ban hành.`
            : isCodeAndTitleMatchNoDate
            ? `Trùng Số / Ký hiệu "${doc.document_code}", cùng Đơn vị ban hành và nội dung tương đồng.`
            : `Trùng Tiêu đề, Đơn vị và Ngày ban hành: ${docDate}`,
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
