import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { id, drive_file_id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Thiếu Document ID để xóa.' },
        { status: 400 }
      );
    }

    // 1. Gọi n8n webhook để kích hoạt lệnh xóa file gốc trên Google Drive (nếu có drive_file_id)
    if (drive_file_id) {
      const n8nBaseUrl = process.env.N8N_WEBHOOK_URL
        ? process.env.N8N_WEBHOOK_URL.replace('/document-upload', '/document-delete')
        : 'http://localhost:5678/webhook/document-delete';

      const n8nDeleteUrl = process.env.N8N_DELETE_WEBHOOK_URL || n8nBaseUrl;

      try {
        console.log(`[Delete API] Gửi yêu cầu xóa file Drive ${drive_file_id} sang n8n: ${n8nDeleteUrl}`);
        const n8nRes = await fetch(n8nDeleteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, drive_file_id }),
        });
        if (!n8nRes.ok) {
          console.warn(`[Delete API] n8n phản hồi không thành công: ${n8nRes.status}`);
        }
      } catch (n8nErr: any) {
        console.warn(`[Delete API] Không thể kết nối tới n8n để xóa file Drive:`, n8nErr.message);
        // Không block việc xóa trong DB nếu n8n tạm thời chưa bật
      }
    }

    // 2. Xóa bản ghi trong Supabase
    // Xóa trước trong document_embeddings nếu có
    await supabase.from('document_embeddings').delete().eq('document_id', id);

    // Xóa trong document_files
    const { error: dbError } = await supabase
      .from('document_files')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('[Delete API] Lỗi xóa bản ghi trong Supabase:', dbError);
      return NextResponse.json(
        { error: dbError.message || 'Lỗi khi xóa tài liệu khỏi Supabase.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa tài liệu khỏi hệ thống và kích hoạt lệnh xóa trên Google Drive.'
    });

  } catch (err: any) {
    console.error('[Delete API] Lỗi hệ thống:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xử lý yêu cầu xóa tài liệu.' },
      { status: 500 }
    );
  }
}
