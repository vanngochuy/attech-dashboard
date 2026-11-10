import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';
import { getSupabaseAdminClient, cleanEnv } from '@/lib/supabase';
import { recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Tạo Access Token từ Google Service Account (nếu Admin khóa thư mục Google Drive chỉ cho Service Account đọc)
 */
async function getGoogleServiceAccountAccessToken(): Promise<string | null> {
  const clientEmail = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !rawPrivateKey) return null;

  try {
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n').replace(/^["']+|["']+$/g, '');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claimSet}`);
    const signature = sign.sign(privateKey, 'base64url');
    const assertion = `${header}.${claimSet}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    return tokenData.access_token || null;
  } catch (err) {
    console.warn('[Drive Stream] Không thể tạo token Service Account, dùng luồng tải chuẩn:', err);
    return null;
  }
}

async function fetchPdfBufferFromDrive(driveFileId: string): Promise<Buffer | null> {
  // 1. Ưu tiên đọc qua Google Drive API v3 bằng Service Account (dành cho thư mục Drive đã khóa quyền công khai)
  const accessToken = await getGoogleServiceAccountAccessToken();
  if (accessToken) {
    const apiRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (apiRes.ok) {
      const ab = await apiRes.arrayBuffer();
      return Buffer.from(ab);
    }
  }

  // 2. Luồng tải Server-side Proxy qua Google Drive Direct Stream
  const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
  const res = await fetch(directUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'follow',
  });

  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') || '';
  let ab = await res.arrayBuffer();
  let buffer = Buffer.from(ab);

  if (contentType.includes('text/html')) {
    const htmlText = buffer.toString('utf-8');
    const confirmMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/);
    if (confirmMatch && confirmMatch[1]) {
      const confirmUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}&confirm=${confirmMatch[1]}`;
      const confirmRes = await fetch(confirmUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      if (confirmRes.ok) {
        ab = await confirmRes.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    } else {
      return null;
    }
  }

  return buffer;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthSession(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Truy cập bị từ chối (401): Vui lòng đăng nhập để xem văn bản PDF.' },
        { status: 401 }
      );
    }

    const rawId = decodeURIComponent(params.id || '').trim();
    if (!rawId) {
      return NextResponse.json({ error: 'Thiếu mã tài liệu.' }, { status: 400 });
    }

    let driveFileId = rawId;
    let docTitle = `Van-ban-ATTECH-${rawId.slice(0, 8)}.pdf`;
    let docDepts: string[] = [];

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data: docs } = await supabase
        .from('document_files')
        .select('id, file_name, drive_file_id, department_access')
        .or(`id.eq.${rawId},drive_file_id.eq.${rawId}`)
        .limit(1);

      if (docs && docs.length > 0) {
        const doc = docs[0];
        driveFileId = doc.drive_file_id || rawId;
        docTitle = doc.file_name || docTitle;
        docDepts = Array.isArray(doc.department_access) ? doc.department_access : [];
      }
    }

    // Kiểm tra phân quyền theo Phòng ban / Đài trạm (Row-Level Security cho file PDF)
    const userDept = session.departmentScope || 'ALL';
    const isStationOrAll =
      userDept === 'ALL' ||
      userDept.startsWith('Đài ') ||
      userDept.startsWith('Trạm ') ||
      userDept.includes('Tuy Hòa') ||
      userDept.includes('Cơ quan');

    if (
      session.role !== 'admin' &&
      !isStationOrAll &&
      docDepts.length > 0 &&
      !docDepts.includes(userDept) &&
      !docDepts.includes('VB_PHAP_LUAT')
    ) {
      await recordAuditLog(req, {
        username: session.username,
        role: session.role,
        department: userDept,
        action: 'VIEW_PDF',
        targetId: driveFileId,
        targetTitle: docTitle,
        details: `Bị chặn (403): Nhân sự phòng ${userDept} cố mở văn bản của phòng ${docDepts.join(', ')}`,
      });
      return NextResponse.json(
        {
          error: `Truy cập bị từ chối (403): Tài khoản thuộc phạm vi [${userDept}] không có quyền mở văn bản của chuyên ngành [${docDepts.join(', ')}].`,
        },
        { status: 403 }
      );
    }

    // Ghi Nhật ký kiểm toán (Audit Log): Ai đã xem/tải văn bản nào, lúc nào, từ thiết bị/IP nào
    await recordAuditLog(req, {
      username: session.username,
      role: session.role,
      department: userDept,
      action: 'VIEW_PDF',
      targetId: driveFileId,
      targetTitle: docTitle,
      details: 'Xem / Tải văn bản PDF qua luồng bảo mật ATTECH Proxy',
    });

    const pdfBuffer = await fetchPdfBufferFromDrive(driveFileId);
    if (!pdfBuffer || pdfBuffer.length < 100) {
      // Nếu file trên Drive quá lớn hoặc Google chặn tải trực tiếp, chuyển hướng an toàn về trang preview nội bộ sau khi đã xác thực
      return NextResponse.redirect(`https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`);
    }

    const safeAsciiFilename = docTitle
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const finalFilename = safeAsciiFilename.toLowerCase().endsWith('.pdf')
      ? safeAsciiFilename
      : `${safeAsciiFilename}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${finalFilename}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    console.error('[Stream PDF Proxy Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Lỗi tải luồng PDF bảo mật.' },
      { status: 500 }
    );
  }
}

