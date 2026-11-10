import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient, isSupabaseAdminConfigured, cleanEnv } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';
import { recordAuditLog } from '@/lib/audit-log';

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase chưa được cấu hình trong .env.local' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdminClient()!;
    const { id, drive_file_id, file_name } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Thiếu Document ID để xóa.' },
        { status: 400 }
      );
    }

    // 1. Gọi n8n webhook để kích hoạt lệnh xóa file gốc trên Google Drive (nếu có drive_file_id)
    if (drive_file_id) {
      const rawWebhook = cleanEnv(process.env.N8N_WEBHOOK_URL);
      const n8nBaseUrl = rawWebhook
        ? rawWebhook.replace('/document-upload', '/document-delete')
        : 'http://localhost:5678/webhook/document-delete';

      const n8nDeleteUrl = cleanEnv(process.env.N8N_DELETE_WEBHOOK_URL) || n8nBaseUrl;

      try {
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
      }
    }

    // 2. Xóa bản ghi trong Supabase
    await supabase.from('document_embeddings').delete().eq('document_id', id);

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

    const cookieStore = cookies();
    const session = await verifyAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    await recordAuditLog(request, {
      username: session?.username || 'admin',
      role: session?.role || 'admin',
      department: session?.departmentScope || 'ALL',
      action: 'DELETE_DOC',
      targetId: drive_file_id || id,
      targetTitle: file_name || id,
      details: `Xóa văn bản khỏi hệ thống (Drive ID: ${drive_file_id || 'N/A'})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa tài liệu khỏi hệ thống và kích hoạt lệnh xóa trên Google Drive.',
    });
  } catch (err: any) {
    console.error('[Delete API] Lỗi hệ thống:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xử lý yêu cầu xóa tài liệu.' },
      { status: 500 }
    );
  }
}
