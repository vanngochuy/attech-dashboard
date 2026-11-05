'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'sky' | 'deep-aero';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  toggleTheme: () => void;
  isDeepAero: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'sky',
  setTheme: () => {},
  toggleTheme: () => {},
  isDeepAero: false,
});

const THEME_STORAGE_KEY = 'attech_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('sky');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
      if (saved === 'deep-aero' || saved === 'sky') {
        setThemeState(saved);
      }
    } catch {
      // Ignore
    }
    setMounted(true);
  }, []);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'sky' ? 'deep-aero' : 'sky');
  };

  const isDeepAero = mounted ? theme === 'deep-aero' : false;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDeepAero }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
