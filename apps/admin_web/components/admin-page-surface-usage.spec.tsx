import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const appDirectory = path.resolve(__dirname, '../app');

const sharedSurfacePattern =
  /Admin(PageTemplate|Section|DataTable|TableScroll|FilterPanel|Card|AsideCard|NoticeCard|ErrorState|EmptyState|LoadingState|FormCard|KpiCard|LinkCard|DisclosureCard|ActionCard)|StatusBadge|MoneyText|DateTimeText/;

const delegatedSharedSurfaces = [
  {
    marker: 'renderBookingMonitorRoute',
    source: path.join(appDirectory, 'bookings/booking-monitor.tsx'),
  },
  {
    marker: 'BookingMonitor',
    source: path.join(appDirectory, 'bookings/booking-monitor.tsx'),
  },
  {
    marker: 'ReferralDashboard',
    source: path.join(appDirectory, 'referrals/referral-dashboard.tsx'),
  },
  {
    marker: 'ReferralCashoutQueuePage',
    source: path.join(appDirectory, 'referrals/referral-cashout-queue.tsx'),
  },
  {
    marker: 'ReferralParentDetailPage',
    source: path.join(appDirectory, 'referrals/referral-detail.tsx'),
  },
] as const;

describe('Admin page Vuexy surface usage', () => {
  it('keeps every page on a shared Vuexy surface or an intentional route wrapper', () => {
    const pageFiles = collectPageFiles(appDirectory);
    const unsupportedPages = pageFiles
      .flatMap((file) => {
        const surface = classifyPageSurface(file);

        return surface.kind === 'unsupported' ? [`${pageFileToRoute(file)}: ${surface.reason}`] : [];
      });

    expect(unsupportedPages).toEqual([]);
  });

  it('keeps delegated route wrappers backed by renderers that use shared Vuexy surfaces', () => {
    const pageFiles = collectPageFiles(appDirectory);
    const brokenDelegates = pageFiles
      .flatMap((file) => {
        const surface = classifyPageSurface(file);

        return surface.kind === 'delegate' && !surface.rendererUsesSharedSurface
          ? [`${pageFileToRoute(file)}: ${surface.renderer}`]
          : [];
      });

    expect(brokenDelegates).toEqual([]);
  });

  it('keeps page-level card surfaces behind shared Admin surface components', () => {
    const pageFiles = collectPageFiles(appDirectory);
    const rawPageSurfaces = pageFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const rawSurfaceLines = source
        .split('\n')
        .flatMap((line, index) =>
          /<(section|article|details)\s+className=/.test(line.trim())
            ? [`${pageFileToRoute(file)}:${index + 1}: ${line.trim()}`]
            : [],
        );

      return rawSurfaceLines;
    });

    expect(rawPageSurfaces).toEqual([]);
  });
});

type PageSurface =
  | { readonly kind: 'shared' }
  | { readonly kind: 'redirect' }
  | { readonly kind: 're-export' }
  | {
      readonly kind: 'delegate';
      readonly renderer: string;
      readonly rendererUsesSharedSurface: boolean;
    }
  | { readonly kind: 'unsupported'; readonly reason: string };

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectPageFiles(entryPath);
    }

    return entry === 'page.tsx' ? [entryPath] : [];
  });
}

function classifyPageSurface(filePath: string): PageSurface {
  const source = readFileSync(filePath, 'utf8');

  if (sharedSurfacePattern.test(source)) {
    return { kind: 'shared' };
  }

  if (/\bredirect\(/.test(source)) {
    return { kind: 'redirect' };
  }

  if (/export\s+\{\s*default\s+\}\s+from/.test(source)) {
    return { kind: 're-export' };
  }

  const delegate = delegatedSharedSurfaces.find(({ marker }) => source.includes(marker));

  if (delegate) {
    const rendererSource = readFileSync(delegate.source, 'utf8');

    return {
      kind: 'delegate',
      renderer: path.relative(appDirectory, delegate.source).replaceAll(path.sep, '/'),
      rendererUsesSharedSurface: sharedSurfacePattern.test(rendererSource),
    };
  }

  return {
    kind: 'unsupported',
    reason: 'missing shared Admin surface, redirect, re-export, or documented renderer delegate',
  };
}

function pageFileToRoute(filePath: string) {
  const relativePath = path.relative(appDirectory, filePath);
  const routeSegments = relativePath
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('('));

  return routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
}
