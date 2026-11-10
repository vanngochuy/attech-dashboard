import https from 'https';
import http from 'http';

/**
 * SIRMS Service Client
 * Implements authentication & data retrieval based on GuideAPI.md
 */

const SIRMS_BASE_URL = process.env.SIRMS_API_URL || 'https://sirms.attech.com.vn:8088';
const SIRMS_USERNAME = process.env.SIRMS_USERNAME || '';
const SIRMS_PASSWORD = process.env.SIRMS_PASSWORD || '';

// HTTPS Agent with rejectUnauthorized: false to allow connection to port 8088 internal cert
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

let cachedToken: TokenCache | null = null;
let cachedData: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25s cache

/**
 * 1) Login lấy Bearer token (theo GuideAPI.md)
 */
export async function getSirmsToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken;
  }

  if (!SIRMS_USERNAME || !SIRMS_PASSWORD) {
    return null;
  }

  try {
    const url = `${SIRMS_BASE_URL.replace(/\/$/, '')}/api/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userName: SIRMS_USERNAME,
        password: SIRMS_PASSWORD,
      }),
      // @ts-ignore
      agent: httpsAgent,
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[SIRMS] Auth failed with status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data?.accessToken) {
      const expiresInSec = data.expiresIn || 2700; // 45 phút mặc định
      cachedToken = {
        accessToken: data.accessToken,
        expiresAt: now + expiresInSec * 1000,
      };
      return data.accessToken;
    }

    return null;
  } catch (err) {
    console.warn('[SIRMS] Connection error during auth:', err);
    return null;
  }
}

/**
 * 2) Gọi dữ liệu realtime GET /all-snmps-data.json
 * 3) Xử lý hết hạn token (401 -> re-login -> retry)
 */
export async function fetchSirmsRealtimeData(): Promise<{
  connected: boolean;
  generatedAt: string;
  stationCount: number;
  deviceCount: number;
  oidCount: number;
  stations: any[];
} | null> {
  const now = Date.now();
  if (cachedData && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  let token = await getSirmsToken();
  if (!token) {
    return null;
  }

  const endpoint = `${SIRMS_BASE_URL.replace(/\/$/, '')}/all-snmps-data.json`;

  try {
    let res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      // @ts-ignore
      agent: httpsAgent,
      cache: 'no-store',
    });

    // 401 handling per GuideAPI.md: refresh token and retry
    if (res.status === 401) {
      token = await getSirmsToken(true);
      if (!token) return null;

      res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        // @ts-ignore
        agent: httpsAgent,
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      console.warn(`[SIRMS] Data fetch error with status: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const result = {
      connected: true,
      generatedAt: json.generatedAt || new Date().toISOString(),
      stationCount: json.stationCount || (json.stations ? json.stations.length : 0),
      deviceCount: json.deviceCount || 0,
      oidCount: json.oidCount || 0,
      stations: json.stations || [],
    };

    cachedData = result;
    lastCacheTime = now;
    return result;
  } catch (err) {
    console.warn('[SIRMS] Fetch error:', err);
    return null;
  }
}

/**
 * Helper chuẩn hóa dữ liệu trạng thái đài trạm cho bản đồ
 */
export interface StationLiveStatusInfo {
  code: string;
  online: boolean;
  deviceCount: number;
  alarmsCount: number;
  status: 'active' | 'warning' | 'alert';
  lastUpdated: string;
  source: 'sirms' | 'standby';
}

export function parseSirmsStationsToMap(
  sirmsStations: any[],
  generatedAt: string
): Record<string, StationLiveStatusInfo> {
  const result: Record<string, StationLiveStatusInfo> = {};

  if (!Array.isArray(sirmsStations)) return result;

  for (const st of sirmsStations) {
    const rawCode = (st.code || st.stationCode || st.id || '').toString().toUpperCase();
    const rawName = (st.name || st.stationName || '').toString().toUpperCase();

    // Devices & OIDs check
    const devices = Array.isArray(st.devices) ? st.devices : [];
    let alarms = 0;
    for (const d of devices) {
      if (d.status === 'alarm' || d.status === 'error' || d.hasAlarm || d.isError) {
        alarms++;
      }
    }

    const status: 'active' | 'warning' | 'alert' = alarms > 1 ? 'alert' : alarms === 1 ? 'warning' : 'active';

    const info: StationLiveStatusInfo = {
      code: rawCode,
      online: true,
      deviceCount: devices.length,
      alarmsCount: alarms,
      status,
      lastUpdated: generatedAt,
      source: 'sirms',
    };

    if (rawCode) result[rawCode] = info;

    // Code aliases between SIRMS and Dashboard
    const codeAliases: Record<string, string[]> = {
      TSH: ['TSN'],
      TSN: ['TSH'],
      TRN: ['CAN'],
      CAN: ['TRN'],
      AC: ['LKN'],
      LKN: ['AC'],
    };

    if (codeAliases[rawCode]) {
      for (const alias of codeAliases[rawCode]) {
        result[alias] = { ...info, code: alias };
      }
    }

    // Name-based matching fallback
    const nameMap: Record<string, string> = {
      'NỘI BÀI': 'NOB',
      'ĐẦU TÂY NỘI BÀI': 'VPH',
      'CÁT BI': 'CBI',
      'VÂN ĐỒN': 'VDO',
      'ĐIỆN BIÊN': 'DBN',
      'ĐỒNG HỚI': 'DOH',
      'NAM HÀ': 'NAH',
      'VINH': 'VIN',
      'THỌ XUÂN': 'THX',
      'PHÚ BÀI': 'HUE',
      'ĐÀ NẴNG': 'DAN',
      'PLEIKU': 'PLK',
      'PHÙ CÁT': 'PCA',
      'CHU LAI': 'CLA',
      'BUÔN MA THUỘT': 'BMT',
      'CAM RANH': 'CAR',
      'LIÊN KHƯƠNG': 'LKH',
      'TÂN SƠN NHẤT': 'TSN',
      'CẦN THƠ': 'CAN',
      'RẠCH GIÁ': 'RGI',
      'TUY HÒA': 'TUH',
      'CÔN SƠN': 'CSN',
      'PHÚ QUỐC': 'PQU',
      'LONG KHÁNH': 'LKN',
      'PHAN THIẾT': 'PTH',
      'TRƯỜNG SA LỚN': 'TSL',
      'SONG TỬ TÂY': 'STT',
      'ĐẤT MŨI': 'DMU',
      'LONG THÀNH': 'LTH',
      'CÀ MAU': 'CMA',
    };

    for (const [vnName, code] of Object.entries(nameMap)) {
      if (rawName.includes(vnName)) {
        result[code] = { ...info, code };
      }
    }
  }

  return result;
}

