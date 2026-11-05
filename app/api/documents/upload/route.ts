import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isSupabaseAdminConfigured, cleanEnv } from '@/lib/supabase';
import { extractDocumentOcr } from '@/lib/ocr';
import { resolveDriveFolderId } from '@/lib/drive-folders';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const replacesDocId = formData.get('replaces_doc_id') as string | null;
    const initialStatus = formData.get('initial_status') as string | null; // 'SUPERSEDED' nếu tải lên văn bản có ngày ban hành cũ hơn bản hiện có
    const skipOcr = formData.get('skip_ocr') === 'true';
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string | null)?.trim() || '';
    const scopeDomain = (formData.get('scope_domain') as string | null) || 'QL_KY_THUAT';

    // Tự động lấy Google Drive Folder ID từ cấu hình trung tâm `lib/drive-folders.ts`
    const targetFolderId = await resolveDriveFolderId(scopeDomain);
    formData.set('target_folder_id', targetFolderId);

    const n8nWebhookUrl = cleanEnv(process.env.N8N_WEBHOOK_URL);
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_URL is not configured' },
        { status: 500 }
      );
    }

    // Chuẩn bị buffer để chạy song song: (1) Đẩy sang n8n lưu Drive + DB, (2) Đọc OCR 1 lần bằng Gemini (nếu không bật skip_ocr)
    let fileBuffer: Buffer | null = null;
    if (file && !skipOcr) {
      const ab = await file.arrayBuffer();
      fileBuffer = Buffer.from(ab);
    }

    const [response, ocrContent] = await Promise.all([
      fetch(n8nWebhookUrl, {
        method: 'POST',
        body: formData,
      }),
      fileBuffer && file && !skipOcr
        ? extractDocumentOcr(fileBuffer, file.type || 'application/pdf', file.name)
        : Promise.resolve(null),
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n Webhook Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to process document in n8n' },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({ status: 'ok' }));

    if (isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // 1. Lưu kết quả OCR 1 lần và/hoặc trạng thái ban đầu (nếu là văn bản lịch sử cũ hơn bản hiện hành)
        if (ocrContent || initialStatus === 'SUPERSEDED') {
          try {
            let targetDocId: string | null =
              data?.file?.id || (Array.isArray(data?.file) ? data.file[0]?.id : null) || null;

            // Nếu webhook n8n không trả trực tiếp id, tìm bản ghi mới nhất vừa tạo theo tên
            if (!targetDocId && title) {
              const { data: latestDocs } = await supabase
                .from('document_files')
                .select('id')
                .eq('file_name', title)
                .order('created_at', { ascending: false })
                .limit(1);
              if (latestDocs && latestDocs.length > 0) {
                targetDocId = latestDocs[0].id;
              }
            }

            if (targetDocId) {
              const updatePayload: Record<string, any> = {
                updated_at: new Date().toISOString(),
              };
              if (ocrContent) {
                updatePayload.ocr_content = ocrContent;
              }
              if (initialStatus === 'SUPERSEDED') {
                updatePayload.status = 'SUPERSEDED';
              }

              const { error: ocrUpdateErr } = await supabase
                .from('document_files')
                .update(updatePayload)
                .eq('id', targetDocId);

              if (ocrUpdateErr) {
                console.warn('[Upload API] Lỗi cập nhật ocr_content/status vào Supabase:', ocrUpdateErr);
              } else {
                console.log(`[Upload API] Đã cập nhật văn bản mới ${targetDocId} (OCR: ${!!ocrContent}, Status: ${initialStatus || 'ACTIVE'})`);
              }
            }
          } catch (ocrSaveErr) {
            console.warn('[Upload API] Ngoại lệ khi lưu ocr_content/status:', ocrSaveErr);
          }
        }

        // 2. Nếu văn bản này thay thế văn bản cũ, cập nhật trạng thái văn bản cũ thành SUPERSEDED
        if (replacesDocId) {
          try {
            const { error: updateOldError } = await supabase
              .from('document_files')
              .update({
                status: 'SUPERSEDED',
                updated_at: new Date().toISOString(),
              })
              .eq('id', replacesDocId);
            if (updateOldError) {
              console.warn('[Upload API] Lỗi đánh dấu văn bản cũ hết hiệu lực:', updateOldError);
            } else {
              console.log(`[Upload API] Đã đánh dấu văn bản cũ ${replacesDocId} thành SUPERSEDED.`);
            }
          } catch (subErr) {
            console.warn('[Upload API] Lỗi khi xử lý Supabase replacement:', subErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      hasOcr: !!ocrContent,
      message: 'Document uploaded, OCR extracted, and saved successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error in Document Upload API Proxy:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
