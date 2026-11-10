'use client';

import React, { useState, useEffect } from 'react';
import {
  VIETNAM_MAP_PATHS,
  NATIONWIDE_STATIONS,
  type StationMapPoint,
} from '@/lib/vietnam-map-data';
import { MapPin, CheckCircle2, Activity, Server, AlertTriangle } from 'lucide-react';

interface StationLiveInfo {
  code: string;
  online: boolean;
  deviceCount: number;
  alarmsCount: number;
  status: 'active' | 'warning' | 'alert';
  lastUpdated: string;
  source: 'sirms' | 'standby';
}

interface VietnamStationsMapProps {
  activeStation?: string;
  onSelectStation?: (stationName: string) => void;
  className?: string;
}

export function VietnamStationsMap({
  activeStation = 'Đài DVOR/DME Tuy Hòa',
  onSelectStation,
  className = '',
}: VietnamStationsMapProps) {
  const [hoveredStation, setHoveredStation] = useState<StationMapPoint | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, StationLiveInfo>>({});
  const [isSirmsConnected, setIsSirmsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Fetch Live Status from /api/stations/live-status (SIRMS feed)
  useEffect(() => {
    let isMounted = true;

    async function loadLiveStatus() {
      try {
        const res = await fetch('/api/stations/live-status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.ok && isMounted) {
          setIsSirmsConnected(data.connected === true);
          if (data.statuses) {
            setLiveStatuses(data.statuses);
          }
          if (data.generatedAt) {
            try {
              const dt = new Date(data.generatedAt);
              setLastSyncTime(dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            } catch {
              setLastSyncTime('Mới cập nhật');
            }
          }
        }
      } catch (err) {
        // Fallback silently if offline
      }
    }

    loadLiveStatus();
    const interval = setInterval(loadLiveStatus, 45000); // 45s refresh

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const isSelected = (station: StationMapPoint) => {
    return activeStation === station.name || activeStation.includes(station.shortName);
  };

  const getStationLiveData = (code: string): StationLiveInfo | undefined => {
    return liveStatuses[code];
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col select-none ${className}`}
      style={{ minHeight: '520px' }}
    >
      {/* Tactical radar & grid background (No rotating sweep beam) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950/70 via-sky-950/30 to-slate-950/80 border border-sky-500/20 shadow-2xl backdrop-blur-xs">
        {/* Radar concentric range rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-sky-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full border border-sky-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-sky-500/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full border border-sky-400/20" />

        {/* Radar crosshairs & angular bearings */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-sky-500/15 to-transparent" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-500/15 to-transparent" />

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.3) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top Header bar with SIRMS Live Status */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between text-xs border-b border-sky-500/20 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-sky-300 uppercase">
            HỆ THỐNG ĐÀI TRẠM CNS/ATM TOÀN QUỐC
          </span>
        </div>

        {/* SIRMS Live Feed status badge */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span
            className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 transition-colors ${
              isSirmsConnected
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                : 'bg-sky-500/15 border-sky-400/30 text-sky-300'
            }`}
          >
            <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
            <span>{isSirmsConnected ? 'SIRMS LIVE STATUS' : 'GIÁM SÁT 24/7'}</span>
          </span>
          {lastSyncTime && (
            <span className="text-slate-400 hidden sm:inline-block">
              {lastSyncTime}
            </span>
          )}
        </div>
      </div>

      {/* Main SVG Map Area */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-2 overflow-hidden">
        <svg
          viewBox="0 0 600 700"
          className="w-full h-full max-h-[580px] drop-shadow-[0_0_25px_rgba(2,132,199,0.25)]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Vietnam mainland gradient */}
            <linearGradient id="vnLandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0369a1" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.38" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Graticule grid text markers */}
          <g className="text-[9px] fill-sky-400/40 font-mono select-none">
            <text x="35" y="50">22°N</text>
            <text x="35" y="240">17°N</text>
            <text x="35" y="440">13°N</text>
            <text x="35" y="640">9°N</text>
            <text x="80" y="690">103°E</text>
            <text x="240" y="690">107°E</text>
            <text x="420" y="690">112°E</text>
            <text x="515" y="690">114°E</text>
          </g>

          {/* Vietnam Mainland & Islands SVG paths */}
          <g>
            {VIETNAM_MAP_PATHS.map((pathStr, idx) => (
              <path
                key={idx}
                d={pathStr}
                fill="url(#vnLandGrad)"
                stroke="#38bdf8"
                strokeWidth={idx === 0 ? "1.6" : "1.2"}
                strokeOpacity="0.75"
                className="transition-all duration-300 hover:fill-sky-500/30"
              />
            ))}
          </g>

          {/* Quần đảo Hoàng Sa (Paracel Islands) */}
          <g className="select-none">
            {/* Coral reefs & islets */}
            <circle cx="375" cy="285" r="3" fill="#38bdf8" opacity="0.6" />
            <circle cx="390" cy="290" r="2.5" fill="#38bdf8" opacity="0.7" />
            <circle cx="382" cy="302" r="3.5" fill="#38bdf8" opacity="0.6" />
            <circle cx="398" cy="308" r="2.5" fill="#38bdf8" opacity="0.5" />
            <circle cx="410" cy="295" r="3" fill="#38bdf8" opacity="0.65" />
            <circle cx="368" cy="298" r="2" fill="#38bdf8" opacity="0.5" />

            {/* Label */}
            <rect
              x="360"
              y="266"
              width="106"
              height="15"
              rx="3"
              fill="#0f172a"
              fillOpacity="0.8"
              stroke="#0284c7"
              strokeWidth="0.8"
            />
            <text
              x="413"
              y="277"
              textAnchor="middle"
              className="text-[8.5px] font-bold fill-sky-200 tracking-wider font-sans"
            >
              QĐ. HOÀNG SA (VN)
            </text>
          </g>

          {/* Quần đảo Trường Sa (Spratly Islands) */}
          <g className="select-none">
            {/* Coral reef clusters */}
            <circle cx="450" cy="560" r="2" fill="#38bdf8" opacity="0.5" />
            <circle cx="465" cy="580" r="2.5" fill="#38bdf8" opacity="0.6" />
            <circle cx="480" cy="570" r="2" fill="#38bdf8" opacity="0.5" />
            <circle cx="440" cy="610" r="2.5" fill="#38bdf8" opacity="0.6" />
            <circle cx="460" cy="625" r="2" fill="#38bdf8" opacity="0.5" />
            <circle cx="495" cy="590" r="2.5" fill="#38bdf8" opacity="0.55" />
            <circle cx="505" cy="540" r="2" fill="#38bdf8" opacity="0.5" />

            {/* Label */}
            <rect
              x="420"
              y="535"
              width="112"
              height="15"
              rx="3"
              fill="#0f172a"
              fillOpacity="0.8"
              stroke="#0284c7"
              strokeWidth="0.8"
            />
            <text
              x="476"
              y="546"
              textAnchor="middle"
              className="text-[8.5px] font-bold fill-sky-200 tracking-wider font-sans"
            >
              QĐ. TRƯỜNG SA (VN)
            </text>
          </g>

          {/* Flight corridors / Navaid airways (tactical dotted lines) */}
          <g stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.3">
            <line x1="196" y1="98" x2="283" y2="318" /> {/* NOB - DAN */}
            <line x1="283" y1="318" x2="325" y2="447" /> {/* DAN - TUH */}
            <line x1="325" y1="447" x2="225" y2="541" /> {/* TUH - TSN */}
            <line x1="225" y1="541" x2="126" y2="569" /> {/* TSN - PQU */}
            <line x1="325" y1="447" x2="515" y2="515" /> {/* TUH - STT */}
            <line x1="225" y1="541" x2="424" y2="634" /> {/* TSN - TSL */}
          </g>

          {/* Plot all Nationwide Stations with Real-time SIRMS Live Status */}
          {NATIONWIDE_STATIONS.map((st) => {
            const selected = isSelected(st);
            const isHovered = hoveredStation?.code === st.code;
            const isVPH = st.code === 'VPH';
            const liveData = getStationLiveData(st.code);

            // Compute dynamic status color from SIRMS (Image 3)
            let statusColor = '#10b981'; // Green normal
            let statusText = 'Bình thường';
            if (liveData) {
              if (liveData.status === 'alert') {
                statusColor = '#ef4444'; // Red alarm
                statusText = 'Báo động';
              } else if (liveData.status === 'warning') {
                statusColor = '#f59e0b'; // Orange warning
                statusText = 'Cảnh báo';
              } else if (liveData.deviceCount === 0) {
                statusColor = '#94a3b8'; // Gray standby/no devices
                statusText = 'Dự phòng';
              }
            }

            // Position VPH badge to the left of its dot, others to the right
            const badgeOffsetX = isVPH ? st.x - 32 : st.x + 6;
            const badgeOffsetY = st.y - 7;

            return (
              <g
                key={st.code}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredStation(st)}
                onMouseLeave={() => setHoveredStation(null)}
                onClick={() => onSelectStation && onSelectStation(st.name)}
              >
                {/* Active halo ring when selected or hovered */}
                {(selected || isHovered) && (
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={9}
                    fill="none"
                    stroke={statusColor}
                    strokeWidth="1.8"
                    className="animate-pulse"
                  />
                )}

                {/* Central beacon dot: Live SIRMS status color */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={selected ? 4.5 : 3.5}
                  fill={statusColor}
                  stroke="#ffffff"
                  strokeWidth={selected ? 1.5 : 1}
                  style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}
                />

                {/* Badge Container (Black pill with white/status Station Code per Image 3) */}
                <g
                  transform={`translate(${badgeOffsetX}, ${badgeOffsetY})`}
                  className="transition-transform duration-150"
                  style={{
                    transform:
                      isHovered || selected
                        ? `translate(${badgeOffsetX + (isVPH ? -1 : 1)}px, ${badgeOffsetY - 1}px) scale(1.08)`
                        : undefined,
                  }}
                >
                  <rect
                    x="0"
                    y="0"
                    width={st.code.length > 3 ? 34 : 28}
                    height="14"
                    rx="3"
                    fill={selected ? '#0f293a' : '#090d16'}
                    fillOpacity={0.92}
                    stroke={selected ? '#38bdf8' : '#334155'}
                    strokeWidth={selected ? '1.5' : '0.8'}
                  />
                  <text
                    x={st.code.length > 3 ? 17 : 14}
                    y="10.5"
                    textAnchor="middle"
                    className={`font-mono text-[9px] font-bold ${
                      selected ? 'fill-sky-300' : 'fill-white'
                    }`}
                  >
                    {st.code}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Hover / Tooltip HUD Card (Flight Ops & SIRMS SNMP Live Status) */}
        {hoveredStation && (() => {
          const live = getStationLiveData(hoveredStation.code);
          const isAlert = live?.status === 'alert';
          const isWarn = live?.status === 'warning';
          const isStandby = live && live.deviceCount === 0;

          const dotColor = isAlert ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : isWarn ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : isStandby ? 'bg-slate-400' : 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
          const statusText = isAlert ? 'Báo động (Alert)' : isWarn ? 'Cảnh báo (Warning)' : isStandby ? 'Dự phòng / Standby' : 'Bình thường (Normal)';
          const statusTextColor = isAlert ? 'text-rose-400' : isWarn ? 'text-amber-300' : isStandby ? 'text-slate-300' : 'text-emerald-300';

          return (
            <div
              className="absolute top-4 right-4 z-20 w-72 p-3.5 rounded-xl bg-slate-900/95 border border-sky-500/30 shadow-2xl backdrop-blur-md text-white pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <h4 className="font-bold text-sm text-sky-200">
                    {hoveredStation.shortName} [{hoveredStation.code}]
                  </h4>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {hoveredStation.region}
                </span>
              </div>

              <p className="text-xs text-slate-300 font-medium mb-2.5">
                {hoveredStation.name}
              </p>

              <div className="space-y-1.5 text-[11px] font-mono border-t border-slate-700/60 pt-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tọa độ (WGS-84):</span>
                  <span className="text-sky-300">{hoveredStation.coordStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Loại đài dẫn đường:</span>
                  <span className="text-sky-300 font-semibold">{hoveredStation.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trạng thái thiết bị:</span>
                  <span className={`flex items-center gap-1 font-sans font-medium ${statusTextColor}`}>
                    {isAlert ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {statusText}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Giám sát SIRMS:</span>
                  <span className="text-sky-300 flex items-center gap-1 font-sans">
                    <Server className="w-3 h-3 text-sky-400" />
                    {isSirmsConnected ? 'Live SNMP Feed' : 'Hệ thống Trực tuyến'}
                  </span>
                </div>
                {live?.deviceCount ? (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thiết bị giám sát:</span>
                    <span className="text-emerald-300">
                      {live.deviceCount} thiết bị {live.alarmsCount > 0 ? `(${live.alarmsCount} cảnh báo)` : ''}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-sky-400/80">
                <span>Bấm đài trạm để chọn đăng nhập</span>
                <span className="font-mono">ATTECH SIRMS</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Bar: Selection Status & Status Legend */}
      <div className="relative z-10 px-4 py-2.5 bg-slate-950/60 border-t border-sky-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-slate-300 text-[11px]">
            Đài đang chọn:{' '}
            <strong className="text-emerald-300 font-bold">{activeStation}</strong>
          </span>
        </div>

        {/* Legend matching SIRMS Map in Image 3 */}
        <div className="flex items-center gap-3 text-[10px] text-slate-300 font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-slate-400">Bình thường</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="text-slate-400">Cảnh báo</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-400">Báo động</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
            <span className="text-slate-400">Dự phòng</span>
          </div>
        </div>
      </div>
    </div>
  );
}
