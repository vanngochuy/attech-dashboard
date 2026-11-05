'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Lock,
  LogOut,
  ShieldCheck,
  User,
  AlertCircle,
  PlaneTakeoff,
  PlaneLanding,
  Radio,
  Radar,
  Shield,
  Compass,
  MapPin,
  Phone,
  Globe,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export type UserRole = 'admin' | 'user' | null;
type FlightPhase = 'idle' | 'takeoff' | 'landing';

interface AuthContextValue {
  role: UserRole;
  isAdmin: boolean;
  isAuthenticated: boolean;
  username: string | null;
  loginAdmin: (user: string, pass: string) => boolean;
  loginAsUser: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'attech_auth_session_v2';
const ANIMATION_DURATION_MS = 2000; // 2 giây theo yêu cầu

/**
 * Vector máy bay hàng không chuyên dụng (kiểu tàu bay hiệu chuẩn / phản lực ATTECH)
 */
function AircraftSvg({ className = 'w-28 h-28' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fuselageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="afterburner" x1="100%" y1="50%" x2="0%" y2="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Luồng phản lực động cơ */}
      <ellipse cx="18" cy="60" rx="16" ry="4" fill="url(#afterburner)" />
      {/* Cánh chính */}
      <path
        d="M52 60 L34 18 L46 18 L72 56 Z"
        fill="url(#wingGrad)"
      />
      <path
        d="M52 60 L34 102 L46 102 L72 64 Z"
        fill="url(#wingGrad)"
      />
      {/* Cánh đuôi */}
      <path
        d="M28 60 L16 38 L24 38 L36 57 Z"
        fill="#0369a1"
      />
      <path
        d="M28 60 L16 82 L24 82 L36 63 Z"
        fill="#0369a1"
      />
      {/* Thân tàu bay */}
      <path
        d="M20 56 C45 54, 82 54, 105 60 C82 66, 45 66, 20 64 L15 60 Z"
        fill="url(#fuselageGrad)"
        stroke="#0284c7"
        strokeWidth="1.5"
      />
      {/* Buồng lái (Cockpit) */}
      <path
        d="M86 57.5 C92 58, 97 59, 100 60 C97 61, 92 62, 86 62.5 C88 60.5, 88 59.5, 86 57.5 Z"
        fill="#0f172a"
      />
      {/* Dải sơn nhận diện ATTECH trên thân */}
      <path d="M30 60 L82 60" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
      {/* Đèn dẫn đường đầu cánh */}
      <circle cx="40" cy="19" r="2" fill="#ef4444" />
      <circle cx="40" cy="101" r="2" fill="#22c55e" />
    </svg>
  );
}

/**
 * Màn hình hiệu ứng Máy bay CẤT CÁNH (Takeoff - 2 giây) khi đăng nhập thành công
 */
function TakeoffOverlay({ targetRole, username }: { targetRole: UserRole; username: string | null }) {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-sky-950 via-sky-800 to-slate-900 flex flex-col justify-between select-none font-sans">
      <style>{`
        @keyframes attechTakeoffFlight {
          0% {
            transform: translate(-38vw, 28vh) rotate(0deg) scale(0.85);
          }
          32% {
            transform: translate(-8vw, 26vh) rotate(-6deg) scale(0.95);
          }
          55% {
            transform: translate(8vw, 10vh) rotate(-24deg) scale(1.08);
          }
          100% {
            transform: translate(55vw, -38vh) rotate(-26deg) scale(1.25);
          }
        }
        @keyframes attechContrail {
          0% {
            width: 0px;
            opacity: 0;
          }
          30% {
            width: 80px;
            opacity: 0.5;
          }
          100% {
            width: 420px;
            opacity: 0.9;
          }
        }
        @keyframes attechCloudRush {
          0% {
            transform: translateX(30vw) translateY(-10vh);
            opacity: 0;
          }
          30% {
            opacity: 0.35;
          }
          100% {
            transform: translateX(-60vw) translateY(25vh);
            opacity: 0;
          }
        }
        @keyframes attechRunwayPass {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: -900px 0px;
          }
        }
      `}</style>

      {/* Lớp mây lướt nhanh tạo cảm giác vút lên bầu trời */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[18%] right-[10%] w-72 h-20 rounded-full bg-white/20 blur-xl"
          style={{ animation: 'attechCloudRush 2s ease-in forwards' }}
        />
        <div
          className="absolute top-[42%] right-[25%] w-96 h-24 rounded-full bg-sky-200/20 blur-2xl"
          style={{ animation: 'attechCloudRush 1.8s ease-in 0.15s forwards' }}
        />
        <div
          className="absolute top-[28%] right-[45%] w-64 h-16 rounded-full bg-white/15 blur-xl"
          style={{ animation: 'attechCloudRush 1.6s ease-in 0.25s forwards' }}
        />
      </div>

      {/* Header HUD Hàng không */}
      <div className="relative z-10 p-6 flex items-center justify-between text-sky-100">
        <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-xl border border-sky-400/30">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs tracking-wider uppercase text-emerald-300 font-bold">
            ATC CLEARANCE: CLEARED FOR TAKEOFF · RUNWAY 11R
          </span>
        </div>
        <div className="font-mono text-xs text-sky-200 bg-slate-900/50 px-3.5 py-2 rounded-xl border border-sky-400/20">
          ATTECH CNS/ATM FLIGHT DECK
        </div>
      </div>

      {/* Trung tâm bầu trời: Máy bay tăng tốc và cất cánh vút lên */}
      <div className="relative flex-1 flex items-center justify-center">
        <div
          className="relative flex items-center"
          style={{ animation: 'attechTakeoffFlight 2s cubic-bezier(0.22, 0.8, 0.36, 1) forwards' }}
        >
          {/* Vệt khói trắng (Contrail) phía đuôi tàu bay */}
          <div
            className="h-2 rounded-full bg-gradient-to-l from-white/90 via-sky-200/50 to-transparent blur-[2px] -mr-6"
            style={{ animation: 'attechContrail 2s ease-out forwards' }}
          />
          <div className="drop-shadow-[0_15px_35px_rgba(56,189,248,0.65)]">
            <AircraftSvg className="w-32 h-32" />
          </div>
        </div>
      </div>

      {/* Đường băng ánh sáng bên dưới (Runway Lights) */}
      <div className="relative z-10">
        <div className="h-24 bg-slate-950/90 border-t-2 border-amber-400/60 relative overflow-hidden flex flex-col justify-center">
          {/* Vạch kẻ tim đường băng chạy lùi cực nhanh */}
          <div
            className="w-full h-2 opacity-80"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #f8fafc 0px, #f8fafc 48px, transparent 48px, transparent 96px)',
              animation: 'attechRunwayPass 0.9s linear infinite',
            }}
          />
          {/* Đèn lề đường băng */}
          <div className="absolute bottom-2 inset-x-0 flex justify-around px-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]"
              />
            ))}
          </div>
        </div>

        {/* Thanh thông báo trạng thái cất cánh */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-t border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300">
              <PlaneTakeoff className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">
                {targetRole === 'admin'
                  ? `Chào mừng Quản trị viên (${username || 'huyvn'}) — Đang cất cánh vào Hệ thống Quản trị...`
                  : 'Chào mừng Nhân viên ATTECH — Đang cất cánh vào Cổng Tra cứu & Trợ lý AI...'}
              </div>
              <div className="text-xs text-sky-300/80 font-mono">
                SPEED: V1 ➔ VR ➔ V2 (CLIMBING) · ĐỒNG BỘ DỮ LIỆU SUPABASE & GOOGLE DRIVE
              </div>
            </div>
          </div>
          <div className="text-xs font-mono text-emerald-400 font-semibold">100% READY</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Màn hình hiệu ứng Máy bay HẠ CÁNH (Landing - 2 giây) khi đăng xuất / thoát ra
 */
function LandingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-slate-950 via-sky-950 to-slate-900 flex flex-col justify-between select-none font-sans">
      <style>{`
        @keyframes attechLandingFlight {
          0% {
            transform: translate(-48vw, -32vh) rotate(14deg) scale(0.85);
          }
          55% {
            transform: translate(-5vw, 24vh) rotate(5deg) scale(1.05);
          }
          72% {
            transform: translate(10vw, 27vh) rotate(-4deg) scale(1.05);
          }
          100% {
            transform: translate(28vw, 27vh) rotate(0deg) scale(1.05);
          }
        }
        @keyframes attechTouchdownSmoke {
          0%, 52% {
            opacity: 0;
            transform: scale(0.3);
          }
          65% {
            opacity: 0.85;
            transform: scale(1.2) translateX(-20px);
          }
          100% {
            opacity: 0;
            transform: scale(2.2) translateX(-70px);
          }
        }
        @keyframes attechRunwaySlow {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: -450px 0px;
          }
        }
      `}</style>

      {/* Header HUD Hạ cánh */}
      <div className="relative z-10 p-6 flex items-center justify-between text-sky-100">
        <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-xl border border-amber-400/30">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="font-mono text-xs tracking-wider uppercase text-amber-300 font-bold">
            ILS APPROACH: GLIDE SLOPE ESTABLISHED · LANDING RUNWAY 11R
          </span>
        </div>
        <div className="font-mono text-xs text-sky-200 bg-slate-900/60 px-3.5 py-2 rounded-xl border border-sky-400/20">
          ATTECH CNS/ATM FLIGHT DECK
        </div>
      </div>

      {/* Không gian máy bay hạ độ cao và đáp xuống đường băng */}
      <div className="relative flex-1 flex items-center justify-center">
        <div
          className="relative flex items-center"
          style={{ animation: 'attechLandingFlight 2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          {/* Khói trắng ở bánh đáp khi chạm đường băng (Touchdown) */}
          <div
            className="absolute -bottom-3 left-8 w-20 h-8 rounded-full bg-white/80 blur-md"
            style={{ animation: 'attechTouchdownSmoke 2s ease-out forwards' }}
          />
          <div className="drop-shadow-[0_12px_28px_rgba(14,165,233,0.5)]">
            <AircraftSvg className="w-32 h-32" />
          </div>
        </div>
      </div>

      {/* Đường băng hạ cánh */}
      <div className="relative z-10">
        <div className="h-24 bg-slate-950 border-t-2 border-emerald-400/60 relative overflow-hidden flex flex-col justify-center">
          <div
            className="w-full h-2 opacity-75"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #f8fafc 0px, #f8fafc 48px, transparent 48px, transparent 96px)',
              animation: 'attechRunwaySlow 1.6s ease-out forwards',
            }}
          />
          <div className="absolute bottom-2 inset-x-0 flex justify-around px-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"
              />
            ))}
          </div>
        </div>

        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-t border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300">
              <PlaneLanding className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">
                Đang hạ cánh an toàn & Đóng phiên làm việc...
              </div>
              <div className="text-xs text-slate-400 font-mono">
                TOUCHDOWN CONFIRMED · Hẹn gặp lại trên Hệ thống Tài liệu ATTECH
              </div>
            </div>
          </div>
          <div className="text-xs font-mono text-amber-400 font-semibold">SAFE LANDING</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Màn hình Cổng Đăng nhập toàn trang lấy cảm hứng từ https://attech.com.vn/
 */
function AttechLoginGate({
  onAdminLogin,
  onUserQuickAccess,
}: {
  onAdminLogin: (u: string, p: string) => boolean;
  onUserQuickAccess: () => void;
}) {
  const [inputUser, setInputUser] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUser.trim()) {
      setError('Vui lòng nhập tài khoản Quản trị viên.');
      return;
    }
    const ok = onAdminLogin(inputUser, inputPass);
    if (!ok) {
      setError('Tài khoản hoặc mật khẩu Admin không chính xác.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-slate-950 text-white overflow-y-auto lg:overflow-hidden font-sans">
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes floatCloudSlow {
          0%, 100% { transform: translateX(0px) translateY(0px); }
          50% { transform: translateX(28px) translateY(-8px); }
        }
        @keyframes pulseBeacon {
          0%, 100% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>

      {/* Nền Bầu trời Hàng không + Đài Radar CNS/ATM Động */}
      <div className="relative flex-1 flex flex-col justify-between p-8 lg:p-12 bg-gradient-to-br from-slate-950 via-sky-950 to-indigo-950 overflow-hidden">
        {/* Vòng quét Radar CNS/DVOR-DME động phía sau */}
        <div className="absolute -right-24 -bottom-24 w-[540px] h-[540px] rounded-full border border-sky-400/15 pointer-events-none flex items-center justify-center">
          <div className="w-[400px] h-[400px] rounded-full border border-sky-400/15 flex items-center justify-center">
            <div className="w-[260px] h-[260px] rounded-full border border-sky-400/20 flex items-center justify-center">
              <div className="w-[120px] h-[120px] rounded-full border border-sky-400/25" />
            </div>
          </div>
          {/* Tia quét Radar */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(56, 189, 248, 0.28) 0deg, rgba(56, 189, 248, 0.02) 70deg, transparent 90deg)',
              animation: 'radarSweep 8s linear infinite',
            }}
          />
          {/* Chấm mục tiêu tàu bay trên màn hình Radar */}
          <div
            className="absolute top-28 left-36 flex items-center gap-1.5"
            style={{ animation: 'pulseBeacon 2.8s ease-in-out infinite' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
            <span className="font-mono text-[10px] text-emerald-300 bg-slate-900/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
              CALIB-350 · FL280
            </span>
          </div>
          <div
            className="absolute bottom-40 left-24 flex items-center gap-1.5"
            style={{ animation: 'pulseBeacon 3.4s ease-in-out 1s infinite' }}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
            <span className="font-mono text-[10px] text-sky-300 bg-slate-900/70 px-1.5 py-0.5 rounded border border-sky-500/30">
              VN-ATTECH · CNS/ATM
            </span>
          </div>
        </div>

        {/* Đám mây động nhẹ */}
        <div
          className="absolute top-20 right-16 w-72 h-20 rounded-full bg-sky-400/10 blur-2xl pointer-events-none"
          style={{ animation: 'floatCloudSlow 9s ease-in-out infinite' }}
        />

        {/* Header thương hiệu ATTECH & VATM */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-semibold mb-5">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>TỔNG CÔNG TY QUẢN LÝ BAY VIỆT NAM (VATM)</span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <img
              src="/attech-logo.png"
              alt="ATTECH Logo"
              className="w-16 h-16 rounded-full object-contain shadow-lg border-2 border-white/25 bg-white/10 shrink-0"
            />
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-wider">
                <span className="text-[#ff2a2a]">A</span>
                <span className="text-[#38bdf8]">TTECH</span>
              </h1>
              <p className="text-sm font-semibold text-sky-100 mt-0.5">
                CÔNG TY TNHH KỸ THUẬT QUẢN LÝ BAY
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
            Hệ thống Quản lý Văn bản Pháp quy, Tài liệu Kỹ thuật CNS/ATM, An toàn — PCCC — PCTT &amp; Trợ lý Tri thức AI nội bộ.
          </p>
        </div>

        {/* 3 Trụ cột hoạt động đặc trưng của ATTECH (theo attech.com.vn) */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-8 max-w-2xl">
          <div className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 mb-3">
              <Radar className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
              Kỹ thuật CNS / ATM
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Hệ thống Thông tin, Dẫn đường (DVOR/DME, ILS) và Giám sát hàng không (Radar, ADS-B).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
              Bay Kiểm tra Hiệu chuẩn
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Đảm bảo độ chính xác và an toàn tuyệt đối cho các đài trạm dẫn đường trên toàn quốc.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 transition-all">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
              An toàn &amp; Tri thức AI
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Tra cứu văn bản hiệu lực tức thì và hỏi đáp chuyên sâu với Trợ lý AI NotebookLM.
            </p>
          </div>
        </div>

        {/* Footer thông tin liên hệ chính thức từ attech.com.vn */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            Số 159 đường Lâm Hạ, phường Bồ Đề, TP. Hà Nội
          </span>
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-sky-400" />
            024.38271914
          </span>
          <a
            href="https://attech.com.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sky-300 hover:text-sky-200 underline"
          >
            <Globe className="w-3.5 h-3.5" />
            attech.com.vn
          </a>
        </div>
      </div>

      {/* Cột phải: Bảng Điều khiển Đăng nhập (Light Theme Sáng & Sang trọng) */}
      <div className="w-full lg:w-[460px] bg-white text-slate-900 flex flex-col justify-center p-8 lg:p-10 shadow-2xl relative z-20">
        <div className="max-w-sm mx-auto w-full space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-semibold mb-2">
              <Sparkles className="w-3 h-3 text-sky-600" />
              <span>Cổng Truy Cập Hệ Thống</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>Chào mừng đến với</span>
              <span className="tracking-wider">
                <span className="text-[#ef2323]">A</span>
                <span className="text-[#0284c7]">TTECH</span>
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Chọn chế độ truy cập nhanh dành cho Nhân viên tra cứu hoặc đăng nhập tài khoản Quản trị viên.
            </p>
          </div>

          {/* CÁCH 1: Nút vào nhanh cổng Tra cứu dành cho Nhân viên (1 chạm -> Cất cánh) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50/70 border border-sky-200/90 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Cổng Tra cứu Nhân viên (User)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Xem tài liệu, lọc chuyên môn &amp; hỏi Chatbot AI
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onUserQuickAccess}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-sky-600/25 transition-all cursor-pointer group"
            >
              <PlaneTakeoff className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span>Vào cổng Tra cứu dành cho Nhân viên</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </button>
          </div>

          {/* Đường phân cách */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Hoặc Đăng nhập Quản trị (Admin)
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* Form Đăng nhập Admin (huyvn / 1234) */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tài khoản Quản trị viên
              </label>
              <input
                type="text"
                value={inputUser}
                onChange={(e) => {
                  setInputUser(e.target.value);
                  setError(null);
                }}
                placeholder="Nhập tài khoản Admin..."
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                value={inputPass}
                onChange={(e) => {
                  setInputPass(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                className="w-full bg-slate-50 focus:bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all cursor-pointer group"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Đăng nhập Quản trị viên (Cất cánh)</span>
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-slate-400">
            © {new Date().getFullYear()} ATTECH · Hệ thống Quản lý Tài liệu &amp; Tri thức số
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [flightPhase, setFlightPhase] = useState<FlightPhase>('idle');
  const [pendingRole, setPendingRole] = useState<UserRole>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.role === 'admin' && parsed?.username === 'huyvn') {
          setRole('admin');
          setUsername('huyvn');
        } else if (parsed?.role === 'user') {
          setRole('user');
          setUsername('Nhân viên ATTECH');
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const triggerTakeoff = (targetRole: 'admin' | 'user', targetName: string) => {
    setPendingRole(targetRole);
    setUsername(targetName);
    setFlightPhase('takeoff');

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          role: targetRole,
          username: targetName,
          loginAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore storage errors
    }

    setTimeout(() => {
      setRole(targetRole);
      setFlightPhase('idle');
    }, ANIMATION_DURATION_MS);
  };

  const loginAdmin = (user: string, pass: string): boolean => {
    const cleanUser = user.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (cleanUser === 'huyvn' && cleanPass === '1234') {
      triggerTakeoff('admin', 'huyvn');
      return true;
    }
    return false;
  };

  const loginAsUser = () => {
    triggerTakeoff('user', 'Nhân viên ATTECH');
  };

  const logout = () => {
    setFlightPhase('landing');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    setTimeout(() => {
      setRole(null);
      setPendingRole(null);
      setUsername(null);
      setFlightPhase('idle');
    }, ANIMATION_DURATION_MS);
  };

  // Tránh nháy giao diện trước khi đọc localStorage
  if (!isHydrated) {
    return <div className="fixed inset-0 bg-slate-950" />;
  }

  return (
    <AuthContext.Provider
      value={{
        role,
        isAdmin: role === 'admin',
        isAuthenticated: role !== null,
        username,
        loginAdmin,
        loginAsUser,
        logout,
      }}
    >
      {/* Hiệu ứng Máy bay Cất cánh (2 giây) */}
      {flightPhase === 'takeoff' && (
        <TakeoffOverlay targetRole={pendingRole} username={username} />
      )}

      {/* Hiệu ứng Máy bay Hạ cánh (2 giây) */}
      {flightPhase === 'landing' && <LandingOverlay />}

      {/* Nếu chưa đăng nhập -> Hiển thị Cổng Đăng nhập ATTECH */}
      {role === null ? (
        <AttechLoginGate onAdminLogin={loginAdmin} onUserQuickAccess={loginAsUser} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

import { useTheme } from './theme-context';

export function SidebarUserStatus() {
  const { isAdmin, username, logout } = useAuth();
  const { isDeepAero } = useTheme();

  if (isAdmin) {
    return (
      <div
        className={`p-3 rounded-xl space-y-2.5 transition-all ${
          isDeepAero
            ? 'user-profile-card-deep-aero'
            : 'bg-white/40 backdrop-blur-[35px] border border-white/60 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs border border-white/50">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-xs font-bold truncate ${isDeepAero ? 'text-white' : 'text-[#0f2043]'}`}>
                {username || 'huyvn'}
              </p>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-600 text-white shadow-xs">
                Admin
              </span>
            </div>
            <p className={`text-[11px] font-medium truncate ${isDeepAero ? 'text-sky-200/70' : 'text-[#0f2043]/80'}`}>
              Toàn quyền quản trị
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isDeepAero
              ? 'logout-btn'
              : 'bg-white/50 hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-white/60 hover:border-rose-300 backdrop-blur-[35px] shadow-2xs'
          }`}
          title="Đăng xuất & Hạ cánh về màn hình chính"
        >
          <PlaneLanding className="w-3.5 h-3.5 text-rose-400" />
          <span>Đăng xuất</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl space-y-2.5 transition-all ${
        isDeepAero
          ? 'user-profile-card-deep-aero'
          : 'bg-white/40 backdrop-blur-[35px] border border-white/60 shadow-xs'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sky-600/30 text-white flex items-center justify-center text-xs font-semibold shrink-0 border border-white/40">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDeepAero ? 'text-white' : 'text-[#0f2043]'}`}>
            Nhân viên tra cứu
          </p>
          <p className={`text-[11px] font-medium truncate ${isDeepAero ? 'text-sky-200/70' : 'text-[#0f2043]/80'}`}>
            Quyền: Xem &amp; Hỏi Chatbot
          </p>
        </div>
      </div>
      <button
        onClick={logout}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          isDeepAero
            ? 'logout-btn'
            : 'bg-white/50 hover:bg-amber-50 text-amber-800 hover:text-amber-900 border border-white/60 hover:border-amber-300 backdrop-blur-[35px] shadow-2xs'
        }`}
        title="Thoát phiên tra cứu hoặc chuyển sang tài khoản Admin"
      >
        <LogOut className="w-3.5 h-3.5 text-amber-400" />
        <span>Thoát / Đổi tài khoản</span>
      </button>
    </div>
  );
}
