import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signAuthSession,
} from '@/lib/auth-session';
import { getSupabaseClient } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/audit-log';
import { TUY_HOA_STAFF_ACCOUNTS, ATTECH_STATIONS } from '@/lib/stations';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body?.mode === 'admin' ? 'admin' : 'user';

    // Đọc thông tin xác thực từ biến môi trường Server/Vercel
    const adminUser = (process.env.ATTECH_ADMIN_USER || 'huyvn').trim().toLowerCase();
    const adminPassword = (process.env.ATTECH_ADMIN_PASSWORD || '1234').trim();
    const staffPin = (process.env.ATTECH_STAFF_PIN || '1234').trim();

    // 1. Chế độ Đăng nhập Quản trị viên (Admin)
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
        await recordAuditLog(req, {
          username: inputUser || 'unknown',
          role: 'anonymous',
          action: 'LOGIN_FAILED',
          details: 'Đăng nhập Admin thất bại (Sai tài khoản hoặc mật khẩu)',
        });
        return NextResponse.json(
          { error: 'Tài khoản hoặc mật khẩu Quản trị viên không chính xác.' },
          { status: 401 }
        );
      }

      const token = await signAuthSession('admin', adminUser, 'ALL');
      await recordAuditLog(req, {
        username: adminUser,
        role: 'admin',
        department: 'ALL',
        action: 'LOGIN_SUCCESS',
        details: 'Đăng nhập Quản trị viên (Toàn quyền hệ thống)',
      });

      const res = NextResponse.json({
        success: true,
        role: 'admin',
        username: adminUser,
        departmentScope: 'ALL',
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

    // 2. Chế độ Nhân viên ATTECH (Xác thực theo Đài trạm & Nhân sự đài Tuy Hòa)
    const inputPass = String(body?.pin || '').trim();
    const rawIdentity = String(body?.identity || '').trim();
    const requestedDept = String(body?.departmentScope || 'Đài DVOR/DME Tuy Hòa').trim();

    if (!rawIdentity) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Tài khoản hoặc Email cán bộ.' },
        { status: 400 }
      );
    }

    if (!inputPass) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Mật khẩu truy cập (mặc định: 1234).' },
        { status: 400 }
      );
    }

    // Chuẩn hóa mã tài khoản (ví dụ: huyvn@attech.com.vn -> huyvn)
    const normalizedAccount = rawIdentity
      .toLowerCase()
      .replace(/@attech\.com\.vn$/, '')
      .trim();

    let authenticated = false;
    let staffDisplayName = rawIdentity;
    let resolvedDeptScope = requestedDept;

    // Kiểm tra nhân sự thuộc Đài DVOR/DME Tuy Hòa: huyvn, hainh, linhct, hoanglm
    const tuyHoaMember = TUY_HOA_STAFF_ACCOUNTS[normalizedAccount];
    if (tuyHoaMember) {
      // Xác thực mật khẩu nhân sự Tuy Hòa (mặc định 1234)
      if (inputPass === tuyHoaMember.defaultPass || inputPass === '1234' || inputPass === staffPin || inputPass === adminPassword) {
        authenticated = true;
        staffDisplayName = normalizedAccount;
        resolvedDeptScope = 'Đài DVOR/DME Tuy Hòa';
      } else {
        await recordAuditLog(req, {
          username: normalizedAccount,
          role: 'anonymous',
          department: 'Đài DVOR/DME Tuy Hòa',
          action: 'LOGIN_FAILED',
          details: `Đài DVOR/DME Tuy Hòa: Nhập sai mật khẩu cho tài khoản [${normalizedAccount}]`,
        });
        return NextResponse.json(
          { error: `Mật khẩu không chính xác cho tài khoản cán bộ "${normalizedAccount}".` },
          { status: 401 }
        );
      }
    } else {
      // 1. Thử xác thực qua Supabase Auth nếu là email
      if (rawIdentity.includes('@')) {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
              email: rawIdentity,
              password: inputPass,
            });
            if (!supaErr && supaAuth?.user) {
              authenticated = true;
            }
          }
        } catch {
          // Ignore
        }
      }

      // 2. Mật khẩu chuẩn cho các đài trạm / nhân viên khác
      if (!authenticated) {
        if (inputPass === '1234' || inputPass.toLowerCase() === staffPin.toLowerCase() || inputPass === adminPassword) {
          authenticated = true;
          staffDisplayName = normalizedAccount;
        }
      }
    }

    if (!authenticated) {
      await recordAuditLog(req, {
        username: rawIdentity,
        role: 'anonymous',
        department: requestedDept,
        action: 'LOGIN_FAILED',
        details: `Nhập sai mật khẩu truy cập (Đài trạm: ${requestedDept})`,
      });
      return NextResponse.json(
        { error: 'Mật khẩu truy cập không chính xác. Mặc định là 1234.' },
        { status: 401 }
      );
    }

    const token = await signAuthSession('user', staffDisplayName, resolvedDeptScope);
    await recordAuditLog(req, {
      username: staffDisplayName,
      role: 'user',
      department: resolvedDeptScope,
      action: 'LOGIN_SUCCESS',
      details: `Đăng nhập thành công (Đơn vị: ${resolvedDeptScope})`,
    });

    const res = NextResponse.json({
      success: true,
      role: 'user',
      username: staffDisplayName,
      departmentScope: resolvedDeptScope,
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
