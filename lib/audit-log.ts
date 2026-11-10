import { getSupabaseAdminClient, getSupabaseClient } from '@/lib/supabase';

export type AuditActionType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'VIEW_PDF'
  | 'UPLOAD_DOC'
  | 'UPDATE_DOC'
  | 'DELETE_DOC'
  | 'SCAN_AI';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  username: string;
  role: 'admin' | 'user' | 'anonymous';
  department?: string;
  action: AuditActionType;
  targetId?: string;
  targetTitle?: string;
  ip: string;
  userAgent: string;
  deviceLabel: string;
  details?: string;
}

const BUCKET_NAME = 'compliance-files';
const AUDIT_LOGS_PATH = 'data/audit_logs.json';
const MAX_AUDIT_ENTRIES = 500;

export function detectDeviceLabel(userAgent: string): string {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('iphone')) return 'iPhone (iOS)';
  if (ua.includes('ipad')) return 'iPad (iPadOS)';
  if (ua.includes('android')) return 'Điện thoại Android';
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'MacBook / macOS';
  if (ua.includes('windows')) return 'Máy tính Windows';
  if (ua.includes('linux')) return 'Máy tính Linux';
  return 'Trình duyệt Web';
}

export function extractRequestMeta(req: Request): {
  ip: string;
  userAgent: string;
  deviceLabel: string;
} {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  const deviceLabel = detectDeviceLabel(userAgent);
  return { ip, userAgent, deviceLabel };
}

export async function readAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(AUDIT_LOGS_PATH);
    if (error || !data) return [];

    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordAuditLog(
  req: Request,
  params: {
    username: string;
    role: 'admin' | 'user' | 'anonymous';
    department?: string;
    action: AuditActionType;
    targetId?: string;
    targetTitle?: string;
    details?: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (!supabase) return;

    const { ip, userAgent, deviceLabel } = extractRequestMeta(req);
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      username: params.username || 'Không xác định',
      role: params.role,
      department: params.department || 'ALL',
      action: params.action,
      targetId: params.targetId,
      targetTitle: params.targetTitle,
      ip,
      userAgent,
      deviceLabel,
      details: params.details,
    };

    const current = await readAuditLogs();
    const updated = [entry, ...current].slice(0, MAX_AUDIT_ENTRIES);

    const blob = new Blob([JSON.stringify(updated, null, 2)], {
      type: 'application/json',
    });
    await supabase.storage.from(BUCKET_NAME).upload(AUDIT_LOGS_PATH, blob, {
      contentType: 'application/json',
      upsert: true,
    });
  } catch (err) {
    console.warn('[AuditLog] Không thể ghi nhật ký kiểm toán:', err);
  }
}
