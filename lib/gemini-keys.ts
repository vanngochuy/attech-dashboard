import { cleanEnv } from './supabase';

/**
 * Trình quản lý Gemini API Key đa nhiệm (Key Rotation & Failover Pool)
 * 
 * Hỗ trợ các định dạng trong file .env.local:
 * 1. Nhiều key trong cùng 1 biến cách nhau bằng dấu phẩy:
 *    GEMINI_API_KEY="AIzaSyKey1..., AIzaSyKey2..., AIzaSyKey3..."
 * 
 * 2. Đặt tên nhiều biến độc lập:
 *    GEMINI_API_KEY_1="AIzaSyKey1..."
 *    GEMINI_API_KEY_2="AIzaSyKey2..."
 *    GEMINI_API_KEY_3="AIzaSyKey3..."
 * 
 * 3. Hoặc biến GEMINI_API_KEYS="key1, key2"
 */

let currentKeyIndex = 0;

export function getAllGeminiApiKeys(): string[] {
  const keysSet = new Set<string>();

  const rawKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEYS,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  ];

  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) rawKeys.push(k);
  }

  for (const raw of rawKeys) {
    if (!raw) continue;
    const parts = raw.split(/[,;\n\r]+/);
    for (const part of parts) {
      const clean = cleanEnv(part);
      if (
        clean &&
        clean !== 'YOUR_GEMINI_API_KEY' &&
        clean !== 'YOUR_API_KEY' &&
        clean.length > 10
      ) {
        keysSet.add(clean);
      }
    }
  }

  return Array.from(keysSet);
}

/**
 * Lấy API key tiếp theo theo cơ chế Round-Robin (luân phiên xoay vòng giữa các key)
 */
export function getNextGeminiApiKey(): string {
  const keys = getAllGeminiApiKeys();
  if (keys.length === 0) return '';
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return keys[currentKeyIndex];
}

/**
 * Lấy API key đầu tiên (dùng làm mặc định)
 */
export function getPrimaryGeminiApiKey(): string {
  const keys = getAllGeminiApiKeys();
  return keys[0] || '';
}

/**
 * Tự động thực thi lệnh gọi Gemini AI và tự động đổi key khác (Failover)
 * nếu gặp lỗi 429 (ResourceExhausted / Rate limit / Hết quota)
 */
export async function executeWithGeminiKeyRotation<T>(
  apiCall: (apiKey: string) => Promise<T>
): Promise<T> {
  const keys = getAllGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY hợp lệ trong file .env.local.');
  }

  // Bắt đầu từ vị trí xoay vòng tiếp theo
  let startIndex = currentKeyIndex % keys.length;
  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const keyIndex = (startIndex + i) % keys.length;
    const apiKey = keys[keyIndex];

    try {
      const result = await apiCall(apiKey);
      currentKeyIndex = (keyIndex + 1) % keys.length; // Lưu vị trí thành công tiếp theo
      return result;
    } catch (err: any) {
      lastError = err;
      const errMsg = (err?.message || String(err)).toLowerCase();
      const isRateLimited =
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('resource_exhausted') ||
        errMsg.includes('rate limit');

      if (isRateLimited && keys.length > 1) {
        console.warn(`[Gemini Rotation] Key #${keyIndex + 1} chạm giới hạn quota (429). Tự động chuyển sang key #${((keyIndex + 1) % keys.length) + 1}...`);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Tất cả các Gemini API key đều đã chạm giới hạn quota.');
}

