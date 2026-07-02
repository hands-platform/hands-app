import { ADMIN_THEME_STORAGE_KEY } from '../lib/admin-theme';
import Script from 'next/script';

const themeInitScript = `
(() => {
  try {
    const storedTheme = localStorage.getItem('${ADMIN_THEME_STORAGE_KEY}');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : systemTheme;

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }
})();
`;

export function AdminThemeScript() {
  return (
    <Script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      id="admin-theme-bootstrap"
      strategy="beforeInteractive"
    />
  );
}
