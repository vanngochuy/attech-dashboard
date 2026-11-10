import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifyAuthSession } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          documents: [],
          error: 'Chưa cấu hình biến môi trường NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trên Server/Vercel.',
        },
        { status: 200 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ configured: false, documents: [] }, { status: 200 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthSession(token);

    const { data, error } = await supabase
      .from('document_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { configured: true, documents: [], error: error.message },
        { status: 500 }
      );
    }

    let docs = data || [];

    // Phân quyền cấp độ dữ liệu (Row-Level Security) theo Phòng ban / Đài trạm:
    // Cán bộ các Đài trạm (DVOR/DME, NDB, ADS-B...) và Toàn công ty được xem toàn bộ kho tài liệu kỹ thuật & pháp luật
    const userDeptScope = session?.departmentScope || 'ALL';
    const isStationOrAll =
      userDeptScope === 'ALL' ||
      userDeptScope.startsWith('Đài ') ||
      userDeptScope.startsWith('Trạm ') ||
      userDeptScope.includes('Tuy Hòa') ||
      userDeptScope.includes('Cơ quan');

    if (session && session.role !== 'admin' && !isStationOrAll) {
      docs = docs.filter((doc: any) => {
        const depts: string[] = Array.isArray(doc.department_access)
          ? doc.department_access
          : [];
        return (
          depts.includes(userDeptScope) ||
          depts.includes('VB_PHAP_LUAT') ||
          depts.length === 0
        );
      });
    }

    return NextResponse.json({
      configured: true,
      departmentScope: userDeptScope,
      documents: docs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { configured: false, documents: [], error: err.message || 'Lỗi tải danh sách tài liệu' },
      { status: 500 }
    );
  }
}
