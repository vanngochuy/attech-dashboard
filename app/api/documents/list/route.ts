import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase';

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

    return NextResponse.json({
      configured: true,
      documents: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { configured: false, documents: [], error: err.message || 'Lỗi tải danh sách tài liệu' },
      { status: 500 }
    );
  }
}

