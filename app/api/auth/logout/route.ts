import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';
import { recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthSession(token);
    if (session) {
      await recordAuditLog(req, {
        username: session.username,
        role: session.role,
        department: session.departmentScope || 'ALL',
        action: 'LOGOUT',
        details: 'Đăng xuất phiên làm việc',
      });
    }
  } catch {
    // Ignore audit log error on logout
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
