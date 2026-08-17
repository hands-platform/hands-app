import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminDesktopOnlyGate } from './admin-desktop-only-gate';

const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const globalsSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('AdminDesktopOnlyGate', () => {
  it('keeps the desktop app and a dedicated small-screen blocker in one global gate', () => {
    const markup = renderToStaticMarkup(
      <AdminDesktopOnlyGate>
        <div>Admin workspace</div>
      </AdminDesktopOnlyGate>,
    );

    expect(markup).toContain('admin-desktop-only-blocker');
    expect(markup).toContain('Desktop required');
    expect(markup).toContain('Use a screen at least 1024 px wide to make Admin changes.');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-labelledby="admin-desktop-only-title"');
    expect(markup).toContain('aria-describedby="admin-desktop-only-description"');
    expect(markup).toContain('admin-desktop-only-app');
    expect(markup).toContain('Admin workspace');
    expect(markup).not.toContain('<h1');
  });

  it('wraps the complete Admin root shell at the application layout boundary', () => {
    expect(layoutSource).toContain('<AdminDesktopOnlyGate>');
    expect(layoutSource).toContain('<AdminRootShellLoader sections={navSections}>');
    expect(layoutSource.indexOf('<AdminDesktopOnlyGate>')).toBeLessThan(
      layoutSource.indexOf('<AdminRootShellLoader sections={navSections}>'),
    );
  });

  it('blocks coarse-pointer mobile screens without forcing desktop document overflow', () => {
    expect(globalsSource).toContain('@media (max-width: 1023px) and (any-pointer: coarse)');
    expect(globalsSource).not.toContain('min-width: 1024px;');
  });
});
