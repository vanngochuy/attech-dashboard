'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './theme-context';

export default function ThemeToggleButton() {
  const { theme, toggleTheme, isDeepAero } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all backdrop-blur-md cursor-pointer drop-shadow-xs border ${
        isDeepAero
          ? 'bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 border-sky-400/40 shadow-xs shadow-sky-950/50'
          : 'bg-white/40 hover:bg-white/60 text-[#0f2043] border-white/60 shadow-xs'
      }`}
      title={
        isDeepAero
          ? 'Chuyển sang chủ đề Xanh Trời Mây Trắng (Sky Cloud)'
          : 'Chuyển sang chủ đề Khí quyển sâu (Deep Aero & Glassmorphism)'
      }
    >
      {isDeepAero ? (
        <>
          <Moon className="w-3.5 h-3.5 text-sky-400 fill-sky-400/30" />
          <span className="hidden sm:inline font-mono">Deep Aero</span>
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/30" />
          <span className="hidden sm:inline font-mono">Sky Cloud</span>
        </>
      )}
    </button>
  );
}

