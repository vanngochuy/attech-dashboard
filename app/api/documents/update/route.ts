import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';
import { recordAuditLog } from '@/lib/audit-log';

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase chưa được cấu hình. Vui lòng kiểm tra file .env.local.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Không thể khởi tạo kết nối Supabase.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id, file_name, document_code, issuing_authority, issue_date, status, department_access } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Thiếu Document ID để cập nhật.' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (file_name !== undefined) updatePayload.file_name = file_name.trim();
    if (department_access !== undefined) updatePayload.department_access = department_access;
    if (document_code !== undefined) updatePayload.document_code = document_code.trim();
    if (issuing_authority !== undefined) updatePayload.issuing_authority = issuing_authority.trim();
    if (issue_date !== undefined) updatePayload.issue_date = issue_date ? issue_date : null;
    if (status !== undefined) updatePayload.status = status;

    const { error: updateError } = await supabase
      .from('document_files')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
        const { error: fallbackError } = await supabase
          .from('document_files')
          .update({
            file_name: updatePayload.file_name,
            department_access: updatePayload.department_access,
            updated_at: updatePayload.updated_at,
          })
          .eq('id', id);

        if (fallbackError) {
          return NextResponse.json(
            { error: fallbackError.message },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
    }

    const cookieStore = cookies();
    const session = await verifyAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    await recordAuditLog(request, {
      username: session?.username || 'admin',
      role: session?.role || 'admin',
      department: session?.departmentScope || 'ALL',
      action: 'UPDATE_DOC',
      targetId: id,
      targetTitle: file_name || document_code || id,
      details: `Cập nhật metadata văn bản (${Object.keys(updatePayload).filter((k) => k !== 'updated_at').join(', ')})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Cập nhật siêu dữ liệu thành công',
    });
  } catch (err: any) {
    console.error('[Update API] Lỗi:', err);
    return NextResponse.json(
      { error: err.message || 'Lỗi xử lý yêu cầu' },
      { status: 500 }
    );
  }
}
