import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { extractDocumentOcr } from '@/lib/ocr';

export const maxDuration = 60;

/**
 * API bổ sung OCR 1 lần cho các văn bản cũ đã có trên hệ thống nhưng chưa có ocr_content.
 * Nhận doc_id + file, chạy Gemini OCR 1 lần và lưu vĩnh viễn vào cột ocr_content trên Supabase.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình Supabase Admin' }, { status: 500 });
    }
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Không thể khởi tạo Supabase client' }, { status: 500 });
    }

    const formData = await request.formData();
    const docId = formData.get('doc_id') as string | null;
    const file = formData.get('file') as File | null;

    if (!docId || !file) {
      return NextResponse.json({ error: 'Thiếu mã văn bản (doc_id) hoặc tập tin (file)' }, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    const ocrContent = await extractDocumentOcr(buffer, file.type || 'application/pdf', file.name);

    if (!ocrContent) {
      return NextResponse.json(
        { error: 'Không thể trích xuất chữ từ file này. Vui lòng kiểm tra GEMINI_API_KEY hoặc định dạng file.' },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from('document_files')
      .update({
        ocr_content: ocrContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      docId,
      charCount: ocrContent.length,
    });
  } catch (err: any) {
    console.error('[OCR API] Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý OCR' }, { status: 500 });
  }
}

