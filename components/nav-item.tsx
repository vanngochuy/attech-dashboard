'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  // Với mục chuyên môn: mã chuyên môn (query ?dept=...) để xác định trạng thái đang chọn
  dept?: string;
}

export default function NavItem({ href, icon, label, dept }: NavItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentDept = searchParams.get('dept');

  const basePath = href.split('?')[0];
  const isActive = dept
    ? pathname === basePath && currentDept === dept
    : pathname.startsWith(basePath);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group relative text-sm ${
        isActive
          ? 'bg-indigo-100 text-indigo-800 font-bold shadow-xs ring-1 ring-indigo-200'
          : 'text-slate-600 font-medium hover:text-indigo-600 hover:bg-slate-100'
      }`}
    >
      <div className={`transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-400 group-hover:text-indigo-600'}`}>
        {icon}
      </div>
      <span>{label}</span>
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-indigo-600 rounded-r-full transition-all duration-300 ${
          isActive ? 'h-3/4' : 'h-0 group-hover:h-3/4'
        }`}
      />
    </Link>
  );
}
