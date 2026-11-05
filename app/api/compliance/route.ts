import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseClient } from '@/lib/supabase';
import {
  DEFAULT_LICENSES,
  DEFAULT_TRAINING_RECORDS,
  LicenseItem,
  StaffTrainingRecord,
} from '@/lib/compliance';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'compliance-files';
const LICENSES_PATH = 'data/licenses.json';
const TRAINING_PATH = 'data/training.json';

async function ensureComplianceBucket(supabase: any) {
  try {
    const { data: bucket, error } = await supabase.storage.getBucket(BUCKET_NAME);
    if (error || !bucket) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
    }
  } catch {
    // Ignore if bucket already exists
  }
}

async function readJsonFromStorage<T>(supabase: any, path: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(path);
    if (error || !data) {
      await writeJsonToStorage(supabase, path, fallback);
      return fallback;
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as unknown as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonToStorage<T>(supabase: any, path: string, payload: T): Promise<boolean> {
  try {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, blob, {
      contentType: 'application/json',
      upsert: true,
    });
    return !error;
  } catch (err) {
    console.error('Lỗi ghi JSON vào Supabase Storage:', err);
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';

    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({
        configured: false,
        licenses: DEFAULT_LICENSES,
        training: DEFAULT_TRAINING_RECORDS,
      });
    }

    await ensureComplianceBucket(supabase);

    if (type === 'licenses') {
      const licenses = await readJsonFromStorage<LicenseItem[]>(
        supabase,
        LICENSES_PATH,
        DEFAULT_LICENSES
      );
      return NextResponse.json({ configured: true, licenses });
    }

    if (type === 'training') {
      let training = await readJsonFromStorage<StaffTrainingRecord[]>(
        supabase,
        TRAINING_PATH,
        DEFAULT_TRAINING_RECORDS
      );
      // Đảm bảo nhân viên Lê Minh Hoàng luôn có trong danh sách
      const hasHoang = training.some((s) =>
        s.fullName.toLowerCase().includes('lê minh hoàng')
      );
      if (!hasHoang) {
        const hoangRecord = DEFAULT_TRAINING_RECORDS.find((s) =>
          s.fullName.toLowerCase().includes('lê minh hoàng')
        );
        if (hoangRecord) {
          training = [...training, hoangRecord];
          await writeJsonToStorage(supabase, TRAINING_PATH, training);
        }
      }
      return NextResponse.json({ configured: true, training });
    }

    const [licenses, training] = await Promise.all([
      readJsonFromStorage<LicenseItem[]>(supabase, LICENSES_PATH, DEFAULT_LICENSES),
      readJsonFromStorage<StaffTrainingRecord[]>(
        supabase,
        TRAINING_PATH,
        DEFAULT_TRAINING_RECORDS
      ),
    ]);

    return NextResponse.json({ configured: true, licenses, training });
  } catch (err: any) {
    return NextResponse.json(
      {
        configured: false,
        licenses: DEFAULT_LICENSES,
        training: DEFAULT_TRAINING_RECORDS,
        error: err.message,
      },
      { status: 200 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên server.' },
        { status: 500 }
      );
    }

    await ensureComplianceBucket(supabase);

    const contentType = req.headers.get('content-type') || '';

    // 1. Upload file PDF / Ảnh đính kèm cho Giấy phép hoặc Hồ sơ huấn luyện
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const folder = (formData.get('folder') as string) || 'attachments';

      if (!file) {
        return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 });
      }

      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const storagePath = `${folder}/${Date.now()}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: 'Không thể tải file lên Supabase Storage: ' + uploadError.message },
          { status: 500 }
        );
      }

      const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

      return NextResponse.json({
        success: true,
        fileUrl: pubData.publicUrl,
        fileName: file.name,
      });
    }

    // 2. Lưu danh sách Giấy phép hoặc Hồ sơ huấn luyện
    const body = await req.json();
    const { type, records } = body;

    if (type === 'licenses' && Array.isArray(records)) {
      const ok = await writeJsonToStorage(supabase, LICENSES_PATH, records);
      if (!ok) {
        return NextResponse.json(
          { error: 'Không thể lưu danh sách Giấy phép.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, licenses: records });
    }

    if (type === 'training' && Array.isArray(records)) {
      const ok = await writeJsonToStorage(supabase, TRAINING_PATH, records);
      if (!ok) {
        return NextResponse.json(
          { error: 'Không thể lưu danh sách Hồ sơ huấn luyện.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, training: records });
    }

    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  } catch (err: any) {
    console.error('Lỗi POST /api/compliance:', err);
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 });
  }
}

