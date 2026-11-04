import React, { Suspense } from 'react';
import { CheckSquare, FileText, Settings, ShieldAlert, Flame, CloudRain } from 'lucide-react';
import NavItem from '@/components/nav-item';
import { AssistantProvider } from '@/components/assistant-context';
import FloatingAssistant from '@/components/floating-assistant';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AssistantProvider>
      <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-indigo-500/20">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative z-20 shadow-sm">
          <div className="h-14 flex items-center px-6 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">A</div>
              <span className="font-bold text-lg tracking-tight text-slate-900">ATTECH AI</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 no-scrollbar">
            <Suspense fallback={null}>
              {/* Main Menu */}
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chính</h3>
                <NavItem href="/tasks" icon={<CheckSquare size={18} />} label="Công việc" />
                <NavItem href="/documents" icon={<FileText size={18} />} label="Tài liệu" />
              </div>

              {/* Departments */}
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Chuyên môn</h3>
                <NavItem href="/documents?dept=QL_KY_THUAT" dept="QL_KY_THUAT" icon={<Settings size={18} />} label="Kỹ thuật" />
                <NavItem href="/documents?dept=SMS" dept="SMS" icon={<ShieldAlert size={18} />} label="An toàn" />
                <NavItem href="/documents?dept=PCCC_CHCN" dept="PCCC_CHCN" icon={<Flame size={18} />} label="PCCC" />
                <NavItem href="/documents?dept=PCTT_TKCN" dept="PCTT_TKCN" icon={<CloudRain size={18} />} label="PCTT & TKCN" />
              </div>
            </Suspense>
          </nav>

          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold">U</div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-slate-800 truncate">Admin User</p>
                <p className="text-xs text-slate-500 truncate">admin@attech.com</p>
              </div>
            </div>
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
  );
}
