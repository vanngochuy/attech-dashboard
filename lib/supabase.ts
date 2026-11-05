import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Làm sạch biến môi trường: tự động loại bỏ khoảng trắng và dấu ngoặc kép/đơn dư thừa
 * (tránh lỗi khi copy-paste cả dấu "..." từ .env.local lên bảng cấu hình Vercel)
 */
export function cleanEnv(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

export function isSupabaseConfigured(): boolean {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return false;
  if (url === 'YOUR_SUPABASE_URL' || key === 'YOUR_SUPABASE_ANON_KEY') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  return true;
}

export function isSupabaseAdminConfigured(): boolean {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const key = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  if (!url || !key) return false;
  if (
    url === 'YOUR_SUPABASE_URL' ||
    key === 'YOUR_SUPABASE_SERVICE_ROLE_KEY' ||
    key === 'YOUR_SUPABASE_ANON_KEY'
  ) {
    return false;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  return true;
}

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(
      cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
      cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );
  }
  return clientInstance;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const key = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return createClient(url, key);
}

// Fallback dummy proxy so importing `supabase` directly never throws at module load time
function createSafeDummy() {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: any) =>
          resolve({
            data: [],
            error: new Error('Chưa cấu hình Supabase URL / Key trong file .env.local'),
          });
      }
      return (..._args: any[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const safeDummy = createSafeDummy();

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      return (safeDummy as any)[prop];
    }
    return (client as any)[prop];
  },
});
