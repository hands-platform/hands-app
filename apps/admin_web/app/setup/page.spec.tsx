import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult, type AdminExternalReadiness } from '../../lib/admin-api';
import SetupPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('SetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminGetResult.mockResolvedValue({
      data: readinessFixture,
      ok: true,
      status: 200,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders External Services as separate runtime and readiness workspaces', async () => {
    const page = await SetupPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h1>External Services</h1>');
    expect(markup).toContain('Runtime health');
    expect(markup).toContain('Launch readiness');
    expect(markup).toContain('Cash-only launch');
    expect(markup).toContain('Active services');
    expect(markup).not.toContain('Operational');
    expect(markup).not.toContain('3 blocked');
    expect(markup).not.toContain('npm.cmd');
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/health/external', null);
  });

  it('preserves valid URL state and redirects invalid queries to the visible canonical view', async () => {
    const deferred = await SetupPage({ searchParams: Promise.resolve({ mode: 'readiness', view: 'deferred' }) });

    expect(renderToStaticMarkup(deferred)).toContain('href="/setup?mode=readiness&amp;view=deferred"');
    await expect(
      SetupPage({ searchParams: Promise.resolve({ mode: 'broken', view: 'broken' }) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining('/setup?mode=runtime&view=active'),
    });
    await expect(
      SetupPage({ searchParams: Promise.resolve({ mode: 'runtime', view: 'deferred' }) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining('/setup?mode=readiness&view=deferred'),
    });
  });

  it('does not render failure as zero or healthy data', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: null, ok: false, requestId: 'request-500', status: 500 });
    const page = await SetupPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Status check unavailable');
    expect(markup).toContain('request-500');
    expect(markup).not.toContain('Needs action 0');
    expect(markup).not.toContain('All systems operational');
  });

  it('renders isolated degraded and error browser fixtures without calling the live API', async () => {
    vi.stubEnv('SETUP_BROWSER_FIXTURES_ENABLED', '1');
    const degraded = await SetupPage({
      searchParams: Promise.resolve({ fixture: 'degraded', mode: 'runtime', view: 'needs-action' }),
    });
    const degradedMarkup = renderToStaticMarkup(degraded);

    expect(degradedMarkup).toContain('Isolated browser fixture: degraded runtime evidence');
    expect(degradedMarkup).toContain('Degraded');
    expect(degradedMarkup).toContain('View evidence');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();

    const errorCases = [
      ['error-401', 'Session expired'],
      ['error-403', 'Access required'],
      ['error-429', 'Status checks temporarily limited'],
      ['error-503', 'Status check unavailable'],
      ['error-timeout', 'Status check unavailable'],
    ] as const;
    for (const [fixture, title] of errorCases) {
      const unavailable = await SetupPage({ searchParams: Promise.resolve({ fixture }) });
      expect(renderToStaticMarkup(unavailable)).toContain(title);
    }
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('keeps the five-column desktop tables inside the setup content width', () => {
    expect(globalCss).toContain('.setup-health-table-scroll {');
    expect(globalCss).toContain('overflow-x: visible;');
    expect(globalCss).toContain('overflow-y: visible;');
    expect(globalCss).toMatch(/\.setup-health-table\s*{[^}]*min-width:\s*0;[^}]*table-layout:\s*fixed;[^}]*width:\s*100%;/s);
    expect(globalCss).not.toMatch(/\.setup-health-table\s*{[^}]*min-width:\s*1260px;/s);
  });

  it('keeps the shared page template and existing visual system', () => {
    const source = readFileSync(join(process.cwd(), 'app/setup/page.tsx'), 'utf8');
    const loadingSource = readFileSync(join(process.cwd(), 'app/setup/loading.tsx'), 'utf8');
    const refreshSource = readFileSync(join(process.cwd(), 'app/setup/setup-refresh-control.tsx'), 'utf8');
    const fixtureSource = readFileSync(join(process.cwd(), 'app/setup/setup-browser-fixtures.ts'), 'utf8');
    expect(source).toContain('AdminPageTemplate');
    expect(source).toContain('SetupRefreshControl');
    expect(source).toContain('contentClassName="setup-page"');
    expect(source).not.toContain('<div className="setup-page">');
    expect(loadingSource).toContain('AdminLoadingState');
    expect(loadingSource).toContain('without sending messages, payments, or uploads');
    expect(refreshSource).toContain('useActionState');
    expect(refreshSource).toContain('disabled={pending}');
    expect(refreshSource).toContain('aria-live="polite"');
    expect(refreshSource).toContain('role="status"');
    expect(refreshSource).toContain("querySelector('button')?.focus()");
    expect(fixtureSource).toContain("process.env.NODE_ENV === 'production'");
    expect(fixtureSource).toContain("process.env.SETUP_BROWSER_FIXTURES_ENABLED !== '1'");
  });
});

const readinessFixture: AdminExternalReadiness = {
  ok: true,
  currentStageOk: true,
  timestamp: '2026-08-12T03:00:00.000Z',
  generatedAt: '2026-08-12T03:00:01.000Z',
  launchProfile: 'CASH_ONLY',
  counts: {
    needsAction: 0,
    launchBlockers: 0,
    degraded: 0,
    unknown: 0,
    notMonitored: 1,
    evidenceGaps: 1,
    deferred: 0,
    required: 1,
    configurationReady: 1,
    runtimeVerified: 0,
  },
  checks: [],
  services: [{
    id: 'maps',
    name: 'Maps and geocoding',
    category: 'maps',
    enabled: true,
    requiredForCurrentLaunch: true,
    configurationStatus: 'CONFIGURED',
    configurationCheckedAt: '2026-08-12T03:00:00.000Z',
    runtimeStatus: 'NOT_MONITORED',
    probeType: 'CONFIG',
    evidenceLevel: 'CONFIGURATION_ONLY',
    lastVerifiedAt: '2026-08-12T03:00:00.000Z',
    verificationMethod: 'Configuration keys and formats only.',
    lastProbeAt: null,
    lastSuccessAt: null,
    failureSince: null,
    latencyMs: null,
    isStale: false,
    evidenceSummary: 'Configuration checked.',
    impactSummary: 'No confirmed impact.',
    ownerTeam: 'Marketplace operations',
    evidenceHref: null,
    relatedWorkspaceHref: '/vietnam-overview',
    runbookHref: null,
    escalationRoute: '/vietnam-overview',
    runbookUrl: null,
    safeOperatorAction: 'No configuration action required.',
    evidenceGap: true,
  }],
};
