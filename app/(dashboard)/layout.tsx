'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckSquare,
  FileText,
  Award,
  GraduationCap,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  BarChart3,
  SlidersHorizontal,
  Layers,
  Scale,
  Wrench,
  ShieldCheck,
  Flame,
  Waves,
  HardHat,
  Building2,
  X,
  Share,
  PlusSquare,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import NavItem from '@/components/nav-item';
import { AssistantProvider, useAssistant } from '@/components/assistant-context';
import FloatingAssistant from '@/components/floating-assistant';
import { AuthProvider } from '@/components/auth-context';
import { ThemeProvider, useTheme } from '@/components/theme-context';

const MOBILE_DEPARTMENTS = [
  { id: 'ALL', label: 'Tất cả văn bản', shortLabel: 'Tất cả', dot: 'bg-slate-400', icon: Layers },
  { id: 'VB_PHAP_LUAT', label: 'Văn bản Pháp luật & Quy chế', shortLabel: 'VB Pháp luật', dot: 'bg-blue-500', icon: Scale },
  { id: 'QL_KY_THUAT', label: 'Quản lý Kỹ thuật (CNS)', shortLabel: 'QLKT / CNS', dot: 'bg-indigo-500', icon: Wrench },
  { id: 'SMS', label: 'An toàn (SMS)', shortLabel: 'SMS', dot: 'bg-emerald-500', icon: ShieldCheck },
  { id: 'PCCC_CHCN', label: 'PCCC & CHCN', shortLabel: 'PCCC & CHCN', dot: 'bg-rose-500', icon: Flame },
  { id: 'PCTT_TKCN', label: 'PCTT & TKCN', shortLabel: 'PCTT & TKCN', dot: 'bg-cyan-500', icon: Waves },
  { id: 'ATVSLD', label: 'An toàn VSLĐ', shortLabel: 'ATVSLĐ', dot: 'bg-amber-500', icon: HardHat },
  { id: 'CONG_TRINH_HK', label: 'Công trình Hàng không', shortLabel: 'CTHK', dot: 'bg-purple-500', icon: Building2 },
];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isDeepAero, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen: isAiOpen, setIsOpen: setIsAiOpen, selectedDocIds } = useAssistant();

  // Quản lý trạng thái thu nhỏ / mở rộng của Sidebar (PC)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Quản lý Bottom Sheet trên iPhone cho nút "Tuân thủ" và "Menu / Lọc"
  const [mobileSheet, setMobileSheet] = useState<'none' | 'compliance' | 'menu'>('none');

  // Khôi phục tùy chọn thu nhỏ từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('attech_sidebar_collapsed');
      if (saved === 'true') setIsCollapsed(true);
    } catch {
      // Ignore
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('attech_sidebar_collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Sidebar mở rộng khi không thu nhỏ, hoặc khi người dùng di chuột đến
  const isExpanded = !isCollapsed || isHovered;
  const isComplianceActive = pathname.startsWith('/licenses') || pathname.startsWith('/training');

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans selection:bg-sky-500/20 ${isDeepAero ? 'bg-[#071324] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <style>{`
        @keyframes driftCloudSidebar1 {
          0%, 100% { transform: translateX(-8px) translateY(0px); }
          50% { transform: translateX(12px) translateY(-4px); }
        }
        @keyframes driftCloudSidebar2 {
          0%, 100% { transform: translateX(10px) translateY(0px); }
          50% { transform: translateX(-10px) translateY(4px); }
        }
      `}</style>

      {/* Sidebar trên PC: Thu nhỏ ẩn về bên trái, tự mở ra khi di chuột đến, ẩn hoàn toàn trên màn hình iPhone */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        className={`${
          isExpanded ? 'w-64' : 'w-16'
        } hidden md:flex flex-shrink-0 flex-col transition-[width] duration-300 ease-in-out relative z-20 shadow-md overflow-hidden border-r ${
          isDeepAero
            ? 'deep-aero-bg border-sky-950/80 shadow-sky-950/50'
            : 'bg-gradient-to-b from-[#0284c7] via-[#38bdf8] to-[#bae6fd] border-sky-300/80'
        }`}
      >
        {/* Họa tiết Mây trắng bồng bềnh (Chỉ hiển thị khi ở chủ đề Sky Cloud) */}
        {!isDeepAero && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
            <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-white/25 blur-2xl" />
            <svg
              viewBox="0 0 200 80"
              className="absolute top-20 -right-10 w-52 text-white/30 fill-current"
              style={{ animation: 'driftCloudSidebar1 11s ease-in-out infinite' }}
            >
              <path d="M45 65 H165 A20 20 0 0 0 165 25 A22 22 0 0 0 125 12 A30 30 0 0 0 68 20 A24 24 0 0 0 45 65 Z" />
            </svg>
            <svg
              viewBox="0 0 200 80"
              className="absolute top-72 -left-12 w-56 text-white/35 fill-current"
              style={{ animation: 'driftCloudSidebar2 14s ease-in-out infinite' }}
            >
              <path d="M40 65 H160 A18 18 0 0 0 160 30 A24 24 0 0 0 120 15 A28 28 0 0 0 65 22 A22 22 0 0 0 40 65 Z" />
            </svg>
            <svg
              viewBox="0 0 240 90"
              className="absolute bottom-24 -right-8 w-64 text-white/45 fill-current"
              style={{ animation: 'driftCloudSidebar1 16s ease-in-out infinite' }}
            >
              <path d="M35 75 H205 A22 22 0 0 0 205 32 A26 26 0 0 0 158 16 A34 34 0 0 0 92 22 A26 26 0 0 0 35 75 Z" />
            </svg>
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/50 to-transparent" />
          </div>
        )}

        {/* Cụm Logo ATTECH */}
        <div className={`h-14 flex items-center ${isExpanded ? 'px-5' : 'justify-center px-0'} border-b relative z-10 transition-all ${isDeepAero ? 'border-white/10' : 'border-white/20'}`}>
          <div className="flex items-center gap-2.5 select-none">
            <img
              src="/attech-logo.png"
              alt="ATTECH Logo"
              className="w-8 h-8 rounded-full object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
            />
            {isExpanded && (
              <span className="font-extrabold text-xl tracking-wider select-none drop-shadow-[0_2px_4px_rgba(2,132,199,0.5)] truncate">
                <span className="text-[#ef2323]">A</span>
                <span className="text-white">TTECH</span>
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 no-scrollbar relative z-10">
          <Suspense fallback={null}>
            {/* Main Menu */}
            <div className="space-y-1.5">
              {isExpanded ? (
                <h3 className={`px-3 text-[11px] font-bold uppercase tracking-wider mb-2 drop-shadow-2xs transition-all ${isDeepAero ? 'text-sky-300/80' : 'text-white/90'}`}>
                  Danh mục quản lý
                </h3>
              ) : (
                <div className="h-2" />
              )}
              <NavItem href="/documents" icon={<FileText size={18} />} label="Tài liệu" isCollapsed={!isExpanded} />
              <NavItem href="/licenses" icon={<Award size={18} />} label="Giấy phép khai thác" isCollapsed={!isExpanded} />
              <NavItem href="/training" icon={<GraduationCap size={18} />} label="Hồ sơ huấn luyện" isCollapsed={!isExpanded} />
              <NavItem href="/tasks" icon={<CheckSquare size={18} />} label="Công việc" isCollapsed={!isExpanded} />
            </div>
          </Suspense>
        </nav>

        {/* Nút tắt/mở thu nhỏ Sidebar ở dưới cùng */}
        <div className={`p-2.5 border-t relative z-10 transition-all ${isDeepAero ? 'border-white/10' : 'border-white/30'}`}>
          <button
            type="button"
            onClick={toggleCollapse}
            className={`w-full flex items-center ${
              isExpanded ? 'justify-between px-3' : 'justify-center px-0'
            } py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs border ${
              isDeepAero
                ? 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white border-white/10'
                : 'bg-white/40 hover:bg-white/60 text-[#0f2043] border-white/60 backdrop-blur-[35px]'
            }`}
            title={isCollapsed ? 'Mở rộng cố định Sidebar' : 'Thu nhỏ Sidebar (tự mở khi rê chuột)'}
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-sky-500 shrink-0" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-sky-600 shrink-0" />
              )}
              {isExpanded && <span>{isCollapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'}</span>}
            </div>
            {isExpanded && (
              <span className="text-[10px] font-mono opacity-60">
                {isCollapsed ? 'MINI' : 'FULL'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content (chừa khoảng trống ở đáy trên iPhone cho Bottom Tab Bar) */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden pb-[68px] md:pb-0">
        {children}
      </main>

      {/* Thanh điều hướng đáy chuẩn iOS (Bottom Tab Bar - Chỉ hiển thị trên iPhone / Mobile < 768px) */}
      <nav
        aria-label="Thanh điều hướng di động"
        className={`fixed bottom-0 inset-x-0 z-30 md:hidden border-t pb-safe transition-colors ${
          isDeepAero
            ? 'bg-[#071324]/95 border-sky-900/60 text-slate-200 backdrop-blur-xl'
            : 'bg-white/95 border-slate-200 text-slate-700 backdrop-blur-xl shadow-[0_-4px_20px_rgba(15,23,42,0.06)]'
        }`}
      >
        <div className="grid grid-cols-4 h-[62px] items-center px-2 select-none">
          {/* 1. 📚 Tài liệu */}
          <Link
            href="/documents"
            onClick={() => {
              setMobileSheet('none');
              setIsAiOpen(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-colors ${
              pathname.startsWith('/documents') && mobileSheet === 'none' && !isAiOpen
                ? isDeepAero
                  ? 'text-sky-400 font-bold'
                  : 'text-sky-600 font-bold'
                : isDeepAero
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Tài liệu</span>
          </Link>

          {/* 2. 📨 Công việc */}
          <Link
            href="/tasks"
            onClick={() => {
              setMobileSheet('none');
              setIsAiOpen(false);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-colors ${
              pathname.startsWith('/tasks') && mobileSheet === 'none' && !isAiOpen
                ? isDeepAero
                  ? 'text-sky-400 font-bold'
                  : 'text-sky-600 font-bold'
                : isDeepAero
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Công việc</span>
          </Link>

          {/* 3. 📊 GP-CC */}
          <button
            type="button"
            onClick={() => {
              setIsAiOpen(false);
              setMobileSheet((prev) => (prev === 'compliance' ? 'none' : 'compliance'));
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-colors ${
              mobileSheet === 'compliance' || (isComplianceActive && mobileSheet === 'none' && !isAiOpen)
                ? isDeepAero
                  ? 'text-sky-400 font-bold'
                  : 'text-sky-600 font-bold'
                : isDeepAero
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] leading-tight">GP-CC</span>
          </button>

          {/* 4. ✨ Hỏi AI (Nút nổi bật nằm ngoài cùng bên phải - 1 chạm mở ngay Chatbot) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              data-assistant-trigger="true"
              onClick={() => {
                setMobileSheet('none');
                setIsAiOpen(!isAiOpen);
              }}
              className="relative -top-2.5 flex flex-col items-center justify-center"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  isAiOpen
                    ? 'bg-gradient-to-tr from-indigo-700 via-indigo-600 to-sky-500 text-white ring-4 ring-indigo-500/25'
                    : 'bg-gradient-to-tr from-indigo-600 via-sky-600 to-cyan-500 text-white shadow-sky-600/30'
                }`}
              >
                <Sparkles className="w-5 h-5" />
                {selectedDocIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center border border-white shadow-xs">
                    {selectedDocIds.length}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-bold mt-0.5 leading-tight ${
                  isAiOpen
                    ? isDeepAero
                      ? 'text-sky-300'
                      : 'text-indigo-600'
                    : isDeepAero
                      ? 'text-sky-400'
                      : 'text-sky-700'
                }`}
              >
                Hỏi AI
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom Sheet: 📊 GP-CC (Quản lý hồ sơ giấy phép và chứng chỉ) */}
      {mobileSheet === 'compliance' && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-slate-900/60 backdrop-blur-xs flex items-end animate-in fade-in duration-150"
          onClick={() => setMobileSheet('none')}
        >
          <div
            className="w-full bg-white text-slate-800 rounded-t-3xl p-5 pb-24 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-600" />
                  <span>Quản lý hồ sơ giấy phép và chứng chỉ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi hạn giấy phép khai thác thiết bị CNS và chứng chỉ nhân sự
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileSheet('none')}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <Link
                href="/licenses"
                onClick={() => setMobileSheet('none')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  pathname.startsWith('/licenses')
                    ? 'bg-sky-50 border-sky-300 text-sky-950'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Giấy phép Khai thác Đài trạm</div>
                    <div className="text-[11px] text-slate-500">
                      Theo dõi hạn giấy phép CAAV, tần số vô tuyến &amp; hiệu chuẩn
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>

              <Link
                href="/training"
                onClick={() => setMobileSheet('none')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  pathname.startsWith('/training')
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Hồ sơ Huấn luyện &amp; Năng định</div>
                    <div className="text-[11px] text-slate-500">
                      Quản lý chứng chỉ chuyên môn và hạn định kỳ của cán bộ kỹ thuật
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Trợ lý AI nổi (kéo thả tự do trên PC, toàn màn hình trên iPhone) */}
      <FloatingAssistant />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AssistantProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </AssistantProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
