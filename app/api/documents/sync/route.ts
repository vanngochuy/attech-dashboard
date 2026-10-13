import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const prodWebhookUrl = 'http://localhost:5678/webhook/sync-drive-health';
    const testWebhookUrl = 'http://localhost:5678/webhook-test/sync-drive-health';

    // 1. Thử gửi tới Production Webhook
    let n8nRes = await fetch(prodWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggered_by: 'admin_web_dashboard', timestamp: new Date().toISOString() }),
    });

    // 2. Nếu trả về 404 (chưa bật Active), thử gửi tiếp tới Test Webhook
    if (n8nRes.status === 404) {
      const testRes = await fetch(testWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'admin_web_dashboard', timestamp: new Date().toISOString() }),
      });
      if (testRes.ok) {
        n8nRes = testRes;
      }
    }

    if (!n8nRes.ok) {
      return NextResponse.json(
        { 
          error: 'Workflow n8n chưa được BẬT (Active)! Hãy nhìn lên góc trên bên phải màn hình n8n, gạt công tắc Inactive sang Active (màu xanh lá) và bấm Save.',
        },
        { status: n8nRes.status }
      );
    }

    const data = await n8nRes.json().catch(() => ({ status: 'success' }));

    return NextResponse.json({
      success: true,
      message: 'Đã hoàn tất quét và đồng bộ sức khỏe tài liệu trên Google Drive.',
      data
    });
  } catch (err: any) {
    console.error('[Sync API] Lỗi kết nối n8n:', err);
    return NextResponse.json(
      { error: 'Không thể kết nối tới n8n (http://localhost:5678). Hãy kiểm tra Docker n8n đang chạy.' },
      { status: 500 }
    );
  }
}
