import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';

// Danh sách các API nhạy cảm bắt buộc phải có quyền Quản trị viên (Admin)
const ADMIN_ONLY_API_PREFIXES = [
  '/api/documents/delete',
  '/api/documents/update',
  '/api/documents/upload',
  '/api/documents/scan-ai',
  '/api/documents/sync',
  '/api/documents/ocr',
  '/api/documents/extract-metadata',
  '/api/documents/check-duplicate',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Cho phép các API xác thực (/api/auth/login, /api/auth/logout, /api/auth/me) đi qua
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // 2. Bảo vệ toàn bộ các API (/api/documents/list, /api/chat, /api/tasks/..., /api/compliance...)
  if (pathname.startsWith('/api/')) {
    // Cho phép luồng tự động n8n đi qua nếu có mã bí mật nội bộ hợp lệ
    const webhookSecret = process.env.ATTECH_WEBHOOK_SECRET?.trim();
    const requestWebhookSecret = req.headers.get('x-attech-webhook-secret')?.trim();
    if (webhookSecret && requestWebhookSecret && webhookSecret === requestWebhookSecret) {
      return NextResponse.next();
    }

    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthSession(token);

    // Chặn 100% truy cập API nếu chưa có Cookie đăng nhập hợp lệ
    if (!session) {
      return NextResponse.json(
        {
          error:
            'Truy cập bị từ chối (401): Vui lòng đăng nhập hệ thống ATTECH để tra cứu tài liệu.',
        },
        { status: 401 }
      );
    }

    // Chặn 100% các API nhạy cảm nếu Cookie không phải là quyền Admin
    const isAdminOnlyRoute = ADMIN_ONLY_API_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (isAdminOnlyRoute && session.role !== 'admin') {
      return NextResponse.json(
        {
          error:
            'Truy cập bị từ chối (403): Chức năng thêm, sửa, xóa và quét AI tài liệu chỉ dành cho Quản trị viên (Admin).',
        },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};

