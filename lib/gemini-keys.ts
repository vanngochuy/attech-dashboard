import { cleanEnv } from './supabase';

/**
 * Trình quản lý Gemini API Key đa nhiệm (Key Rotation & Failover Pool)
 * 
 * Hỗ trợ linh hoạt không giới hạn số lượng key trong file .env.local:
 * 1. Nhiều key trong cùng 1 biến (phân tách bằng dấu phẩy, chấm phẩy hoặc xuống dòng):
 *    GEMINI_API_KEY="AIzaSy1..., AIzaSy2..., AIzaSy3..."
 * 
 * 2. Đặt tên nhiều biến độc lập tăng dần:
 *    GEMINI_API_KEY_1="AIzaSy1..."
 *    GEMINI_API_KEY_2="AIzaSy2..."
 *    GEMINI_API_KEY_3="AIzaSy3..."
 *    ... (GEMINI_API_KEY_N bất kỳ không giới hạn)
 * 
 * 3. Tự động phát hiện mọi biến môi trường có tiền tố GEMINI_API_KEY*
 */

let currentKeyIndex = 0;

export function getAllGeminiApiKeys(): string[] {
  const keysSet = new Set<string>();

  const rawKeys: string[] = [];

  // 1. Quét tự động toàn bộ Object.keys(process.env) khớp mẫu GEMINI_API_KEY*
  try {
    for (const envKey of Object.keys(process.env)) {
      if (/^(NEXT_PUBLIC_)?GEMINI_API_KEY(_\d+)?$/i.test(envKey) || /^(NEXT_PUBLIC_)?GEMINI_API_KEYS$/i.test(envKey)) {
        const val = process.env[envKey];
        if (val) rawKeys.push(val);
      }
    }
  } catch (e) {
    // Fallback nếu Object.keys(process.env) bị hạn chế trong môi trường runtime
  }

  // 2. Quét dự phòng trực tiếp từ 1 đến 50
  for (let i = 1; i <= 50; i++) {
    const val = process.env[`GEMINI_API_KEY_${i}`];
    if (val) rawKeys.push(val);
  }

  // 3. Các biến mặc định tiêu chuẩn
  if (process.env.GEMINI_API_KEY) rawKeys.push(process.env.GEMINI_API_KEY);
  if (process.env.GEMINI_API_KEYS) rawKeys.push(process.env.GEMINI_API_KEYS);
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) rawKeys.push(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

  // Phân tách dấu phẩy, chấm phẩy, xuống dòng và chuẩn hóa
  for (const raw of rawKeys) {
    if (!raw) continue;
    const parts = raw.split(/[,;\n\r\s]+/);
    for (const part of parts) {
      const clean = cleanEnv(part);
      if (
        clean &&
        clean !== 'YOUR_GEMINI_API_KEY' &&
        clean !== 'YOUR_API_KEY' &&
        clean.length > 15
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
 * Kiểm tra xem lỗi trả về từ API có phải là lỗi giới hạn hạn mức (Rate limit / Quota) hay không
 */
export function isRateLimitError(err: any): boolean {
  const errMsg = (err?.message || String(err)).toLowerCase();
  return (
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errMsg.includes('resource_exhausted') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('rate_limit') ||
    errMsg.includes('too many requests')
  );
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

  let startIndex = currentKeyIndex % keys.length;
  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const keyIndex = (startIndex + i) % keys.length;
    const apiKey = keys[keyIndex];

    try {
      const result = await apiCall(apiKey);
      currentKeyIndex = (keyIndex + 1) % keys.length;
      return result;
    } catch (err: any) {
      lastError = err;
      if (isRateLimitError(err) && keys.length > 1) {
        console.warn(
          `[Gemini Rotation] Key #${keyIndex + 1}/${keys.length} chạm giới hạn quota (429). Tự động chuyển sang key #${((keyIndex + 1) % keys.length) + 1}...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Tất cả các Gemini API key đều đã chạm giới hạn quota.');
}

/**
 * Thực thi thông minh đa tầng mô hình (Model Cascade / Fallback):
 * Thử mô hình ưu tiên cao trước (ví dụ gemini-3.8-flash cho độ chính xác thị giác cao).
 * Nếu xảy ra lỗi (hết quota 429, mô hình không khả dụng 404, quá tải 503...),
 * tự động hạ tầng xuống mô hình dự phòng kế tiếp (ví dụ gemini-3.5-flash-lite)
 * để đảm bảo hệ thống không bao giờ bị dừng hoạt động hoặc báo lỗi cho người dùng.
 */
export async function executeWithModelFallback<T>(
  models: string[],
  apiCall: (model: string, apiKey: string) => Promise<T>
): Promise<T> {
  let lastError: any = null;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    try {
      return await executeWithGeminiKeyRotation(async (apiKey) => {
        return await apiCall(model, apiKey);
      });
    } catch (err: any) {
      lastError = err;
      if (m < models.length - 1) {
        console.warn(
          `[Gemini Model Fallback] Mô hình "${model}" gặp sự cố (${err?.message || err}). Tự động chuyển tầng dự phòng sang "${models[m + 1]}"...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

