import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';
import { readAuditLogs, recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthSession(token);

  if (!session || session.role !== 'admin') {
    return NextResponse.json(
      { error: 'Chỉ Quản trị viên (Admin) mới có quyền xem Nhật ký kiểm toán (Audit Log).' },
      { status: 403 }
    );
  }

  const logs = await readAuditLogs();
  return NextResponse.json({
    success: true,
    logs,
  });
}

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthSession(token);
    if (!session) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    await recordAuditLog(req, {
      username: session.username,
      role: session.role,
      department: session.departmentScope || 'ALL',
      action: body.action || 'VIEW_PDF',
      targetId: body.targetId,
      targetTitle: body.targetTitle,
      details: body.details,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Lỗi ghi log' }, { status: 500 });
  }
}

