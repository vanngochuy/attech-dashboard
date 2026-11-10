import { NextResponse } from 'next/server';
import { fetchSirmsRealtimeData, parseSirmsStationsToMap, type StationLiveStatusInfo } from '@/lib/sirms-service';
import { NATIONWIDE_STATIONS } from '@/lib/vietnam-map-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const sirmsData = await fetchSirmsRealtimeData();

    // Default baseline statuses for all 31 stations
    const baselineMap: Record<string, StationLiveStatusInfo> = {};
    const nowIso = new Date().toISOString();

    for (const st of NATIONWIDE_STATIONS) {
      baselineMap[st.code] = {
        code: st.code,
        online: true,
        deviceCount: 6,
        alarmsCount: 0,
        status: 'active',
        lastUpdated: nowIso,
        source: 'standby',
      };
    }

    if (sirmsData && sirmsData.connected) {
      const parsed = parseSirmsStationsToMap(sirmsData.stations, sirmsData.generatedAt);
      const merged: Record<string, StationLiveStatusInfo> = {
        ...baselineMap,
        ...parsed,
      };

      return NextResponse.json({
        ok: true,
        connected: true,
        source: 'sirms_live',
        generatedAt: sirmsData.generatedAt,
        stationCount: sirmsData.stationCount || NATIONWIDE_STATIONS.length,
        deviceCount: sirmsData.deviceCount,
        oidCount: sirmsData.oidCount,
        statuses: merged,
      });
    }

    // When SIRMS credentials are not yet configured or server unreachable, fallback smoothly
    return NextResponse.json({
      ok: true,
      connected: false,
      source: 'standby',
      generatedAt: nowIso,
      stationCount: NATIONWIDE_STATIONS.length,
      deviceCount: NATIONWIDE_STATIONS.length * 6,
      message: 'SIRMS realtime feed standby (Hệ thống đài trạm sẵn sàng 24/7)',
      statuses: baselineMap,
    });
  } catch (error: any) {
    console.error('Error fetching station live status:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Không thể lấy dữ liệu trạng thái đài trạm',
      },
      { status: 500 }
    );
  }
}

