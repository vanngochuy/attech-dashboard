import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signAuthSession,
} from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body?.mode === 'admin' ? 'admin' : 'user';

    // Đọc thông tin xác thực từ biến môi trường Server/Vercel (Tuyệt đối không lộ ở Client)
    const adminUser = (process.env.ATTECH_ADMIN_USER || 'huyvn').trim().toLowerCase();
    const adminPassword = (process.env.ATTECH_ADMIN_PASSWORD || '1234').trim();
    const staffPin = (process.env.ATTECH_STAFF_PIN || 'attech2026').trim();

    if (mode === 'admin') {
      const inputUser = String(body?.username || '').trim().toLowerCase();
      const inputPass = String(body?.password || '').trim();

      if (!inputUser || !inputPass) {
        return NextResponse.json(
          { error: 'Vui lòng nhập đầy đủ Tài khoản và Mật khẩu Quản trị viên.' },
          { status: 400 }
        );
      }

      if (inputUser !== adminUser || inputPass !== adminPassword) {
        return NextResponse.json(
          { error: 'Tài khoản hoặc mật khẩu Quản trị viên không chính xác.' },
          { status: 401 }
        );
      }

      const token = await signAuthSession('admin', adminUser);
      const res = NextResponse.json({
        success: true,
        role: 'admin',
        username: adminUser,
      });

      res.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION_SECONDS,
      });

      return res;
    }

    // Chế độ Nhân viên ATTECH (Bắt buộc nhập Mã truy cập nội bộ PIN hoặc Mật khẩu công ty)
    const inputPin = String(body?.pin || '').trim();
    const staffIdentity = String(body?.identity || '').trim() || 'Nhân viên ATTECH';

    if (!inputPin) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Mã truy cập nội bộ ATTECH (PIN) để mở khóa tra cứu.' },
        { status: 400 }
      );
    }

    const isPinValid =
      inputPin.toLowerCase() === staffPin.toLowerCase() ||
      inputPin === adminPassword;

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Mã truy cập nội bộ (PIN) không chính xác. Vui lòng liên hệ Quản trị viên ATTECH.' },
        { status: 401 }
      );
    }

    const token = await signAuthSession('user', staffIdentity);
    const res = NextResponse.json({
      success: true,
      role: 'user',
      username: staffIdentity,
    });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Lỗi xử lý đăng nhập trên máy chủ.' },
      { status: 500 }
    );
  }
}
