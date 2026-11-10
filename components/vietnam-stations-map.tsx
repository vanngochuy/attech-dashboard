'use client';

import React, { useState } from 'react';
import {
  VIETNAM_MAP_PATHS,
  NATIONWIDE_STATIONS,
  type StationMapPoint,
} from '@/lib/vietnam-map-data';
import { Radio, MapPin, CheckCircle2, Compass, ShieldAlert, Sparkles } from 'lucide-react';

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

  // Status color helpers
  const getDotColor = (station: StationMapPoint) => {
    if (station.code === 'TUH') return 'bg-amber-400 text-amber-300 ring-amber-400';
    if (station.status === 'alert') return 'bg-rose-500 text-rose-300 ring-rose-400';
    if (station.status === 'warning') return 'bg-amber-500 text-amber-300 ring-amber-400';
    return 'bg-emerald-400 text-emerald-300 ring-emerald-400';
  };

  const isSelected = (station: StationMapPoint) => {
    return activeStation === station.name || activeStation.includes(station.shortName);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col select-none ${className}`}
      style={{ minHeight: '520px' }}
    >
      {/* Tactical radar & grid background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950/70 via-sky-950/30 to-slate-950/80 border border-sky-500/20 shadow-2xl backdrop-blur-xs">
        {/* Radar concentric range rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-sky-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full border border-sky-500/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-sky-500/15" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full border border-sky-400/20" />

        {/* Radar crosshairs & angular bearings */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-sky-500/15 to-transparent" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-sky-500/15 to-transparent" />

        {/* Sweeping radar beam */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(56, 189, 248, 0.18) 0deg, rgba(56, 189, 248, 0.02) 65deg, transparent 80deg)',
            animation: 'radarSweep 10s linear infinite',
          }}
        />

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

      {/* Top Header bar with status badge */}
      <div className="relative z-10 px-4 pt-3 pb-1 flex items-center justify-between text-xs border-b border-sky-500/20 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-sky-300 uppercase">
            HỆ THỐNG ĐÀI TRẠM CNS/ATM TOÀN QUỐC
          </span>
          <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono">
            (CV 1726/KTQLB-KTATCL)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] font-medium">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>TUH: Tuy Hòa (Active)</span>
          </div>
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

            {/* Tuy Hoa radar beacon pulse filter */}
            <radialGradient id="tuyHoaBeacon" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
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
            <line x1="194" y1="98" x2="283" y2="318" /> {/* NOB - DAN */}
            <line x1="283" y1="318" x2="325" y2="447" /> {/* DAN - TUH */}
            <line x1="325" y1="447" x2="225" y2="541" /> {/* TUH - TSN */}
            <line x1="225" y1="541" x2="126" y2="569" /> {/* TSN - PQU */}
            <line x1="325" y1="447" x2="515" y2="515" /> {/* TUH - STT */}
            <line x1="225" y1="541" x2="424" y2="634" /> {/* TSN - TSL */}
          </g>

          {/* TUY HOA (TUH) SPECIAL PULSING BEACON */}
          <g>
            <circle
              cx="325.3"
              cy="447.0"
              r="26"
              fill="url(#tuyHoaBeacon)"
              className="animate-ping pointer-events-none"
              style={{ animationDuration: '3s' }}
            />
            <circle
              cx="325.3"
              cy="447.0"
              r="14"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              className="pointer-events-none"
              style={{ animation: 'spin 12s linear infinite' }}
            />
          </g>

          {/* Plot all Nationwide Stations */}
          {NATIONWIDE_STATIONS.map((st) => {
            const selected = isSelected(st);
            const isHovered = hoveredStation?.code === st.code;
            const isTuyHoa = st.code === 'TUH';

            return (
              <g
                key={st.code}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredStation(st)}
                onMouseLeave={() => setHoveredStation(null)}
                onClick={() => onSelectStation && onSelectStation(st.name)}
              >
                {/* Outer halo when active/hovered */}
                {(selected || isHovered || isTuyHoa) && (
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={isTuyHoa ? 10 : 8}
                    fill="none"
                    stroke={isTuyHoa ? '#fbbf24' : selected ? '#38bdf8' : '#34d399'}
                    strokeWidth="1.8"
                    className="animate-pulse"
                  />
                )}

                {/* Central beacon dot */}
                <circle
                  cx={st.x}
                  cy={st.y}
                  r={isTuyHoa ? 4.5 : 3.5}
                  fill={
                    isTuyHoa
                      ? '#fbbf24'
                      : st.status === 'alert'
                      ? '#ef4444'
                      : st.status === 'warning'
                      ? '#f59e0b'
                      : '#10b981'
                  }
                  stroke="#ffffff"
                  strokeWidth={isTuyHoa ? 1.5 : 1}
                  className="filter drop-shadow-[0_0_6px_currentColor]"
                />

                {/* Badge Container (3-letter Station Code) */}
                <g
                  transform={`translate(${st.x + 6}, ${st.y - 7})`}
                  className="transition-transform duration-150"
                  style={{
                    transform: isHovered || selected ? `translate(${st.x + 7}px, ${st.y - 8}px) scale(1.1)` : undefined,
                  }}
                >
                  <rect
                    x="0"
                    y="0"
                    width={isTuyHoa ? 34 : 28}
                    height="14"
                    rx="3"
                    fill={
                      isTuyHoa
                        ? '#78350f'
                        : selected
                        ? '#0369a1'
                        : '#090d16'
                    }
                    fillOpacity={selected || isTuyHoa ? 0.95 : 0.85}
                    stroke={
                      isTuyHoa
                        ? '#fbbf24'
                        : selected
                        ? '#38bdf8'
                        : st.status === 'alert'
                        ? '#ef4444'
                        : st.status === 'warning'
                        ? '#f59e0b'
                        : '#334155'
                    }
                    strokeWidth={selected || isTuyHoa ? '1.5' : '0.8'}
                  />
                  <text
                    x={isTuyHoa ? 17 : 14}
                    y="10.5"
                    textAnchor="middle"
                    className={`font-mono text-[9px] font-bold ${
                      isTuyHoa
                        ? 'fill-amber-300'
                        : selected
                        ? 'fill-sky-100'
                        : 'fill-slate-200'
                    }`}
                  >
                    {st.code}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Hover / Tooltip HUD Card (Flight Ops Display) */}
        {hoveredStation && (
          <div
            className="absolute top-4 right-4 z-20 w-72 p-3.5 rounded-xl bg-slate-900/95 border border-sky-400/40 shadow-2xl backdrop-blur-md text-white pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getDotColor(
                    hoveredStation
                  )} shadow-[0_0_8px_currentColor]`}
                />
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
                <span className="text-slate-400">Trang thiết bị:</span>
                <span className="text-emerald-300 font-semibold">{hoveredStation.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vận hành:</span>
                <span className="text-emerald-400 flex items-center gap-1 font-sans">
                  <CheckCircle2 className="w-3 h-3" /> Sẵn sàng 24/7
                </span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-sky-400/80">
              <span>Bấm đài trạm để chọn đăng nhập</span>
              <span className="font-mono">CV 1726/KTQLB</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Selection Status & Quick Actions */}
      <div className="relative z-10 px-4 py-2.5 bg-slate-950/60 border-t border-sky-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-slate-300 text-[11px]">
            Đài đang chọn:{' '}
            <strong className="text-amber-300 font-bold">{activeStation}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Hoạt động
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Tuy Hòa (Highlight)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Nội Bài
          </span>
        </div>
      </div>
    </div>
  );
}
