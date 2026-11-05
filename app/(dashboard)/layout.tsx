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
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-indigo-500/20">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative z-20 shadow-sm">
            <div className="h-14 flex items-center px-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <img
                  src="/attech-logo.png"
                  alt="ATTECH Logo"
                  className="w-9 h-9 rounded-full object-contain shadow-xs shrink-0"
                />
                <span className="font-extrabold text-xl tracking-wider select-none">
                  <span className="text-[#ef2323]">A</span>
                  <span className="text-[#0284c7]">TTECH</span>
                </span>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 no-scrollbar">
              <Suspense fallback={null}>
                {/* Main Menu */}
                <div className="space-y-1">
                  <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Danh mục quản lý
                  </h3>
                  <NavItem href="/documents" icon={<FileText size={18} />} label="Tài liệu" />
                  <NavItem href="/licenses" icon={<Award size={18} />} label="Giấy phép khai thác" />
                  <NavItem href="/training" icon={<GraduationCap size={18} />} label="Hồ sơ huấn luyện" />
                  <NavItem href="/tasks" icon={<CheckSquare size={18} />} label="Công việc" />
                </div>
              </Suspense>
            </nav>

            <div className="p-4 border-t border-slate-200">
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
