import React, { Suspense } from 'react';
import { CheckSquare, FileText, Award, GraduationCap } from 'lucide-react';
import NavItem from '@/components/nav-item';
import { AssistantProvider } from '@/components/assistant-context';
import FloatingAssistant from '@/components/floating-assistant';
import { AuthProvider, SidebarUserStatus } from '@/components/auth-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AssistantProvider>
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-sky-500/20">
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

          {/* Sidebar: Nền Xanh Bầu Trời & Mây Trắng Hàng Không */}
          <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-[#0284c7] via-[#38bdf8] to-[#bae6fd] border-r border-sky-300/80 flex flex-col transition-all duration-300 relative z-20 shadow-md overflow-hidden">
            {/* Họa tiết Mây trắng bồng bềnh trên nền bầu trời Sidebar */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              {/* Ánh sáng mặt trời dịu góc trên */}
              <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-white/25 blur-2xl" />

              {/* Đám mây trắng 1 (Tầng trên) */}
              <svg
                viewBox="0 0 200 80"
                className="absolute top-20 -right-10 w-52 text-white/30 fill-current"
                style={{ animation: 'driftCloudSidebar1 11s ease-in-out infinite' }}
              >
                <path d="M45 65 H165 A20 20 0 0 0 165 25 A22 22 0 0 0 125 12 A30 30 0 0 0 68 20 A24 24 0 0 0 45 65 Z" />
              </svg>

              {/* Đám mây trắng 2 (Tầng giữa) */}
              <svg
                viewBox="0 0 200 80"
                className="absolute top-72 -left-12 w-56 text-white/35 fill-current"
                style={{ animation: 'driftCloudSidebar2 14s ease-in-out infinite' }}
              >
                <path d="M40 65 H160 A18 18 0 0 0 160 30 A24 24 0 0 0 120 15 A28 28 0 0 0 65 22 A22 22 0 0 0 40 65 Z" />
              </svg>

              {/* Đám mây trắng 3 (Tầng chân trời phía dưới) */}
              <svg
                viewBox="0 0 240 90"
                className="absolute bottom-24 -right-8 w-64 text-white/45 fill-current"
                style={{ animation: 'driftCloudSidebar1 16s ease-in-out infinite' }}
              >
                <path d="M35 75 H205 A22 22 0 0 0 205 32 A26 26 0 0 0 158 16 A34 34 0 0 0 92 22 A26 26 0 0 0 35 75 Z" />
              </svg>

              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/50 to-transparent" />
            </div>

            {/* Cụm Logo ATTECH (Bỏ hoàn toàn khung viền, chỉ giữ logo và chữ nổi bật trên nền mây) */}
            <div className="h-14 flex items-center px-5 border-b border-white/20 relative z-10">
              <div className="flex items-center gap-2.5 select-none">
                <img
                  src="/attech-logo.png"
                  alt="ATTECH Logo"
                  className="w-8 h-8 rounded-full object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
                />
                <span className="font-extrabold text-xl tracking-wider select-none drop-shadow-[0_2px_4px_rgba(2,132,199,0.5)]">
                  <span className="text-[#ef2323]">A</span>
                  <span className="text-white">TTECH</span>
                </span>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 no-scrollbar relative z-10">
              <Suspense fallback={null}>
                {/* Main Menu */}
                <div className="space-y-1.5">
                  <h3 className="px-3 text-[11px] font-bold text-white/90 uppercase tracking-wider mb-2 drop-shadow-2xs">
                    Danh mục quản lý
                  </h3>
                  <NavItem href="/documents" icon={<FileText size={18} />} label="Tài liệu" />
                  <NavItem href="/licenses" icon={<Award size={18} />} label="Giấy phép khai thác" />
                  <NavItem href="/training" icon={<GraduationCap size={18} />} label="Hồ sơ huấn luyện" />
                  <NavItem href="/tasks" icon={<CheckSquare size={18} />} label="Công việc" />
                </div>
              </Suspense>
            </nav>

            <div className="p-4 border-t border-white/30 relative z-10">
              <SidebarUserStatus />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-slate-50">
            {children}
          </main>

          {/* Trợ lý AI nổi (góc phải dưới) */}
          <FloatingAssistant />
        </div>
      </AssistantProvider>
    </AuthProvider>
  );
}
