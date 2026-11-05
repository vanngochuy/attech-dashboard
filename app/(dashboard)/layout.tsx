'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { CheckSquare, FileText, Award, GraduationCap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import NavItem from '@/components/nav-item';
import { AssistantProvider } from '@/components/assistant-context';
import FloatingAssistant from '@/components/floating-assistant';
import { AuthProvider } from '@/components/auth-context';
import { ThemeProvider, useTheme } from '@/components/theme-context';

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isDeepAero } = useTheme();

  // Quản lý trạng thái thu nhỏ / mở rộng của Sidebar
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

      {/* Sidebar: Thu nhỏ ẩn về bên trái, tự mở ra khi di chuột đến, có nút bật/tắt ở dưới cùng */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        className={`${
          isExpanded ? 'w-64' : 'w-16'
        } flex-shrink-0 flex flex-col transition-[width] duration-300 ease-in-out relative z-20 shadow-md overflow-hidden border-r ${
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

      {/* Main content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {children}
      </main>

      {/* Trợ lý AI nổi (kéo thả tự do) */}
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
