'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ADMIN_THEME_STORAGE_KEY } from '../lib/admin-theme';
import { AdminIconButton } from './admin-icon-button';

type AdminTheme = 'light' | 'dark';

const isTheme = (value: string | null): value is AdminTheme => value === 'light' || value === 'dark';

function getCurrentTheme(): AdminTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const currentTheme = document.documentElement.dataset.theme ?? null;

  if (isTheme(currentTheme)) {
    return currentTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: AdminTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
}

export function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>('light');

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setTheme(getCurrentTheme());
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const changeTheme = (nextTheme: AdminTheme) => {
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <div aria-label="Theme mode" className="theme-toggle" role="group">
      <AdminIconButton
        aria-pressed={theme === 'light'}
        className="theme-toggle-button"
        onClick={() => changeTheme('light')}
        title="Light mode"
        type="button"
      >
        <Sun aria-hidden="true" size={16} />
      </AdminIconButton>
      <AdminIconButton
        aria-pressed={theme === 'dark'}
        className="theme-toggle-button"
        onClick={() => changeTheme('dark')}
        title="Dark mode"
        type="button"
      >
        <Moon aria-hidden="true" size={16} />
      </AdminIconButton>
    </div>
  );
}
