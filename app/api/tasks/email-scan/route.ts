import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseClient, cleanEnv } from '@/lib/supabase';
import {
  DEFAULT_EMAIL_DRAFTS,
  EmailDraftItem,
  EmailDraftMatchType,
  sortDraftsByReceivedDate,
} from '@/lib/compliance';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'compliance-files';
const EMAIL_DRAFTS_PATH = 'data/email_drafts.json';

// Từ dừng hành chính để tính độ tương đồng cốt lõi giữa văn bản Email và văn bản chính thức ở tab Tài liệu
const ADMIN_STOPWORDS = new Set([
  'quyết', 'định', 'về', 'việc', 'vv', 'ban', 'hành', 'sửa', 'đổi', 'bổ', 'sung',
  'thay', 'thế', 'thành', 'lập', 'kiện', 'toàn', 'áp', 'dụng', 'triển', 'khai',
  'tổ', 'chức', 'thực', 'hiện', 'quy', 'trình', 'chế', 'hướng', 'dẫn', 'kế', 'hoạch',
  'thông', 'tư', 'nghị', 'luật', 'tại', 'các', 'cơ', 'sở', 'làm', 'thuộc', 'công', 'ty',
  'tnhh', 'kỹ', 'thuật', 'quản', 'lý', 'bay', 'tổng', 'cục', 'bộ', 'chi', 'nhánh',
  'đài', 'trạm', 'của', 'và', 'cho', 'năm', 'đối', 'với', 'trong', 'theo', 'một',
  'số', 'phê', 'duyệt', 'chấp', 'thuận', 'báo', 'cáo', 'biên', 'bản', 'ดự', 'thảo', 'lần'
]);

function normalizeVi(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/\bpctt\s*&\s*tkcn\b/g, 'phòng chống thiên tai tìm kiếm cứu nạn')
    .replace(/\bpccc\s*&\s*chcn\b/g, 'phòng cháy chữa cháy cứu nạn cứu hộ')
    .replace(/\bpccc\s*&\s*cnch\b/g, 'phòng cháy chữa cháy cứu nạn cứu hộ')
    .replace(/\bsms\b/g, 'an toàn')
    .replace(/\batvsld\b/g, 'an toàn vệ sinh lao động');
}

function extractCoreTokens(title: string): string[] {
  return normalizeVi(title)
    .replace(/[0-9]+/g, '')
    .split(/[\s,./\-_()&]+/g)
    .filter((w) => w.length >= 2 && !ADMIN_STOPWORDS.has(w));
}

function computeSimilarity(titleA: string, titleB: string): number {
  const setA = new Set(extractCoreTokens(titleA));
  const setB = new Set(extractCoreTokens(titleB));
  if (setA.size === 0 || setB.size === 0) return 0;

  let inter = 0;
  setA.forEach((w) => {
    if (setB.has(w)) inter++;
  });
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function cleanDocumentCode(text: string): string {
  if (!text) return '';
  // Tìm mẫu số hiệu văn bản: Số + gạch/chéo + chữ hoa (có thể có QĐ, TB, BC, TT, NĐ, QLB, BXD, KTQLB, CHK...)
  const m = text.match(/\b(\d+)\s*[-/]\s*([A-Za-zĐđ0-9\-_/]+)\b/);
  if (!m) return '';
  const num = m[1];
  let tail = m[2]
    .replace(/\.pdf$/i, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-(?:fwd|fw|re|copy|\d+)$/i, '')
    .replace(/-(?:fwd|fw|re|copy|\d+)$/i, '')
    .toUpperCase();

  tail = tail.replace(/\bQD\b/g, 'QĐ').replace(/\bND\b/g, 'NĐ');
  return `${num}/${tail}`;
}

/**
 * Tự động bóc tách Số hiệu, Cơ quan ban hành và Tên văn bản từ Tên file PDF và Tiêu đề Email
 * (Hoạt động tức thì 0ms, 0đ, không phụ thuộc vào quota AI Gemini)
 */
function heuristicExtractFromText(pdfFileName: string, emailSubject?: string): {
  code: string;
  issuer: string;
  title: string;
} {
  const cleanName = (pdfFileName || '').replace(/\.pdf$/i, '').trim();
  const fullText = `${cleanName} ${emailSubject || ''}`;

  // 1. Tìm số hiệu văn bản (Ví dụ: 8634/BXD-VP, 7426/QLB-VPTCT, 346/QĐ-KTQLB, 8067/QLB-VSTBPN, 1550/TTHK-CSDL...)
  const code = cleanDocumentCode(cleanName) || cleanDocumentCode(emailSubject || '');

  // 2. Nhận diện Cơ quan ban hành từ Mã ký hiệu hoặc tên viết tắt
  let issuer = 'Công ty TNHH Kỹ thuật Quản lý bay';
  const upper = fullText.toUpperCase();
  if (upper.includes('BXD') || upper.includes('BỘ XÂY DỰNG')) {
    issuer = 'Bộ Xây dựng';
  } else if (upper.includes('BGTVT') || upper.includes('BỘ GTVT') || upper.includes('BỘ GIAO THÔNG')) {
    issuer = 'Bộ Giao thông Vận tải';
  } else if (upper.includes('CHK') || upper.includes('CỤC HÀNG KHÔNG')) {
    issuer = 'Cục Hàng không Việt Nam';
  } else if (upper.includes('QLB') || upper.includes('VATM') || upper.includes('TỔNG CÔNG TY QUẢN LÝ BAY')) {
    issuer = 'Tổng công ty Quản lý bay VN';
  } else if (upper.includes('TTHK') || upper.includes('TRUNG TÂM')) {
    issuer = 'Trung tâm Quản lý luồng không lưu';
  } else if (upper.includes('CVMB') || upper.includes('CẢNG VỤ')) {
    issuer = 'Cảng vụ Hàng không miền Bắc';
  }

  // 3. Chuẩn hóa tên tiêu đề
  let title = cleanName;
  if (emailSubject && emailSubject.length > 5) {
    const cleanSubj = emailSubject.replace(/^(?:Fwd:\s*|Re:\s*|\[.*?\]\s*)+/i, '').trim();
    if (cleanSubj.length > 5) {
      title = cleanSubj;
    }
  }

  return { code, issuer, title };
}

/**
 * So sánh một văn bản PDF từ Email (chưa chính thức) với toàn bộ văn bản chính thức trong mảng `officialDocs`
 */
function matchAgainstOfficialDocuments(
  officialDocs: any[],
  draftTitle: string,
  draftCode?: string
): {
  matchType: EmailDraftMatchType;
  similarityScore: number;
  matchedOfficialDoc?: EmailDraftItem['matchedOfficialDoc'];
  comparisonSummary: string;
} {
  try {
    if (!officialDocs || officialDocs.length === 0) {
      return {
        matchType: 'NEW_DRAFT',
        similarityScore: 0,
        comparisonSummary: 'Kho Tài liệu chính thức hiện chưa có văn bản để đối chiếu.',
      };
    }

    const cleanDraftCode = (draftCode || '').trim().toLowerCase();

    // 1. Kiểm tra trùng khớp Số / Ký hiệu
    if (cleanDraftCode.length >= 3) {
      const exactCodeDoc = officialDocs.find(
        (d: any) => (d.document_code || '').trim().toLowerCase() === cleanDraftCode
      );
      if (exactCodeDoc) {
        return {
          matchType: 'EXACT_DUPLICATE',
          similarityScore: 100,
          matchedOfficialDoc: {
            id: exactCodeDoc.id,
            title: exactCodeDoc.file_name,
            code: exactCodeDoc.document_code || '---',
            issuer: exactCodeDoc.issuing_authority || 'ATTECH',
            issueDate: exactCodeDoc.issue_date || '---',
            driveFileId: exactCodeDoc.drive_file_id || undefined,
          },
          comparisonSummary: `Trùng khớp Số / Ký hiệu "${exactCodeDoc.document_code}" với văn bản đã có trong tab Tài liệu chính thức.`,
        };
      }
    }

    // 2. Tìm văn bản có độ tương đồng nội dung trích yếu cao nhất để phát hiện Bản cập nhật / Sửa đổi / Thay thế
    let bestDoc: any = null;
    let bestSim = 0;

    for (const doc of officialDocs) {
      if (doc.status === 'SUPERSEDED') continue;
      const sim = computeSimilarity(draftTitle, doc.file_name || '');
      if (sim > bestSim) {
        bestSim = sim;
        bestDoc = doc;
      }
    }

    const scorePercent = Math.round(bestSim * 100);

    if (bestDoc && bestSim >= 0.58) {
      return {
        matchType: 'UPDATE_CANDIDATE',
        similarityScore: scorePercent,
        matchedOfficialDoc: {
          id: bestDoc.id,
          title: bestDoc.file_name,
          code: bestDoc.document_code || '---',
          issuer: bestDoc.issuing_authority || 'ATTECH',
          issueDate: bestDoc.issue_date || '---',
          driveFileId: bestDoc.drive_file_id || undefined,
        },
        comparisonSummary: `Khớp ${scorePercent}% nội dung với văn bản chính thức "${bestDoc.file_name}" (Số hiệu: ${bestDoc.document_code || '---'}, ngày ${bestDoc.issue_date || '---'}). Đây là văn bản cập nhật / sửa đổi cần thẩm định.`,
      };
    }

    return {
      matchType: 'NEW_DRAFT',
      similarityScore: scorePercent,
      comparisonSummary:
        'Chưa có văn bản tương ứng trong tab Tài liệu chính thức. Đã lưu vào thư mục Drive "03_TÀI LIỆU CHƯA XÁC THỰC" để theo dõi.',
    };
  } catch (err) {
    console.warn('Lỗi đối chiếu với kho Tài liệu:', err);
    return {
      matchType: 'NEW_DRAFT',
      similarityScore: 0,
      comparisonSummary: 'Văn bản dự thảo mới từ Email.',
    };
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    const body = await req.json();
    const { action, fromDate, toDate, senderFilter, draftItem, targetDraftId } = body;

    // Đọc danh sách hiện tại từ Supabase Storage
    let currentDrafts: EmailDraftItem[] = DEFAULT_EMAIL_DRAFTS;
    let officialDocs: any[] = [];

    if (supabase) {
      try {
        const { data } = await supabase.storage.from(BUCKET_NAME).download(EMAIL_DRAFTS_PATH);
        if (data) {
          const parsed = JSON.parse(await data.text());
          if (Array.isArray(parsed)) currentDrafts = sortDraftsByReceivedDate(parsed, 'desc');
        }
      } catch {
        // Ignore and use fallback
      }

      try {
        // Lấy 1 lần duy nhất danh sách văn bản chính thức từ `document_files` để đối chiếu siêu tốc trong bộ nhớ
        const { data: docs } = await supabase
          .from('document_files')
          .select('id, file_name, document_code, issuing_authority, issue_date, status, drive_file_id')
          .order('created_at', { ascending: false });
        if (Array.isArray(docs)) officialDocs = docs;
      } catch (err) {
        console.warn('Lỗi lấy officialDocs:', err);
      }
    }

    // 1. Hành động: Thêm 1 file PDF từ Email và tự động đối chiếu với kho Tài liệu chính thức
    if (action === 'ADD_AND_COMPARE' && draftItem) {
      const comparison = matchAgainstOfficialDocuments(
        officialDocs,
        draftItem.extractedTitle || draftItem.pdfFileName,
        draftItem.extractedCode
      );

      const newDraft: EmailDraftItem = {
        id: `edraft-${Date.now()}`,
        emailSubject: draftItem.emailSubject || `Email đính kèm: ${draftItem.pdfFileName}`,
        senderEmail: draftItem.senderEmail || 'vanthu@attech.com.vn',
        receivedDate: draftItem.receivedDate || '',
        pdfFileName: draftItem.pdfFileName,
        extractedTitle: draftItem.extractedTitle || draftItem.pdfFileName,
        extractedCode: draftItem.extractedCode || '',
        extractedIssuer: draftItem.extractedIssuer || 'ATTECH',
        extractedIssueDate: draftItem.extractedIssueDate || new Date().toISOString().slice(0, 10),
        scopeDomain: draftItem.scopeDomain || 'QL_KY_THUAT',
        fileUrl: draftItem.fileUrl || '',
        driveFolderName: 'ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC',
        matchType: comparison.matchType,
        similarityScore: comparison.similarityScore,
        matchedOfficialDoc: comparison.matchedOfficialDoc,
        comparisonSummary: comparison.comparisonSummary,
        updatedAt: new Date().toISOString(),
      };

      const updated = sortDraftsByReceivedDate([newDraft, ...currentDrafts], 'desc');
      if (supabase) {
        const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({
        success: true,
        newDraft,
        emailDrafts: updated,
      });
    }

    // 2. Hành động: Quét Email & Đồng bộ từ Google Drive "03_TÀI LIỆU CHƯA XÁC THỰC" (ID: 1aejD_BWF9ZtclJ2WCDRW34myR9iAWxmz)
    //    và đối chiếu lại toàn bộ với bảng `document_files` thật trên Supabase
    if (action === 'SCAN_DATE_RANGE' || action === 'SYNC_DRIVE_FOLDER') {
      // Gọi luồng n8n `ATTECH - Email PDF Scanner (tuh@attech.com.vn) -> 03_TAI_LIEU_CHUA_XAC_THUC` (ID: CNLUQWWnkPHYRTRB)
      const n8nEmailWebhook =
        cleanEnv(process.env.N8N_EMAIL_SCAN_WEBHOOK_URL) ||
        'http://localhost:5678/webhook/scan-email-pdf';
      let n8nFetchedCount = 0;

      if (n8nEmailWebhook) {
        try {
          const n8nRes = await fetch(n8nEmailWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SYNC_DRIVE_FOLDER',
              fromDate,
              toDate,
              senderFilter,
              mailbox: 'tuh@attech.com.vn',
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (n8nRes.ok) {
            const n8nData = await n8nRes.json();
            if (Array.isArray(n8nData.items)) {
              for (const item of n8nData.items) {
                const itemNorm = (item.pdfFileName || '').toLowerCase().trim();
                const existingIndex = currentDrafts.findIndex(
                  (d) =>
                    (item.driveFileId && d.driveFileId === item.driveFileId) ||
                    (d.pdfFileName || '').toLowerCase().trim() === itemNorm
                );
                if (existingIndex === -1) {
                  const heuristic = heuristicExtractFromText(item.pdfFileName, item.emailSubject);
                  currentDrafts.unshift({
                    id: `edraft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    emailSubject: item.emailSubject || item.pdfFileName,
                    senderEmail: item.senderEmail || 'tuh@attech.com.vn',
                    receivedDate: item.receivedDate || '',
                    pdfFileName: item.pdfFileName,
                    extractedTitle:
                      item.extractedTitle || heuristic.title,
                    extractedCode: item.extractedCode || heuristic.code,
                    extractedIssuer: item.extractedIssuer || heuristic.issuer,
                    extractedIssueDate: item.extractedIssueDate || (item.receivedDate ? item.receivedDate.slice(0, 10) : ''),
                    scopeDomain: item.scopeDomain || 'QL_KY_THUAT',
                    fileUrl: item.fileUrl || '',
                    driveFolderName: 'ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC',
                    driveFileId: item.driveFileId,
                    matchType: 'NEW_DRAFT',
                    aiExtracted: false,
                  });
                  n8nFetchedCount++;
                } else {
                  // Đã tồn tại: Giữ nguyên 100% dữ liệu do AI đã đọc nếu có
                  const exist = currentDrafts[existingIndex];
                  currentDrafts[existingIndex] = {
                    ...exist,
                    driveFileId: exist.driveFileId || item.driveFileId,
                    fileUrl: exist.fileUrl || item.fileUrl,
                    receivedDate: exist.receivedDate || item.receivedDate || '',
                    emailSubject: exist.emailSubject || item.emailSubject,
                  };
                }
              }
            }
          }
        } catch (err) {
          console.warn('Webhook n8n Email Scan / Drive Sync chưa phản hồi, dùng dữ liệu đối chiếu trực tiếp:', err);
        }
      }

      // Chạy đối chiếu trực tiếp toàn bộ danh sách Email PDF với 282 văn bản chính thức trong `document_files`
      const reEvaluatedDrafts: EmailDraftItem[] = [];
      for (const draft of currentDrafts) {
        if (draft.matchType === 'PROMOTED') {
          reEvaluatedDrafts.push(draft);
          continue;
        }
        const comp = matchAgainstOfficialDocuments(
          officialDocs,
          draft.extractedTitle || draft.pdfFileName,
          draft.extractedCode
        );
        reEvaluatedDrafts.push({
          ...draft,
          matchType: comp.matchType,
          similarityScore: comp.similarityScore,
          matchedOfficialDoc: comp.matchedOfficialDoc || draft.matchedOfficialDoc,
          comparisonSummary: comp.comparisonSummary,
          updatedAt: new Date().toISOString(),
        });
      }

      const sortedDrafts = sortDraftsByReceivedDate(reEvaluatedDrafts, 'desc');

      if (supabase) {
        const blob = new Blob([JSON.stringify(sortedDrafts, null, 2)], {
          type: 'application/json',
        });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({
        success: true,
        n8nFetchedCount,
        emailDrafts: sortedDrafts,
      });
    }

    // 3. Hành động: Duyệt ban hành văn bản từ Email sang kho Tài liệu chính thức (`document_files`) và đánh dấu văn bản cũ là Đã thay thế (`SUPERSEDED`)
    if (action === 'PROMOTE_TO_OFFICIAL' && targetDraftId) {
      const target = currentDrafts.find((d) => d.id === targetDraftId);
      if (!target) {
        return NextResponse.json({ error: 'Không tìm thấy văn bản dự thảo.' }, { status: 404 });
      }

      if (supabase) {
        // Nếu có văn bản chính thức cũ tương ứng -> Chuyển văn bản cũ sang trạng thái SUPERSEDED (Đã thay thế)
        if (target.matchedOfficialDoc?.id) {
          await supabase
            .from('document_files')
            .update({ status: 'SUPERSEDED' })
            .eq('id', target.matchedOfficialDoc.id);
        }

        // Thêm văn bản mới vào bảng `document_files` (tab Tài liệu)
        await supabase.from('document_files').insert({
          file_name: target.extractedTitle || target.pdfFileName,
          document_code: target.extractedCode || null,
          issuing_authority: target.extractedIssuer || 'ATTECH',
          issue_date: target.extractedIssueDate || new Date().toISOString().slice(0, 10),
          department_access: [target.scopeDomain || 'QL_KY_THUAT'],
          status: 'ACTIVE',
          sync_status: 'SYNCED',
          drive_file_id: target.driveFileId || null,
          ocr_content: `[Ban hành từ Email ngày ${target.receivedDate}] ${target.extractedTitle}`,
        });
      }

      const updated = currentDrafts.map((d) =>
        d.id === targetDraftId
          ? {
              ...d,
              matchType: 'PROMOTED' as EmailDraftMatchType,
              comparisonSummary: `Đã duyệt chuyển sang tab Tài liệu chính thức${
                target.matchedOfficialDoc?.code
                  ? ` (Thay thế cho văn bản ${target.matchedOfficialDoc.code})`
                  : ''
              }.`,
              updatedAt: new Date().toISOString(),
            }
          : d
      );

      if (supabase) {
        const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({
        success: true,
        emailDrafts: updated,
      });
    }

    // 4. Hành động: n8n (luồng CNLUQWWnkPHYRTRB - hộp thư tuh@attech.com.vn) đẩy danh sách PDF vừa lưu vào
    //    `03_TÀI LIỆU CHƯA XÁC THỰC` về Web để tự động đối chiếu với kho Tài liệu chính thức
    if (action === 'IMPORT_ITEMS' && Array.isArray(body.items)) {
      let importedCount = 0;
      const updated = [...currentDrafts];

      for (const item of body.items) {
        if (!item?.pdfFileName) continue;
        const itemNorm = (item.pdfFileName || '').toLowerCase().trim();
        const existingIndex = updated.findIndex(
          (d) =>
            (item.driveFileId && d.driveFileId === item.driveFileId) ||
            (d.pdfFileName || '').toLowerCase().trim() === itemNorm
        );
        if (existingIndex !== -1) {
          // Đã tồn tại: giữ nguyên 100% dữ liệu AI
          const exist = updated[existingIndex];
          updated[existingIndex] = {
            ...exist,
            driveFileId: exist.driveFileId || item.driveFileId,
            fileUrl: exist.fileUrl || item.fileUrl,
            receivedDate: exist.receivedDate || item.receivedDate || '',
            emailSubject: exist.emailSubject || item.emailSubject,
          };
          continue;
        }

        const title = item.extractedTitle || item.pdfFileName;
        const comp = matchAgainstOfficialDocuments(officialDocs, title, item.extractedCode);

        updated.unshift({
          id: `edraft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          emailSubject: item.emailSubject || item.pdfFileName,
          senderEmail: item.senderEmail || body.mailbox || 'tuh@attech.com.vn',
          receivedDate: item.receivedDate || '',
          pdfFileName: item.pdfFileName,
          extractedTitle: title,
          extractedCode: item.extractedCode || '',
          extractedIssuer: item.extractedIssuer || 'ATTECH',
          extractedIssueDate: item.extractedIssueDate || '',
          scopeDomain: item.scopeDomain || 'QL_KY_THUAT',
          fileUrl: item.fileUrl || '',
          driveFileId: item.driveFileId || undefined,
          driveFolderName: 'ATTECH_DOCUMENTS/03_TÀI LIỆU CHƯA XÁC THỰC',
          matchType: comp.matchType,
          similarityScore: comp.similarityScore,
          matchedOfficialDoc: comp.matchedOfficialDoc,
          comparisonSummary: comp.comparisonSummary,
          updatedAt: new Date().toISOString(),
        });
        importedCount++;
      }

      const sortedUpdated = sortDraftsByReceivedDate(updated, 'desc');

      if (supabase && importedCount > 0) {
        const blob = new Blob([JSON.stringify(sortedUpdated, null, 2)], { type: 'application/json' });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({ success: true, importedCount, emailDrafts: sortedUpdated });
    }

    // 5. Hành động: Làm giàu siêu tốc (0ms, 0đ) toàn bộ số hiệu, đơn vị ban hành từ Heuristic Regex tiếng Việt
    if (action === 'BATCH_HEURISTIC_ENRICH') {
      let enrichedCount = 0;
      const reEvaluated: EmailDraftItem[] = [];

      for (const draft of currentDrafts) {
        let code = draft.extractedCode;
        let issuer = draft.extractedIssuer;
        let title = draft.extractedTitle;

        if (!code || code === '' || !issuer || issuer === 'ATTECH') {
          const h = heuristicExtractFromText(draft.pdfFileName, draft.emailSubject);
          if (h.code && (!code || code === '')) code = h.code;
          if (h.issuer && (!issuer || issuer === 'ATTECH')) issuer = h.issuer;
          if (h.title && (!title || title === draft.pdfFileName)) title = h.title;
          enrichedCount++;
        }

        const comp = matchAgainstOfficialDocuments(officialDocs, title, code);
        reEvaluated.push({
          ...draft,
          extractedCode: code,
          extractedIssuer: issuer,
          extractedTitle: title,
          matchType: comp.matchType,
          similarityScore: comp.similarityScore,
          matchedOfficialDoc: comp.matchedOfficialDoc || draft.matchedOfficialDoc,
          comparisonSummary: comp.comparisonSummary,
          updatedAt: new Date().toISOString(),
        });
      }

      const sortedReEvaluated = sortDraftsByReceivedDate(reEvaluated, 'desc');

      if (supabase) {
        const blob = new Blob([JSON.stringify(sortedReEvaluated, null, 2)], { type: 'application/json' });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({
        success: true,
        enrichedCount,
        emailDrafts: sortedReEvaluated,
      });
    }

    // 6. Hành động: Cập nhật kết quả AI Gemini đã đọc 2 trang đầu của 1 file PDF cụ thể
    if (action === 'AI_EXTRACT_SINGLE' && body.draftId) {
      const draftIndex = currentDrafts.findIndex((d) => d.id === body.draftId);
      if (draftIndex === -1) {
        return NextResponse.json({ error: 'Không tìm thấy văn bản' }, { status: 404 });
      }

      const target = currentDrafts[draftIndex];

      // Nếu văn bản đã được AI trích xuất trước đó và không có cờ force -> giữ nguyên, không ghi đè lại
      if (target.aiExtracted && !body.force) {
        return NextResponse.json({
          success: true,
          message: 'Văn bản đã được AI xử lý trước đó',
          updatedDraft: target,
          emailDrafts: currentDrafts,
        });
      }

      const m = body.metadata || {};
      const newTitle = m.title || target.extractedTitle;
      const newCode = m.document_code || target.extractedCode || '';
      const newIssuer = m.issuing_authority || target.extractedIssuer || 'ATTECH';
      const newDate = m.issue_date || target.extractedIssueDate || '';
      const newScope = m.scope_domain || target.scopeDomain || 'QL_KY_THUAT';

      const comp = matchAgainstOfficialDocuments(officialDocs, newTitle, newCode);
      const updatedItem = {
        ...target,
        extractedTitle: newTitle,
        extractedCode: newCode,
        extractedIssuer: newIssuer,
        extractedIssueDate: newDate,
        scopeDomain: newScope,
        aiExtracted: true,
        matchType: comp.matchType,
        similarityScore: comp.similarityScore,
        matchedOfficialDoc: comp.matchedOfficialDoc || target.matchedOfficialDoc,
        comparisonSummary: comp.comparisonSummary,
        updatedAt: new Date().toISOString(),
      };
      currentDrafts[draftIndex] = updatedItem;

      const sortedCurrent = sortDraftsByReceivedDate(currentDrafts, 'desc');

      if (supabase) {
        const blob = new Blob([JSON.stringify(sortedCurrent, null, 2)], {
          type: 'application/json',
        });
        await supabase.storage.from(BUCKET_NAME).upload(EMAIL_DRAFTS_PATH, blob, {
          contentType: 'application/json',
          upsert: true,
        });
      }

      return NextResponse.json({
        success: true,
        updatedDraft: updatedItem,
        emailDrafts: sortedCurrent,
      });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ.' }, { status: 400 });
  } catch (err: any) {
    console.error('Lỗi POST /api/tasks/email-scan:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý quét email' }, { status: 500 });
  }
}

