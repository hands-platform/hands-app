import type { AdminExternalReadiness } from '../../lib/admin-api';
import {
  buildCurrentStageStatus,
  buildDeferredOperatorActions,
  buildExternalBacklog,
  buildExternalRegistrationPlan,
  buildGroupStatuses,
  buildNextOperatorActions,
  buildOperationalHealthRows,
  buildSetupGroupDetails,
  buildSummary,
  externalServicesFromReadiness,
  isReadinessUnavailable,
  parseSetupWorkspaceQuery,
  setupWorkspaceCanonicalHref,
  setupServicesForView,
  setupWorkspaceCounts,
  type ExternalRegistrationPlanItem,
  type SetupOrderItem,
} from './setup-page-model';

describe('setup page model', () => {
  it('round-trips workspace modes and saved views with stable defaults', () => {
    expect(parseSetupWorkspaceQuery({})).toEqual({ mode: 'runtime', view: 'active' });
    expect(parseSetupWorkspaceQuery({ mode: 'readiness', view: 'deferred' })).toEqual({
      mode: 'readiness',
      view: 'deferred',
    });
    expect(parseSetupWorkspaceQuery({ mode: 'runtime', view: 'evidence-gaps' })).toEqual({
      mode: 'runtime',
      view: 'evidence-gaps',
    });
    expect(parseSetupWorkspaceQuery({ mode: 'runtime', view: 'deferred' })).toEqual({
      mode: 'readiness',
      view: 'deferred',
    });
    expect(parseSetupWorkspaceQuery({ mode: 'readiness', view: 'evidence-gaps' })).toEqual({
      mode: 'runtime',
      view: 'evidence-gaps',
    });
    expect(parseSetupWorkspaceQuery({ mode: 'broken', view: 'broken' })).toEqual({
      mode: 'runtime',
      view: 'active',
    });
    expect(setupWorkspaceCanonicalHref({ mode: 'runtime', view: 'evidence-gaps' })).toBeNull();
    expect(setupWorkspaceCanonicalHref({ mode: 'runtime', view: 'deferred' })).toBe(
      '/setup?mode=readiness&view=deferred',
    );
    expect(setupWorkspaceCanonicalHref({ mode: 'readiness', view: 'evidence-gaps' })).toBe(
      '/setup?mode=runtime&view=evidence-gaps',
    );
    expect(setupWorkspaceCanonicalHref({ mode: 'broken', view: 'broken' })).toBe(
      '/setup?mode=runtime&view=active',
    );
  });

  it('keeps legacy READY configuration as runtime not monitored', () => {
    const services = externalServicesFromReadiness(readinessFixture({
      checks: [{
        category: 'maps',
        name: 'Maps and geocoding',
        status: 'READY',
        configured: ['MAPTILER_API_KEY'],
        missing: [],
        detail: 'Maps are configured.',
        scope: 'CURRENT_STAGE',
      }],
    }));

    expect(services[0]).toMatchObject({
      configurationStatus: 'CONFIGURED',
      runtimeStatus: 'NOT_MONITORED',
      lastProbeAt: null,
      lastSuccessAt: null,
      safeOperatorAction: 'Review recent operational evidence before relying on this service.',
    });
  });

  it('filters action, active, evidence-gap, and deferred services without mixing scopes', () => {
    const services = [
      externalService({ id: 'down', runtimeStatus: 'DOWN' }),
      externalService({ id: 'active' }),
      externalService({ id: 'deferred', configurationStatus: 'DEFERRED', enabled: false, requiredForCurrentLaunch: false }),
    ];

    expect(setupWorkspaceCounts(services)).toEqual({
      needsAction: 1,
      launchBlockers: 0,
      degraded: 0,
      unknown: 0,
      notMonitored: 1,
      evidenceGaps: 1,
      deferred: 1,
      required: 2,
      configurationReady: 2,
      runtimeVerified: 0,
    });
    expect(setupServicesForView(services, 'runtime', 'needs-action').map((service) => service.id)).toEqual(['down']);
    expect(setupServicesForView(services, 'runtime', 'active').map((service) => service.id)).toEqual(['down', 'active']);
    expect(setupServicesForView(services, 'runtime', 'evidence-gaps').map((service) => service.id)).toEqual(['active']);
    expect(setupServicesForView(services, 'readiness', 'active').map((service) => service.id)).toEqual(['down', 'active']);
    expect(setupServicesForView(services, 'readiness', 'deferred').map((service) => service.id)).toEqual(['deferred']);
  });
  it('builds current-stage and deferred setup signals from readiness checks', () => {
    const readiness = readinessFixture({
      checks: [
        {
          category: 'operations-policy',
          name: 'Dispatch policy',
          status: 'BLOCKED',
          configured: ['WALLET_NEGATIVE_BALANCE_GATE'],
          missing: ['MATCHING_BACKUP_OPEN_MODE'],
          detail: 'Dispatch policy must be reviewed.',
          scope: 'CURRENT_STAGE',
          operatorAction: 'Review operations policy before dispatch smoke.',
          commands: ['Open http://localhost:3101/operations-policy'],
        },
        {
          category: 'payments',
          name: 'Gateway sandbox',
          status: 'PARTIAL',
          configured: ['MOMO_PARTNER_CODE'],
          missing: ['MOMO_ACCESS_KEY'],
          detail: 'Payment gateway sandbox is incomplete.',
          scope: 'DEFERRED',
          commands: ['npm.cmd run external:check:payments'],
        },
        {
          category: 'push',
          name: 'Firebase Admin project matches mobile apps',
          status: 'BLOCKED',
          configured: ['PUSH_PROVIDER'],
          missing: [],
          invalid: ['FIREBASE_PROJECT_ID_MISMATCH'],
          detail:
            'Keep Firebase Admin credentials and mobile google-services.json files in the same Firebase project before live FCM push.',
          scope: 'DEFERRED',
          operatorAction:
            'Validate the Firebase Admin service account JSON from the same Firebase project as the mobile google-services.json files, then install it.',
          commands: ['npm.cmd run external:check:push'],
        },
        {
          category: 'referrals',
          name: 'Referral app links',
          status: 'BLOCKED',
          configured: [],
          missing: ['REFERRAL_CUSTOMER_ANDROID_STORE_URL'],
          invalid: [],
          detail: 'Store links are not configured.',
          scope: 'DEFERRED',
          operatorAction: 'Set referral store URLs before referral E2E.',
          commands: ['npm.cmd run external:check:referrals'],
        },
      ],
    });

    expect(buildSummary(readiness)).toEqual({ ready: 0, partial: 1, blocked: 3, missing: 4 });
    expect(buildGroupStatuses(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({ id: 'operations-policy', status: 'Blocked' }),
      expect.objectContaining({ id: 'payments', status: 'Partial' }),
      expect.objectContaining({ id: 'notifications', status: 'Blocked' }),
      expect.objectContaining({ id: 'referrals', status: 'Blocked' }),
    ]);
    expect(buildExternalBacklog(readiness, setupOrderFixture)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: 'operations-policy',
          groupTitle: 'Runtime operations policy',
          name: 'MATCHING_BACKUP_OPEN_MODE',
        }),
        expect.objectContaining({
          groupId: 'notifications',
          groupTitle: 'FCM push',
          name: 'Firebase Admin project does not match mobile app project',
          reason:
            'Validate the Firebase Admin service account JSON from the same Firebase project as the mobile google-services.json files, then install it.',
        }),
        expect.objectContaining({
          groupId: 'referrals',
          groupTitle: 'Referral app links',
          name: 'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
          reason: 'Set referral store URLs before referral E2E.',
        }),
      ]),
    );
    expect(buildNextOperatorActions(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({
        groupId: 'operations-policy',
        phase: 'Dispatch policy control',
        action: 'Review operations policy before live dispatch testing.',
      }),
    ]);
    expect(buildDeferredOperatorActions(readiness, setupOrderFixture)).toEqual([
      expect.objectContaining({
        groupId: 'payments',
        action: 'Add sandbox credentials before real payment testing.',
      }),
      expect.objectContaining({
        groupId: 'notifications',
        name: 'Firebase Admin project does not match mobile app project',
        action: 'Install matching Firebase Admin credentials before live push testing.',
        reason:
          'Validate the Firebase Admin service account JSON from the same Firebase project as the mobile google-services.json files, then install it.',
      }),
      expect.objectContaining({
        groupId: 'referrals',
        action: 'Set customer and Partner store URLs before referral E2E.',
      }),
    ]);
    expect(buildCurrentStageStatus(readiness, setupOrderFixture)).toMatchObject({
      ok: false,
      blockers: 1,
      label: 'Current stage blocked',
    });
    expect(buildSetupGroupDetails(readiness, setupOrderFixture)[0]).toMatchObject({
      id: 'operations-policy',
      status: 'Blocked',
      statusClass: 'signal signal-warn',
      envPills: expect.arrayContaining([
        { name: 'MATCHING_BACKUP_OPEN_MODE', className: 'pill pill-warn' },
        { name: 'WALLET_NEGATIVE_BALANCE_GATE', className: 'pill pill-success' },
      ]),
    });
    const operationalRows = buildOperationalHealthRows(readiness, registrationPlanFixture);
    expect(operationalRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affectedWork: 'Booking matching, wallet gates, and operational controls.',
          name: 'Dispatch policy',
          nextAction: 'Review blocked policy settings before relying on booking operations.',
          owner: 'Operations team, Platform team',
          status: 'Blocked',
        }),
        expect.objectContaining({
          name: 'Gateway sandbox',
          status: 'Limited',
        }),
      ]),
    );
    expect(JSON.stringify(operationalRows)).not.toMatch(/\bE2E\b|repository path|dispatch smoke/i);
  });

  it('keeps build and source-code checks out of operator system health', () => {
    const readiness = readinessFixture({
      checks: [
        {
          category: 'mobile-release',
          name: 'Android release signing',
          status: 'BLOCKED',
          configured: [],
          missing: ['ANDROID_KEYSTORE_PATH'],
          detail: 'Release signing is missing.',
          scope: 'DEFERRED',
        },
        {
          category: 'maps',
          name: 'Maps and geocoding',
          status: 'READY',
          configured: ['MAPS_API_KEY'],
          missing: [],
          detail: 'Maps are configured.',
          scope: 'CURRENT_STAGE',
        },
      ],
    });

    expect(buildOperationalHealthRows(readiness, registrationPlanFixture)).toEqual([
      expect.objectContaining({
        affectedWork: 'Address search, location confirmation, and nearby Partner discovery.',
        name: 'Maps and geocoding',
      }),
    ]);
  });

  it('builds registration plan display state and API-unavailable fallback', () => {
    const unavailable = readinessFixture({ checks: [] });

    expect(isReadinessUnavailable(unavailable)).toBe(true);
    expect(buildSummary(unavailable, true)).toEqual({ ready: 0, partial: 0, blocked: 1, missing: 1 });
    expect(buildExternalBacklog(unavailable, setupOrderFixture, true)).toEqual([
      expect.objectContaining({ groupId: 'live-readiness', name: 'API readiness endpoint' }),
    ]);
    expect(buildDeferredOperatorActions(unavailable, setupOrderFixture, true)).toEqual([]);
    expect(buildCurrentStageStatus(unavailable, setupOrderFixture, true)).toMatchObject({
      ok: false,
      label: 'API unavailable',
    });
    expect(buildExternalRegistrationPlan(unavailable, registrationPlanFixture, true)).toEqual([
      expect.objectContaining({ id: 'ops-policy', status: 'Not checked', statusClass: 'pill-warn' }),
      expect.objectContaining({ id: 'source-control', status: 'Account ready', statusClass: 'pill-success' }),
    ]);
    expect(buildOperationalHealthRows(unavailable, registrationPlanFixture, true)).toEqual([
      expect.objectContaining({
        lastCheckedAt: null,
        owner: 'Owner unavailable',
        status: 'Unavailable',
      }),
    ]);
  });
});

const setupOrderFixture: SetupOrderItem[] = [
  {
    id: 'operations-policy',
    title: 'Runtime operations policy',
    phase: 'Dispatch policy control',
    operatorAction: 'Review operations policy before live dispatch testing.',
    exitCriteria: 'Policy review is complete.',
    purpose: 'Required before live dispatch smoke.',
    env: ['MATCHING_BACKUP_OPEN_MODE', 'WALLET_NEGATIVE_BALANCE_GATE'],
    notes: ['Keep operational policy editable from admin.'],
    commands: ['Open http://localhost:3101/operations-policy'],
  },
  {
    id: 'payments',
    title: 'Vietnam payment gateways',
    phase: 'Commercial E2E',
    operatorAction: 'Add sandbox credentials before real payment testing.',
    exitCriteria: 'Payment smoke passes.',
    purpose: 'Required for real payment E2E.',
    env: ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY'],
    notes: ['Use sandbox credentials first.'],
    commands: ['npm.cmd run external:check:payments'],
  },
  {
    id: 'notifications',
    title: 'FCM push',
    phase: 'Deferred push E2E',
    operatorAction: 'Install matching Firebase Admin credentials before live push testing.',
    exitCriteria: 'FCM preflight passes.',
    purpose: 'Required before live FCM push smoke.',
    env: ['PUSH_PROVIDER', 'FIREBASE_SERVICE_ACCOUNT_JSON'],
    notes: ['Keep Firebase Admin credentials server-side only.'],
    commands: ['npm.cmd run external:check:push'],
  },
  {
    id: 'referrals',
    title: 'Referral app links',
    phase: 'Referral E2E',
    operatorAction: 'Set customer and Partner store URLs before referral E2E.',
    exitCriteria: 'Referral links open the correct app store.',
    purpose: 'Required before public referral sharing.',
    env: ['REFERRAL_CUSTOMER_ANDROID_STORE_URL'],
    notes: ['Store URLs are deferred until referral E2E.'],
    commands: ['npm.cmd run external:check:referrals'],
  },
];

const registrationPlanFixture: ExternalRegistrationPlanItem[] = [
  {
    id: 'ops-policy',
    groupId: 'operations-policy',
    title: 'Runtime policy',
    provider: 'HANDS Admin',
    owner: 'Operations team',
    detail: 'Policy setup state.',
    env: ['MATCHING_BACKUP_OPEN_MODE'],
  },
  {
    id: 'source-control',
    groupId: 'operations-policy',
    title: 'Source control',
    provider: 'GitHub',
    owner: 'Platform team',
    status: 'Account ready',
    statusClass: 'pill-success',
    detail: 'Repository is ready.',
    env: ['GITHUB_OWNER'],
  },
];

function readinessFixture(overrides: Partial<AdminExternalReadiness>): AdminExternalReadiness {
  return {
    ok: false,
    timestamp: new Date(0).toISOString(),
    checks: [],
    ...overrides,
  };
}

function externalService(
  overrides: Partial<NonNullable<AdminExternalReadiness['services']>[number]>,
): NonNullable<AdminExternalReadiness['services']>[number] {
  return {
    id: 'service',
    name: 'External service',
    category: 'maps',
    enabled: true,
    requiredForCurrentLaunch: true,
    configurationStatus: 'CONFIGURED',
    configurationCheckedAt: '2026-08-12T03:00:00.000Z',
    runtimeStatus: 'NOT_MONITORED',
    probeType: 'CONFIG',
    lastProbeAt: null,
    lastSuccessAt: null,
    failureSince: null,
    latencyMs: null,
    isStale: false,
    evidenceSummary: 'Configuration checked.',
    impactSummary: 'No confirmed impact.',
    ownerTeam: 'Operations',
    escalationRoute: '/app-sessions',
    runbookUrl: null,
    safeOperatorAction: 'No configuration action required.',
    ...overrides,
  };
}
