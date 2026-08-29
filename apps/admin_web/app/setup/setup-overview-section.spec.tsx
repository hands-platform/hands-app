import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminExternalReadiness, AdminExternalServiceStatus } from '../../lib/admin-api';
import { SetupOverviewSection } from './setup-overview-section';

describe('SetupOverviewSection', () => {
  it('renders configured services without claiming unprobed runtime is healthy', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'runtime',
      readiness: readinessFixture([
        serviceFixture({
          configurationStatus: 'CONFIGURED',
          evidenceSummary: 'Configuration was checked. No safe runtime probe is configured.',
          name: 'FCM push service',
          runtimeStatus: 'NOT_MONITORED',
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'active',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Runtime health');
    expect(rendered).toContain('Not monitored');
    expect(rendered).toContain('Configuration ready');
    expect(rendered).toContain('Configuration checked');
    expect(rendered).not.toContain('Last runtime verification');
    expect(rendered).toContain('Technical details');
    expect(rendered).not.toContain('Operational');
    expect(renderToStaticMarkup(section)).not.toContain('>Healthy<');
  });

  it('keeps cash-only deferred capabilities separate from launch blockers', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([
        deferredServiceFixture('MoMo payments'),
        deferredServiceFixture('VNPay payments'),
      ]),
      requestId: null,
      status: 200,
      view: 'deferred',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Cash-only launch');
    expect(rendered).toContain('Deferred capability ledger');
    expect(rendered).toContain('These capabilities do not block the current launch.');
    expect(rendered).toContain('Review MoMo checklist');
    expect(rendered).toContain('Review VNPay checklist');
    expect(rendered).toContain('0/4 current gates verified');
    expect(rendered).not.toContain('Runtime status');
    expect(rendered).not.toContain('Not monitored');
    expect(rendered).not.toContain('3 blocked');
  });

  it('renders a five-column capability-specific ledger for all three deferred capabilities', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([
        deferredServiceFixture('MoMo payments'),
        deferredServiceFixture('VNPay payments'),
        deferredServiceFixture('Referral app links'),
      ]),
      requestId: null,
      status: 200,
      view: 'deferred',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered.match(/<th scope="col">/g)).toHaveLength(5);
    expect(rendered).toContain('MoMo payments');
    expect(rendered).toContain('VNPay is intentionally disabled during the cash-only launch.');
    expect(rendered).toContain('Before public referral sharing or an Android store release begins.');
    expect(rendered).toContain('Review link readiness');
    expect(rendered).toContain('Customer and Partner iOS destinations');
    expect(rendered).toContain('Future scope');
    expect(rendered).toContain('href="/referrals/customers#referral-link-readiness"');
    expect(rendered).not.toContain('No current impact');
    expect(rendered).not.toContain('Config check');
  });

  it('does not mix an incomplete capability outside the current profile into required capabilities', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([
        serviceFixture({
          configurationStatus: 'INCOMPLETE',
          name: 'MoMo payments',
          requiredForCurrentLaunch: false,
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'active',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('No capabilities match this view.');
    expect(rendered).not.toContain('MoMo payments');
    expect(rendered).toContain('Needs action</span><strong>0</strong>');
    expect(rendered).not.toContain('Launch blockers');
  });

  it.each([
    [401, 'Session expired', 'Sign in again'],
    [403, 'Access required', 'Review operator access'],
    [429, 'Status checks temporarily limited', 'Retry status'],
    [500, 'Status check unavailable', 'Retry status'],
    [null, 'Status check unavailable', 'Retry status'],
  ] as const)('renders distinct error state for status %s', (status, title, action) => {
    const section = SetupOverviewSection({
      errorCode: 'EXTERNAL_STATUS_ERROR',
      mode: 'runtime',
      readiness: null,
      requestId: 'safe-request-id',
      status,
      view: 'active',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain(title);
    expect(rendered).toContain(action);
    expect(rendered).toContain('safe-request-id');
    expect(rendered).not.toContain('Needs action 0');
  });

  it('uses real existing routes for operator evidence actions', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'runtime',
      readiness: readinessFixture([
        serviceFixture({
          evidenceHref: '/notifications?mode=action&issue=failed&channel=fcm',
          name: 'FCM push service',
          relatedWorkspaceHref: '/notifications',
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'active',
    });
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('href="/notifications?mode=action&amp;issue=failed&amp;channel=fcm"');
    expect(markup).toContain('View evidence');
    expect(markup).not.toContain('Open related workspace');
    expect(markup).not.toContain('MOMO_GATEWAY_ENABLED');
    expect(markup).not.toContain('npm.cmd');
  });

  it('does not present evidence gaps or deferred work as current review actions', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'runtime',
      readiness: readinessFixture([
        serviceFixture({ runtimeStatus: 'NOT_MONITORED' }),
        serviceFixture({
          configurationStatus: 'DEFERRED',
          enabled: false,
          id: 'deferred-service',
          requiredForCurrentLaunch: false,
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'active',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Evidence gap');
    expect(rendered).not.toContain('Deferred</span><strong>1</strong>');
    expect(rendered).toContain('Needs action</span><strong>0</strong>');
  });

  it('does not repeat saved-view counts in the adjacent runtime and readiness summaries', () => {
    const runtime = renderToStaticMarkup(SetupOverviewSection({
      errorCode: null,
      mode: 'runtime',
      readiness: readinessFixture([serviceFixture({ runtimeStatus: 'NOT_MONITORED' })]),
      requestId: null,
      status: 200,
      view: 'active',
    }));
    const readiness = renderToStaticMarkup(SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([serviceFixture({})]),
      requestId: null,
      status: 200,
      view: 'active',
    }));

    expect(runtime.match(/>Needs action</gu)).toHaveLength(1);
    expect(runtime.match(/>Evidence gaps</gu)).toHaveLength(1);
    expect(runtime).toContain('>Degraded<');
    expect(runtime).toContain('>Unknown<');
    expect(runtime).toContain('>Not monitored<');
    expect(readiness.match(/>Needs action</gu)).toHaveLength(1);
    expect(readiness.match(/>Required capabilities</gu)).toHaveLength(1);
    expect(readiness.match(/>Deferred</gu)).toHaveLength(1);
  });

  it('renders a dynamic cash-only positive conclusion instead of a generic empty table', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([
        serviceFixture({
          evidenceGap: false,
          evidenceLevel: 'CONNECTIVITY',
          lastVerifiedAt: '2026-08-12T03:00:00.000Z',
          probeType: 'CONNECTIVITY',
          runtimeStatus: 'HEALTHY',
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'needs-action',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Cash-only launch configuration is ready');
    expect(rendered).toContain('1 of 1 required capabilities are configured');
    expect(rendered).toContain('runtime verification is available for 1');
    expect(rendered).toContain('View required capabilities');
    expect(rendered).toContain('Review evidence gaps');
    expect(rendered).toContain('Review deferred ledger');
    expect(rendered).not.toContain('No capabilities match this view.');
  });

  it('keeps degraded services actionable and uses their evidence link', () => {
    const section = SetupOverviewSection({
      errorCode: null,
      mode: 'runtime',
      readiness: readinessFixture([
        serviceFixture({
          evidenceHref: '/app-sessions?state=live',
          impactSummary: 'Customer records may be impaired.',
          runtimeStatus: 'DEGRADED',
          safeOperatorAction: 'Review affected app sessions and escalate database connectivity.',
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'needs-action',
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Degraded');
    expect(rendered).toContain('Review affected app sessions and escalate database connectivity.');
    expect(rendered).toContain('href="/app-sessions?state=live"');
    expect(rendered).toContain('View evidence');
  });

  it.each([
    ['CONFIGURATION_ONLY', false],
    ['CONNECTIVITY', true],
    ['FUNCTIONAL', true],
  ] as const)('labels %s evidence without turning configuration checks into runtime verification', (evidenceLevel, runtimeVerified) => {
    const rendered = renderToStaticMarkup(SetupOverviewSection({
      errorCode: null,
      mode: 'readiness',
      readiness: readinessFixture([
        serviceFixture({
          evidenceGap: !runtimeVerified,
          evidenceLevel,
          lastVerifiedAt: runtimeVerified ? '2026-08-12T03:05:00.000Z' : null,
          runtimeStatus: runtimeVerified ? 'HEALTHY' : 'NOT_MONITORED',
        }),
      ]),
      requestId: null,
      status: 200,
      view: 'active',
    }));

    if (runtimeVerified) {
      expect(rendered).toContain('Last runtime verification');
    } else {
      expect(rendered).toContain('Configuration checked');
      expect(rendered).not.toContain('Last runtime verification');
      expect(rendered).not.toContain('Last verified');
    }
  });
});

function readinessFixture(services: AdminExternalServiceStatus[]): AdminExternalReadiness {
  return {
    ok: true,
    currentStageOk: true,
    timestamp: '2026-08-12T03:00:00.000Z',
    generatedAt: '2026-08-12T03:00:01.000Z',
    launchProfile: 'CASH_ONLY',
    counts: {
      needsAction: services.filter((service) =>
        service.configurationStatus === 'INCOMPLETE' || ['DOWN', 'DEGRADED'].includes(service.runtimeStatus),
      ).length,
      launchBlockers: services.filter(
        (service) => service.requiredForCurrentLaunch && service.configurationStatus === 'INCOMPLETE',
      ).length,
      degraded: services.filter((service) => service.runtimeStatus === 'DEGRADED').length,
      unknown: services.filter((service) => service.runtimeStatus === 'UNKNOWN').length,
      notMonitored: services.filter((service) => service.runtimeStatus === 'NOT_MONITORED').length,
      evidenceGaps: services.filter((service) =>
        service.evidenceGap ?? (
          service.requiredForCurrentLaunch &&
          service.enabled &&
          ['UNKNOWN', 'NOT_MONITORED'].includes(service.runtimeStatus)
        ),
      ).length,
      deferred: services.filter((service) => service.configurationStatus === 'DEFERRED').length,
      required: services.filter((service) => service.requiredForCurrentLaunch).length,
      configurationReady: services.filter((service) =>
        service.requiredForCurrentLaunch && service.configurationStatus === 'CONFIGURED',
      ).length,
      runtimeVerified: services.filter((service) =>
        service.requiredForCurrentLaunch &&
        service.evidenceLevel !== 'CONFIGURATION_ONLY' &&
        service.lastVerifiedAt,
      ).length,
    },
    checks: [],
    services,
  };
}

function deferredServiceFixture(
  name: 'MoMo payments' | 'VNPay payments' | 'Referral app links',
): AdminExternalServiceStatus {
  const referral = name === 'Referral app links';
  return serviceFixture({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    category: referral ? 'referrals' : 'payments',
    launchScope: 'DEFERRED',
    configurationStatus: 'DEFERRED',
    enabled: false,
    requiredForCurrentLaunch: false,
    deferredReason: referral
      ? 'Public referral sharing and store routing are outside the current launch stage.'
      : name === 'VNPay payments'
        ? 'VNPay is intentionally disabled during the cash-only launch.'
        : 'Online payments are outside the current cash-only launch.',
    futureReadiness: 'NOT_STARTED',
    reentryChecks: [
      { label: referral ? 'Public referral base URL' : 'Merchant sandbox connection', status: 'PENDING' },
      { label: referral ? 'Customer Android store destination' : 'Public HTTPS callback', status: 'PENDING' },
      { label: referral ? 'Partner Android store destination' : 'Signed checkout smoke', status: 'PENDING' },
      { label: referral ? 'Android device-routing smoke' : 'Refund and reconciliation verification', status: 'PENDING' },
      ...(referral ? [{ label: 'Customer and Partner iOS destinations', status: 'FUTURE' as const }] : []),
    ],
    reviewTrigger: referral
      ? 'Before public referral sharing or an Android store release begins.'
      : name === 'VNPay payments'
        ? 'After the online-payment phase and public DNS/TLS are approved.'
        : 'When the online-payment phase is approved.',
    reviewedAt: null,
    platformScope: referral ? 'ANDROID_MVP' : null,
    relatedWorkspaceHref: referral
      ? '/referrals/customers#referral-link-readiness'
      : '/payments',
    escalationRoute: referral
      ? '/referrals/customers#referral-link-readiness'
      : '/payments',
  });
}

function serviceFixture(overrides: Partial<AdminExternalServiceStatus>): AdminExternalServiceStatus {
  return {
    id: 'service-1',
    name: 'Maps and geocoding',
    category: 'maps',
    launchScope: 'CURRENT_STAGE',
    enabled: true,
    requiredForCurrentLaunch: true,
    configurationStatus: 'CONFIGURED',
    configurationCheckedAt: '2026-08-12T03:00:00.000Z',
    runtimeStatus: 'NOT_MONITORED',
    probeType: 'CONFIG',
    evidenceLevel: 'CONFIGURATION_ONLY',
    lastVerifiedAt: null,
    verificationMethod: 'Configuration keys and formats only.',
    lastProbeAt: null,
    lastSuccessAt: null,
    failureSince: null,
    latencyMs: null,
    isStale: false,
    evidenceSummary: 'Configuration was checked.',
    impactSummary: 'No confirmed impact.',
    ownerTeam: 'Marketplace operations',
    evidenceHref: null,
    relatedWorkspaceHref: '/vietnam-overview',
    runbookHref: null,
    escalationRoute: '/vietnam-overview',
    runbookUrl: null,
    safeOperatorAction: 'No configuration action required.',
    evidenceGap: true,
    ...overrides,
  };
}
