'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

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

  const basePath = href.split('?')[0];
  const isActive = dept
    ? pathname === basePath && currentDept === dept
    : pathname.startsWith(basePath);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all group relative text-sm ${
        isActive
          ? 'bg-white/90 text-sky-950 font-bold shadow-md backdrop-blur-md border border-white'
          : 'text-white font-medium hover:bg-white/20 hover:text-white backdrop-blur-sm border border-transparent hover:border-white/20'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
          isActive
            ? 'bg-sky-600 text-white shadow-2xs'
            : 'bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-2xs group-hover:bg-white/30 group-hover:border-white/50'
        }`}
      >
        {icon}
      </div>
      <span className={isActive ? '' : 'drop-shadow-2xs'}>
        {label}
      </span>
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 bg-[#ef2323] rounded-r-full transition-all duration-300 ${
          isActive ? 'h-3/5' : 'h-0 group-hover:h-1/2 bg-white/80'
        }`}
      />
    </Link>
  );
}
