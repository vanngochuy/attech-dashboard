import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseClient, cleanEnv } from '@/lib/supabase';
import {
  DEFAULT_EMAIL_DRAFTS,
  EmailDraftItem,
  EmailDraftMatchType,
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

/**
 * So sánh một văn bản PDF từ Email (chưa chính thức) với toàn bộ văn bản chính thức trong bảng `document_files`
 */
async function matchAgainstOfficialDocuments(
  supabase: any,
  draftTitle: string,
  draftCode?: string
): Promise<{
  matchType: EmailDraftMatchType;
  similarityScore: number;
  matchedOfficialDoc?: EmailDraftItem['matchedOfficialDoc'];
  comparisonSummary: string;
}> {
  try {
    if (!supabase) {
      return {
        matchType: 'NEW_DRAFT',
        similarityScore: 0,
        comparisonSummary: 'Chưa kết nối Supabase để đối chiếu kho văn bản chính thức.',
      };
    }

    const { data: officialDocs } = await supabase
      .from('document_files')
      .select('id, file_name, document_code, issuing_authority, issue_date, status, google_drive_file_id')
      .order('created_at', { ascending: false });

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
            driveFileId: exactCodeDoc.google_drive_file_id || undefined,
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
          driveFileId: bestDoc.google_drive_file_id || undefined,
        },
        comparisonSummary: `Khớp ${scorePercent}% nội dung với văn bản chính thức "${bestDoc.file_name}" (Số hiệu: ${bestDoc.document_code || '---'}, ngày ${bestDoc.issue_date || '---'}). Đây là văn bản cập nhật / sửa đổi cần thẩm định.`,
      };
    }

    return {
      matchType: 'NEW_DRAFT',
      similarityScore: scorePercent,
      comparisonSummary:
        'Chưa có văn bản tương ứng trong tab Tài liệu chính thức. Đã lưu vào thư mục Drive "Văn bản chưa chính thức" để theo dõi.',
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
    if (supabase) {
      try {
        const { data } = await supabase.storage.from(BUCKET_NAME).download(EMAIL_DRAFTS_PATH);
        if (data) {
          const parsed = JSON.parse(await data.text());
          if (Array.isArray(parsed)) currentDrafts = parsed;
        }
      } catch {
        // Ignore and use fallback
      }
    }

    // 1. Hành động: Thêm 1 file PDF từ Email và tự động đối chiếu với kho Tài liệu chính thức
    if (action === 'ADD_AND_COMPARE' && draftItem) {
      const comparison = await matchAgainstOfficialDocuments(
        supabase,
        draftItem.extractedTitle || draftItem.pdfFileName,
        draftItem.extractedCode
      );

      const newDraft: EmailDraftItem = {
        id: `edraft-${Date.now()}`,
        emailSubject: draftItem.emailSubject || `Email đính kèm: ${draftItem.pdfFileName}`,
        senderEmail: draftItem.senderEmail || 'vanthu@attech.com.vn',
        receivedDate: draftItem.receivedDate || new Date().toISOString().slice(0, 16).replace('T', ' '),
        pdfFileName: draftItem.pdfFileName,
        extractedTitle: draftItem.extractedTitle || draftItem.pdfFileName,
        extractedCode: draftItem.extractedCode || '',
        extractedIssuer: draftItem.extractedIssuer || 'ATTECH',
        extractedIssueDate: draftItem.extractedIssueDate || new Date().toISOString().slice(0, 10),
        scopeDomain: draftItem.scopeDomain || 'QL_KY_THUAT',
        fileUrl: draftItem.fileUrl || '',
        driveFolderName: 'ATTECH_DOCUMENTS/TÀI LIỆU CHƯA XÁC THỰC',
        matchType: comparison.matchType,
        similarityScore: comparison.similarityScore,
        matchedOfficialDoc: comparison.matchedOfficialDoc,
        comparisonSummary: comparison.comparisonSummary,
        updatedAt: new Date().toISOString(),
      };

      const updated = [newDraft, ...currentDrafts];
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

    // 2. Hành động: Quét Email theo khoảng thời gian (Từ ngày - Đến ngày) và đối chiếu lại toàn bộ với bảng `document_files` thật trên Supabase
    if (action === 'SCAN_DATE_RANGE') {
      // Nếu có cấu hình N8N_EMAIL_SCAN_WEBHOOK_URL thì gọi thêm n8n để kéo PDF mới từ hộp thư Gmail/IMAP
      const n8nEmailWebhook = cleanEnv(process.env.N8N_EMAIL_SCAN_WEBHOOK_URL);
      let n8nFetchedCount = 0;

      if (n8nEmailWebhook) {
        try {
          const n8nRes = await fetch(n8nEmailWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromDate, toDate, senderFilter }),
          });
          if (n8nRes.ok) {
            const n8nData = await n8nRes.json();
            if (Array.isArray(n8nData.items)) {
              for (const item of n8nData.items) {
                const exists = currentDrafts.some((d) => d.pdfFileName === item.pdfFileName);
                if (!exists) {
                  currentDrafts.unshift({
                    id: `edraft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    emailSubject: item.emailSubject || item.pdfFileName,
                    senderEmail: item.senderEmail || 'email@attech.com.vn',
                    receivedDate: item.receivedDate || new Date().toISOString().slice(0, 16).replace('T', ' '),
                    pdfFileName: item.pdfFileName,
                    extractedTitle: item.extractedTitle || item.pdfFileName,
                    extractedCode: item.extractedCode || '',
                    extractedIssuer: item.extractedIssuer || 'ATTECH',
                    extractedIssueDate: item.extractedIssueDate || '',
                    scopeDomain: item.scopeDomain || 'QL_KY_THUAT',
                    fileUrl: item.fileUrl || '',
                    driveFolderName: 'ATTECH_DOCUMENTS/TÀI LIỆU CHƯA XÁC THỰC',
                    driveFileId: item.driveFileId,
                    matchType: 'NEW_DRAFT',
                  });
                  n8nFetchedCount++;
                }
              }
            }
          }
        } catch (err) {
          console.warn('Webhook n8n Email Scan chưa phản hồi, dùng dữ liệu đối chiếu trực tiếp:', err);
        }
      }

      // Chạy đối chiếu trực tiếp toàn bộ danh sách Email PDF với 282 văn bản chính thức trong `document_files`
      const reEvaluatedDrafts: EmailDraftItem[] = [];
      for (const draft of currentDrafts) {
        if (draft.matchType === 'PROMOTED') {
          reEvaluatedDrafts.push(draft);
          continue;
        }
        const comp = await matchAgainstOfficialDocuments(
          supabase,
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

      if (supabase) {
        const blob = new Blob([JSON.stringify(reEvaluatedDrafts, null, 2)], {
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
        emailDrafts: reEvaluatedDrafts,
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
          google_drive_file_id: target.driveFileId || null,
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

    return NextResponse.json({ error: 'Hành động không hợp lệ.' }, { status: 400 });
  } catch (err: any) {
    console.error('Lỗi POST /api/tasks/email-scan:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý quét email' }, { status: 500 });
  }
}

