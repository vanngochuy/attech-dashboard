'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from './theme-context';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  dept?: string;
}

export default function NavItem({ href, icon, label, dept }: NavItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentDept = searchParams.get('dept');
  const { isDeepAero } = useTheme();

  const basePath = href.split('?')[0];
  const isActive = dept
    ? pathname === basePath && currentDept === dept
    : pathname.startsWith(basePath);

  // Áp dụng linh hoạt theo 2 chủ đề
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group relative text-sm font-semibold ${
        isDeepAero
          ? isActive
            ? 'sidebar-nav-item-deep-aero active'
            : 'sidebar-nav-item-deep-aero'
          : isActive
            ? 'bg-white/95 text-[#0f2043] font-bold shadow-md backdrop-blur-[35px] border border-white'
            : 'bg-white/40 hover:bg-white/55 text-[#0f2043] font-semibold backdrop-blur-[35px] border border-white/60 shadow-xs'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
          isDeepAero
            ? isActive
              ? 'bg-sky-500 text-white shadow-2xs shadow-sky-400/30'
              : 'bg-white/10 backdrop-blur-md border border-white/15 text-sky-200 shadow-2xs group-hover:bg-white/20'
            : isActive
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'bg-white/50 backdrop-blur-[35px] border border-white/70 text-[#0f2043] shadow-2xs group-hover:bg-white/70'
        }`}
      >
        {icon}
      </div>
      <span className={isDeepAero ? (isActive ? 'text-white font-semibold' : 'text-slate-200 group-hover:text-white') : 'text-[#0f2043] font-semibold'}>
        {label}
      </span>
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 bg-[#ef2323] rounded-r-full transition-all duration-300 ${
          isActive ? 'h-3/5' : 'h-0 group-hover:h-1/2 bg-[#0284c7]'
        }`}
      />
    </Link>
  );
}
