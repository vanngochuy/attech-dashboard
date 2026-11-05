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
          ? 'bg-white text-sky-900 font-bold shadow-md shadow-sky-900/10 ring-1 ring-white'
          : 'text-white font-semibold hover:bg-white/25 hover:text-white backdrop-blur-[1px]'
      }`}
    >
      <div
        className={`transition-colors ${
          isActive ? 'text-[#0284c7]' : 'text-sky-100 group-hover:text-white'
        }`}
      >
        {icon}
      </div>
      <span className={isActive ? '' : 'drop-shadow-[0_1px_1px_rgba(3,105,161,0.35)]'}>
        {label}
      </span>
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 bg-[#ef2323] rounded-r-full transition-all duration-300 ${
          isActive ? 'h-3/5' : 'h-0 group-hover:h-1/2 bg-white'
        }`}
      />
    </Link>
  );
}
