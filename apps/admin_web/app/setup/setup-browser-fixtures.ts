import type { AdminExternalReadiness, AdminExternalServiceStatus } from '../../lib/admin-api';

export type SetupBrowserFixture = {
  readonly label: string;
  readonly result: {
    readonly data: AdminExternalReadiness | null;
    readonly errorCode?: string;
    readonly ok: boolean;
    readonly requestId?: string;
    readonly status: number | null;
  };
};

const FIXTURE_TIME = '2026-08-14T06:30:00.000Z';

export function setupBrowserFixture(name: string | undefined): SetupBrowserFixture | null {
  if (process.env.NODE_ENV === 'production' || process.env.SETUP_BROWSER_FIXTURES_ENABLED !== '1') {
    return null;
  }
  const errorFixture = setupErrorFixture(name);
  if (errorFixture) return errorFixture;
  if (name !== 'degraded') return null;

  const services = [
    serviceFixture({
      category: 'core',
      evidenceGap: false,
      evidenceHref: '/app-sessions?state=live',
      evidenceLevel: 'CONNECTIVITY',
      evidenceSummary: 'Bounded database connectivity was slower than the operational threshold.',
      failureSince: '2026-08-14T06:25:00.000Z',
      id: 'supabase-core-fixture',
      impactSummary: 'Customer, Partner, booking, and retained service records may be impaired.',
      lastProbeAt: FIXTURE_TIME,
      lastSuccessAt: '2026-08-14T06:24:00.000Z',
      lastVerifiedAt: FIXTURE_TIME,
      latencyMs: 1_900,
      name: 'Supabase core',
      probeType: 'CONNECTIVITY',
      runtimeStatus: 'DEGRADED',
      safeOperatorAction: 'Review affected app sessions and escalate database connectivity.',
      verificationMethod: 'Bounded database connectivity query.',
    }),
    serviceFixture({
      category: 'maps',
      id: 'maps-fixture',
      name: 'Maps and geocoding',
      relatedWorkspaceHref: '/vietnam-overview?view=live',
    }),
  ];

  return {
    label: 'degraded runtime evidence',
    result: {
      data: {
        blockingCategories: ['core'],
        checks: [],
        counts: {
          configurationReady: 2,
          deferred: 0,
          degraded: 1,
          evidenceGaps: 1,
          launchBlockers: 0,
          needsAction: 1,
          notMonitored: 1,
          required: 2,
          runtimeVerified: 1,
          unknown: 0,
        },
        currentStageOk: false,
        generatedAt: FIXTURE_TIME,
        launchProfile: 'CASH_ONLY',
        ok: false,
        services,
        timestamp: FIXTURE_TIME,
      },
      ok: true,
      status: 200,
    },
  };
}

function setupErrorFixture(name: string | undefined): SetupBrowserFixture | null {
  const errors: Record<string, { code: string; label: string; status: number | null }> = {
    'error-401': { code: 'SETUP_FIXTURE_UNAUTHORIZED', label: '401 expired session response', status: 401 },
    'error-403': { code: 'SETUP_FIXTURE_FORBIDDEN', label: '403 access denied response', status: 403 },
    'error-429': { code: 'SETUP_FIXTURE_RATE_LIMITED', label: '429 rate limited response', status: 429 },
    'error-503': { code: 'SETUP_FIXTURE_UNAVAILABLE', label: '503 status read failure', status: 503 },
    'error-timeout': { code: 'SETUP_FIXTURE_TIMEOUT', label: 'status read timeout', status: null },
  };
  const error = name ? errors[name] : null;
  return error
    ? {
        label: error.label,
        result: { data: null, errorCode: error.code, ok: false, status: error.status },
      }
    : null;
}

function serviceFixture(overrides: Partial<AdminExternalServiceStatus>): AdminExternalServiceStatus {
  return {
    category: 'maps',
    configurationCheckedAt: FIXTURE_TIME,
    configurationStatus: 'CONFIGURED',
    enabled: true,
    evidenceGap: true,
    evidenceHref: null,
    evidenceLevel: 'CONFIGURATION_ONLY',
    evidenceSummary: 'Configuration was checked. No safe side-effect-free runtime probe is configured.',
    failureSince: null,
    id: 'service-fixture',
    impactSummary: 'No confirmed impact.',
    isStale: false,
    lastProbeAt: null,
    lastSuccessAt: null,
    lastVerifiedAt: FIXTURE_TIME,
    latencyMs: null,
    name: 'External service',
    ownerTeam: 'Operations',
    probeType: 'CONFIG',
    relatedWorkspaceHref: '/app-sessions',
    requiredForCurrentLaunch: true,
    runbookHref: null,
    runbookUrl: null,
    runtimeStatus: 'NOT_MONITORED',
    safeOperatorAction: 'Review recent operational evidence before relying on this service.',
    escalationRoute: '/app-sessions',
    verificationMethod: 'Configuration keys and formats only.',
    ...overrides,
  };
}
