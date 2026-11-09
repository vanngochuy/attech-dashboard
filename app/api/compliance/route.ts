import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, getSupabaseClient, cleanEnv } from '@/lib/supabase';
import {
  DEFAULT_LICENSES,
  DEFAULT_TRAINING_RECORDS,
  DEFAULT_EMAIL_DRAFTS,
  LicenseItem,
  StaffTrainingRecord,
  EmailDraftItem,
  sortDraftsByReceivedDate,
} from '@/lib/compliance';
import { resolveDriveFolderId, DRIVE_FOLDER_MAP } from '@/lib/drive-folders';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'compliance-files';
const LICENSES_PATH = 'data/licenses.json';
const TRAINING_PATH = 'data/training.json';
const EMAIL_DRAFTS_PATH = 'data/email_drafts.json';

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

    if (type === 'email_drafts') {
      const rawDrafts = await readJsonFromStorage<EmailDraftItem[]>(
        supabase,
        EMAIL_DRAFTS_PATH,
        DEFAULT_EMAIL_DRAFTS
      );
      const emailDrafts = sortDraftsByReceivedDate(rawDrafts, 'desc');
      return NextResponse.json({ configured: true, emailDrafts });
    }

    const [licenses, training, rawDrafts] = await Promise.all([
      readJsonFromStorage<LicenseItem[]>(supabase, LICENSES_PATH, DEFAULT_LICENSES),
      readJsonFromStorage<StaffTrainingRecord[]>(
        supabase,
        TRAINING_PATH,
        DEFAULT_TRAINING_RECORDS
      ),
      readJsonFromStorage<EmailDraftItem[]>(
        supabase,
        EMAIL_DRAFTS_PATH,
        DEFAULT_EMAIL_DRAFTS
      ),
    ]);
    const emailDrafts = sortDraftsByReceivedDate(rawDrafts, 'desc');

    return NextResponse.json({ configured: true, licenses, training, emailDrafts });
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

    // 1. Upload file PDF / Ảnh đính kèm cho Giấy phép, Hồ sơ huấn luyện hoặc Tài liệu chưa xác thực
    //    -> Lưu đồng thời lên Google Drive (qua n8n giống tab Tài liệu) + Supabase Storage dự phòng 24/7
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const folder = (formData.get('folder') as string) || 'attachments';
      const customTitle = (formData.get('title') as string | null)?.trim() || '';

      if (!file) {
        return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 });
      }

      // Ánh xạ sang đúng nhánh thư mục trên Google Drive theo cây ATTECH_DOCUMENTS:
      // - licenses     -> ATTECH_DOCUMENTS/GIẤY PHÉP-CHỨNG CHỈ/GIẤY PHÉP-CC
      // - training     -> ATTECH_DOCUMENTS/GIẤY PHÉP-CHỨNG CHỈ/CHỨNG CHỈ
      // - email-drafts -> ATTECH_DOCUMENTS/TÀI LIỆU CHƯA XÁC THỰC
      const driveCodeKey =
        folder === 'licenses'
          ? 'GIAY_PHEP_CC'
          : folder === 'training'
            ? 'CHUNG_CHI_HL'
            : folder === 'email-drafts'
              ? 'TAI_LIEU_CHUA_XAC_THUC'
              : 'GIAY_PHEP_CC';

      const targetDriveFolderId = await resolveDriveFolderId(driveCodeKey);
      const driveRelativePath =
        DRIVE_FOLDER_MAP[driveCodeKey]?.relativePath || 'ATTECH_DOCUMENTS';

      const safeName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const storagePath = `${folder}/${Date.now()}_${safeName}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Chạy song song: (A) Tải lên Google Drive qua luồng n8n (giống tab Tài liệu) & (B) Lưu bản sao trên Supabase Storage
      const n8nWebhookUrl = cleanEnv(process.env.N8N_WEBHOOK_URL);

      const driveUploadPromise = (async () => {
        if (!n8nWebhookUrl) return null;
        try {
          const n8nFd = new FormData();
          const blobFile = new File([buffer], file.name, {
            type: file.type || 'application/pdf',
          });
          n8nFd.append('file', blobFile);
          n8nFd.append('title', customTitle || file.name.replace(/\.[^/.]+$/, ''));
          n8nFd.append('scope_domain', driveCodeKey);
          n8nFd.append('target_folder_id', targetDriveFolderId);
          n8nFd.append('skip_db_insert', 'true');

          const n8nRes = await fetch(n8nWebhookUrl, {
            method: 'POST',
            body: n8nFd,
          });
          if (!n8nRes.ok) return null;
          const n8nData = await n8nRes.json();
          const driveFileId =
            n8nData?.drive_file_id ||
            n8nData?.file?.drive_file_id ||
            n8nData?.file?.id ||
            null;
          const driveViewUrl =
            n8nData?.drive_view_url ||
            n8nData?.file?.drive_view_url ||
            n8nData?.file?.webViewLink ||
            (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);

          return driveFileId ? { driveFileId, driveViewUrl } : null;
        } catch (err) {
          console.warn('[Compliance Upload] Không kết nối được n8n local, dùng bản lưu Supabase:', err);
          return null;
        }
      })();

      const supabaseUploadPromise = supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });

      const [driveResult, { error: uploadError }] = await Promise.all([
        driveUploadPromise,
        supabaseUploadPromise,
      ]);

      const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      const supabaseUrl = !uploadError ? pubData.publicUrl : '';

      // Ưu tiên trả về link Google Drive (nếu đã đẩy lên Google Drive thành công giống tab Tài liệu)
      const finalFileUrl = driveResult?.driveViewUrl || supabaseUrl;

      if (!finalFileUrl) {
        return NextResponse.json(
          { error: 'Không thể tải file lên Google Drive hoặc Supabase Storage.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        fileUrl: finalFileUrl,
        supabaseBackupUrl: supabaseUrl,
        driveFileId: driveResult?.driveFileId || null,
        driveFolderId: targetDriveFolderId,
        driveRelativePath,
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

    if (type === 'email_drafts' && Array.isArray(records)) {
      const sortedRecords = sortDraftsByReceivedDate(records, 'desc');
      const ok = await writeJsonToStorage(supabase, EMAIL_DRAFTS_PATH, sortedRecords);
      if (!ok) {
        return NextResponse.json(
          { error: 'Không thể lưu danh sách văn bản email dự thảo.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, emailDrafts: sortedRecords });
    }

    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  } catch (err: any) {
    console.error('Lỗi POST /api/compliance:', err);
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 });
  }
}

