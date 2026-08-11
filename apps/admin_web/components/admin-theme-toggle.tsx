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

  const nextTheme: AdminTheme = theme === 'light' ? 'dark' : 'light';
  const label = nextTheme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <div className="theme-toggle">
      <AdminIconButton
        aria-label={label}
        className="theme-toggle-button"
        onClick={() => changeTheme(nextTheme)}
        title={label}
        type="button"
      >
        {nextTheme === 'dark' ? (
          <Moon aria-hidden="true" size={16} />
        ) : (
          <Sun aria-hidden="true" size={16} />
        )}
      </AdminIconButton>
    </div>
  );
}
