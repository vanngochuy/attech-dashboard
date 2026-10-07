import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, MessageSquare, CheckSquare, FileText, Settings, ShieldAlert, Flame, CloudRain } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-50 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 flex flex-col transition-all duration-300 relative z-20 shadow-2xl">
        <div className="h-16 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">A</div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">ATTECH AI</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 no-scrollbar">
          {/* Main Menu */}
          <div className="space-y-1">
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chính</h3>
            <NavItem href="/chat" icon={<MessageSquare size={18} />} label="Trợ lý RAG" />
            <NavItem href="/tasks" icon={<CheckSquare size={18} />} label="Công việc" />
            <NavItem href="/documents" icon={<FileText size={18} />} label="Tài liệu" />
          </div>

          {/* Departments */}
          <div className="space-y-1">
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Chuyên môn</h3>
            <NavItem href="#" icon={<Settings size={18} />} label="Kỹ thuật" />
            <NavItem href="#" icon={<ShieldAlert size={18} />} label="An toàn" />
            <NavItem href="#" icon={<Flame size={18} />} label="PCCC" />
            <NavItem href="#" icon={<CloudRain size={18} />} label="PCTT & TKCN" />
          </div>
        </nav>
        
        <div className="p-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-800/30 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">U</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-slate-400 truncate">admin@attech.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        {children}
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 hover:shadow-lg transition-all group relative"
    >
      <div className="text-slate-400 group-hover:text-indigo-400 transition-colors">
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-indigo-500 rounded-r-full group-hover:h-3/4 transition-all duration-300"></div>
    </Link>
  );
}
