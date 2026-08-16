import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP_ROOT = join(process.cwd(), 'app');

const AUTH_SHELL_EXCEPTIONS = new Set([
  'app/login/page.tsx',
  'app/operator-setup/page.tsx',
]);

const REDIRECT_PAGES = new Set([
  'app/files/page.tsx',
  'app/providers/page.tsx',
  'app/providers/[id]/page.tsx',
  'app/referrals/page.tsx',
]);

const DELEGATED_SHELL_PAGES = new Map<string, readonly string[]>([
  ['app/audit-log/page.tsx', ['app/audit-log/page-content.tsx']],
  ['app/bookings/page.tsx', ['app/bookings/booking-monitor.tsx']],
  ['app/bookings/completed/page.tsx', ['app/bookings/booking-monitor.tsx']],
  ['app/bookings/post-match-cancellations/page.tsx', ['app/bookings/booking-monitor.tsx']],
  ['app/referrals/cashouts/page.tsx', ['app/referrals/referral-cashout-queue.tsx']],
  ['app/referrals/customers/page.tsx', ['app/referrals/referral-dashboard.tsx']],
  ['app/referrals/partners/page.tsx', ['app/referrals/referral-dashboard.tsx']],
  ['app/referrals/customers/[id]/page.tsx', ['app/referrals/referral-detail.tsx']],
  ['app/referrals/partners/[id]/page.tsx', ['app/referrals/referral-detail.tsx']],
]);

describe('Admin page shell inventory', () => {
  it('keeps every concrete Admin page on the shared Vuexy shell or a documented exception', () => {
    const unclassifiedPages: string[] = [];

    for (const pagePath of findPageFiles(APP_ROOT)) {
      const source = readFileSync(pagePath, 'utf8');
      const normalizedPath = normalizePath(relative(process.cwd(), pagePath));

      if (source.includes('AdminPageTemplate')) {
        continue;
      }

      if (AUTH_SHELL_EXCEPTIONS.has(normalizedPath)) {
        expect(source).toContain('AdminCard');
        continue;
      }

      if (REDIRECT_PAGES.has(normalizedPath)) {
        expect(source).toContain('redirect(');
        continue;
      }

      const delegatedShellFiles = DELEGATED_SHELL_PAGES.get(normalizedPath);
      if (delegatedShellFiles) {
        delegatedShellFiles.forEach((delegatedShellFile) => {
          const delegatedPath = join(process.cwd(), delegatedShellFile);
          expect(existsSync(delegatedPath), `${delegatedShellFile} should exist`).toBe(true);
          expect(readFileSync(delegatedPath, 'utf8')).toContain('AdminPageTemplate');
        });
        continue;
      }

      unclassifiedPages.push(normalizedPath);
    }

    expect(unclassifiedPages).toEqual([]);
  });
});

function findPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findPageFiles(entryPath);
    }
    return entry.name === 'page.tsx' ? [entryPath] : [];
  });
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}
