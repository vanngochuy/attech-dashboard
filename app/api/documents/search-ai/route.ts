import { NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { getNextGeminiApiKey, getAllGeminiApiKeys } from '@/lib/gemini-keys';

export const maxDuration = 45;

interface SearchCandidate {
  id: string;
  file_name: string;
  document_code: string | null;
  issuing_authority: string | null;
  issue_date: string | null;
  sampleText: string;
}

export async function POST(req: Request) {
  try {
    const { query, dept } = await req.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập nội dung cần tìm kiếm' }, { status: 400 });
    }

    const trimmedQuery = query.trim();
    const keys = getAllGeminiApiKeys();

    if (keys.length === 0) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trên hệ thống để sử dụng tính năng Tìm AI.' },
        { status: 500 }
      );
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình kết nối Supabase để truy vấn nội dung văn bản.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Không thể kết nối cơ sở dữ liệu Supabase' }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey: getNextGeminiApiKey() });

    // Bước 1: Gemini phân tích ý định và trích xuất từ khóa ngữ nghĩa/viết tắt ngành Quản lý bay
    let keywords: string[] = [trimmedQuery.toLowerCase()];
    try {
      const expandRes = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: `Bạn là trợ lý AI chuyên ngành Kỹ thuật Quản lý bay (ATTECH / VATM).
Nhiệm vụ của bạn là phân tích câu tìm kiếm tự nhiên của người dùng để trích xuất các từ khóa ngữ nghĩa cốt lõi, từ đồng nghĩa, từ viết tắt và tên thiết bị kỹ thuật liên quan (ví dụ: VOR, DVOR, DME, ILS, Radar, VHF, CHT, CNS, tiêu chuẩn, bảo dưỡng, khai thác, an toàn, PCCC...).
Chỉ trả về JSON thuần túy (không dùng markdown, không giải thích) dạng: {"keywords": ["từ1", "từ2", "từ3"]}.`,
        prompt: `Câu tìm kiếm của người dùng: "${trimmedQuery}"`,
      });

      const parsed = JSON.parse(expandRes.text.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
        keywords = Array.from(new Set([trimmedQuery.toLowerCase(), ...parsed.keywords.map((k: string) => k.toLowerCase())]));
      }
    } catch (e) {
      console.warn('[AI Search] Query expansion warning, falling back to raw query tokens:', e);
      keywords = Array.from(new Set([trimmedQuery.toLowerCase(), ...trimmedQuery.toLowerCase().split(/\s+/)]));
    }

    // Bước 2: Lấy danh sách văn bản từ Supabase
    let queryBuilder = supabase
      .from('document_files')
      .select('id, file_name, document_code, issuing_authority, issue_date, department_access, ocr_content');

    if (dept && dept !== 'ALL') {
      queryBuilder = queryBuilder.contains('department_access', [dept]);
    }

    const { data: allDocs, error: dbErr } = await queryBuilder;

    if (dbErr) {
      return NextResponse.json({ error: `Lỗi truy vấn database: ${dbErr.message}` }, { status: 500 });
    }

    if (!allDocs || allDocs.length === 0) {
      return NextResponse.json({ success: true, results: [], keywords, totalScanned: 0 });
    }

    // Bước 3: Lọc thô trên backend (Text matching trên ocr_content & metadata)
    const candidates: SearchCandidate[] = [];

    for (const doc of allDocs) {
      const ocr = (doc.ocr_content || '').toLowerCase();
      const meta = `${doc.file_name} ${doc.document_code || ''} ${doc.issuing_authority || ''}`.toLowerCase();

      // Kiểm tra xem có từ khóa nào xuất hiện không
      let matchIndex = -1;
      let matchedKeyword = '';

      for (const kw of keywords) {
        if (!kw || kw.length < 2) continue;
        const idx = ocr.indexOf(kw);
        if (idx !== -1) {
          matchIndex = idx;
          matchedKeyword = kw;
          break;
        }
      }

      // Nếu không thấy trong OCR, kiểm tra trong metadata
      const metaMatched = keywords.some((kw) => kw && kw.length >= 2 && meta.includes(kw));

      if (matchIndex !== -1 || metaMatched) {
        let sample = '';
        if (matchIndex !== -1) {
          // Trích đoạn xung quanh vị trí tìm thấy từ khóa trong ocr_content
          const start = Math.max(0, matchIndex - 250);
          const end = Math.min(ocr.length, matchIndex + 350);
          sample = doc.ocr_content.slice(start, end).replace(/\s+/g, ' ').trim();
        } else if (doc.ocr_content) {
          sample = doc.ocr_content.slice(0, 500).replace(/\s+/g, ' ').trim();
        } else {
          sample = `Tên tài liệu: ${doc.file_name}. Số hiệu: ${doc.document_code || 'Chưa rõ'}. Đơn vị: ${doc.issuing_authority || 'Chưa rõ'}.`;
        }

        candidates.push({
          id: doc.id,
          file_name: doc.file_name,
          document_code: doc.document_code,
          issuing_authority: doc.issuing_authority,
          issue_date: doc.issue_date,
          sampleText: sample,
        });
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        keywords,
        totalScanned: allDocs.length,
        message: 'Không tìm thấy tài liệu nào chứa nội dung liên quan.',
      });
    }

    // Giới hạn tối đa 20 tài liệu ứng viên tốt nhất để gửi cho Gemini chấm điểm & trích dẫn
    const topCandidates = candidates.slice(0, 20);

    // Bước 4: Gemini chấm điểm độ liên quan và tạo đoạn trích dẫn (Snippet) chính xác
    try {
      const evaluateRes = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: `Bạn là trợ lý AI tìm kiếm chuyên sâu tài liệu kỹ thuật ngành Quản lý bay (ATTECH).
Người dùng đang tìm kiếm với câu hỏi/yêu cầu: "${trimmedQuery}".
Dưới đây là danh sách các tài liệu ứng viên kèm một đoạn trích từ nội dung văn bản.
Nhiệm vụ của bạn:
1. Đánh giá mức độ phù hợp của từng tài liệu đối với yêu cầu tìm kiếm của người dùng ("high" = rất phù hợp/đúng trọng tâm, "medium" = có đề cập/liên quan gián tiếp, loại bỏ nếu không liên quan).
2. Viết một đoạn trích dẫn ngắn (snippet: 1-2 câu súc tích) giải thích rõ ràng tại sao văn bản này khớp (trích nội dung hoặc tóm tắt điểm đề cập).
3. Sắp xếp thứ tự các tài liệu liên quan nhất lên đầu.

BẮT BUỘC trả về JSON thuần túy (không kèm markdown \`\`\`json hay text thừa):
[
  {
    "id": "mã_id_tài_liệu",
    "relevance": "high" | "medium",
    "snippet": "Đoạn trích dẫn hoặc tóm tắt ngắn vì sao tài liệu này khớp với nội dung cần tìm..."
  }
]`,
        prompt: `Danh sách tài liệu ứng viên:
${JSON.stringify(
  topCandidates.map((c, i) => ({
    id: c.id,
    title: c.file_name,
    code: c.document_code,
    content_sample: c.sampleText,
  })),
  null,
  2
)}`,
      });

      const parsedResults = JSON.parse(evaluateRes.text.replace(/```json|```/g, '').trim());

      return NextResponse.json({
        success: true,
        results: Array.isArray(parsedResults) ? parsedResults : [],
        keywords,
        totalScanned: allDocs.length,
        candidatesFound: candidates.length,
      });
    } catch (evalErr) {
      console.warn('[AI Search] Gemini evaluation failed, falling back to raw candidates:', evalErr);
      // Fallback nếu Gemini chấm điểm bị lỗi: trả về danh sách candidates cùng sample text
      return NextResponse.json({
        success: true,
        results: topCandidates.map((c) => ({
          id: c.id,
          relevance: 'high',
          snippet: c.sampleText ? `Trích nội dung: "...${c.sampleText.slice(0, 160)}..."` : 'Trùng khớp theo từ khóa',
        })),
        keywords,
        totalScanned: allDocs.length,
        candidatesFound: candidates.length,
      });
    }
  } catch (err: any) {
    console.error('[AI Search API Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi trong quá trình tìm kiếm bằng AI' },
      { status: 500 }
    );
  }
}

