import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // N8N Webhook URL (cấu hình trong file .env.local)
    // Ví dụ: https://n8n.your-domain.com/webhook/document-upload
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_URL is not configured' },
        { status: 500 }
      );
    }

    // Proxy request tới n8n webhook
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
      // Không cần set Content-Type, fetch sẽ tự set boundary cho FormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n Webhook Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to process document in n8n' },
        { status: response.status }
      );
    }

    // N8n trả về kết quả
    const data = await response.json().catch(() => ({ status: 'ok' }));
    
    return NextResponse.json({
      success: true,
      message: 'Document uploaded and sent to n8n for processing successfully',
      data
    });
    
  } catch (error: any) {
    console.error('Error in Document Upload API Proxy:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
