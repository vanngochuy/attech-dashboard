import { NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signAuthSession,
} from '@/lib/auth-session';
import { getSupabaseClient } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

// Bảng mã PIN riêng theo từng Phòng ban / Chuyên ngành (Nếu Admin cấu hình trên Vercel)
function resolveDepartmentPinMap(): Record<string, string> {
  return {
    ALL: (process.env.ATTECH_STAFF_PIN || 'attech2026').trim(),
    CNS: (process.env.ATTECH_PIN_CNS || '').trim(),
    QL_KY_THUAT: (process.env.ATTECH_PIN_QLKT || '').trim(),
    SMS: (process.env.ATTECH_PIN_SMS || '').trim(),
    CONG_TRINH_HK: (process.env.ATTECH_PIN_CTHK || '').trim(),
    CANG_HK: (process.env.ATTECH_PIN_CHK || '').trim(),
    QL_DAU_TU: (process.env.ATTECH_PIN_DAUTU || '').trim(),
    QTCL: (process.env.ATTECH_PIN_QTCL || '').trim(),
    VB_PHAP_LUAT: (process.env.ATTECH_PIN_PLQC || '').trim(),
  };
}

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

    // Chế độ Nhân viên ATTECH (Email @attech.com.vn + Phân quyền Phòng ban + Mã PIN / Supabase Auth)
    const inputPin = String(body?.pin || '').trim();
    const rawIdentity = String(body?.identity || '').trim();
    const requestedDept = String(body?.departmentScope || 'ALL').trim() || 'ALL';
    const staffIdentity = rawIdentity || 'Nhân viên ATTECH';

    if (!inputPin) {
      return NextResponse.json(
        { error: 'Vui lòng nhập Mã truy cập nội bộ ATTECH (PIN) hoặc mật khẩu email.' },
        { status: 400 }
      );
    }

    // 1. Hỗ trợ xác thực qua Supabase Auth nếu nhân sự nhập email @attech.com.vn đã đăng ký trên Supabase
    let authenticatedViaSupabase = false;
    if (rawIdentity.includes('@')) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: supaAuth, error: supaErr } = await supabase.auth.signInWithPassword({
            email: rawIdentity,
            password: inputPin,
          });
          if (!supaErr && supaAuth?.user) {
            authenticatedViaSupabase = true;
          }
        }
      } catch {
        // Fallback to PIN check
      }
    }

    // 2. Kiểm tra Mã PIN nội bộ (Hỗ trợ cả PIN chung công ty và PIN riêng theo từng Phòng ban)
    const deptPinMap = resolveDepartmentPinMap();
    const specificDeptPin = deptPinMap[requestedDept] || '';
    let resolvedDeptScope = requestedDept;

    // Nếu người dùng nhập một mã PIN khớp với một phòng ban cụ thể
    let matchedSpecificDept: string | null = null;
    for (const [deptKey, pinVal] of Object.entries(deptPinMap)) {
      if (deptKey !== 'ALL' && pinVal && inputPin.toLowerCase() === pinVal.toLowerCase()) {
        matchedSpecificDept = deptKey;
        break;
      }
    }

    const isGeneralPinValid =
      inputPin.toLowerCase() === staffPin.toLowerCase() ||
      inputPin === adminPassword ||
      (specificDeptPin && inputPin.toLowerCase() === specificDeptPin.toLowerCase()) ||
      matchedSpecificDept !== null;

    if (matchedSpecificDept && requestedDept === 'ALL') {
      resolvedDeptScope = matchedSpecificDept;
    }

    if (!authenticatedViaSupabase && !isGeneralPinValid) {
      await recordAuditLog(req, {
        username: staffIdentity,
        role: 'anonymous',
        department: requestedDept,
        action: 'LOGIN_FAILED',
        details: `Nhập sai mã PIN nội bộ (Phòng ban: ${requestedDept})`,
      });
      return NextResponse.json(
        { error: 'Mã truy cập nội bộ (PIN) không chính xác. Vui lòng liên hệ Quản trị viên ATTECH.' },
        { status: 401 }
      );
    }

    const token = await signAuthSession('user', staffIdentity, resolvedDeptScope);
    await recordAuditLog(req, {
      username: staffIdentity,
      role: 'user',
      department: resolvedDeptScope,
      action: 'LOGIN_SUCCESS',
      details: `Đăng nhập tra cứu (Phạm vi chuyên ngành: ${resolvedDeptScope})`,
    });

    const res = NextResponse.json({
      success: true,
      role: 'user',
      username: staffIdentity,
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
