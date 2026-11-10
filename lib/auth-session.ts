export type AuthRole = 'admin' | 'user';

export interface AuthSessionPayload {
  role: AuthRole;
  username: string;
  departmentScope?: string;
  iat: number;
  exp: number;
}

export const AUTH_COOKIE_NAME = 'attech_session_token';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

function getSigningSecret(): string {
  const raw =
    process.env.ATTECH_AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'attech-cns-atm-default-hmac-secret-2026';
  return raw.trim();
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  const encoder = new TextEncoder();
  return base64UrlEncodeBytes(encoder.encode(str));
}

function base64UrlDecodeToString(base64Url: string): string {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const full = padded + '='.repeat(padLen);
  const binary = atob(full);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Ký số thẻ phiên làm việc (JWT HMAC-SHA256) chạy tương thích cả trên Edge Middleware và Node API
 */
export async function signAuthSession(
  role: AuthRole,
  username: string,
  departmentScope = 'ALL',
  durationSeconds = SESSION_DURATION_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthSessionPayload = {
    role,
    username,
    departmentScope: role === 'admin' ? 'ALL' : departmentScope || 'ALL',
    iat: now,
    exp: now + durationSeconds,
  };

  const headerB64 = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey(getSigningSecret());
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  );
  const sigB64 = base64UrlEncodeBytes(new Uint8Array(sigBuffer));

  return `${signingInput}.${sigB64}`;
}

/**
 * Kiểm tra chữ ký số và hạn sử dụng của thẻ phiên làm việc từ Cookie HttpOnly
 */
export async function verifyAuthSession(token?: string | null): Promise<AuthSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  try {
    const key = await getCryptoKey(getSigningSecret());
    const padded = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLen));
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(signingInput)
    );
    if (!isValid) return null;

    const payloadJson = base64UrlDecodeToString(payloadB64);
    const payload = JSON.parse(payloadJson) as AuthSessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    if (payload.role !== 'admin' && payload.role !== 'user') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
