import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import {
  adminGetResult,
  type AdminBooking,
  type AdminOperationalPolicySetting,
} from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import OperationsPolicyPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetAccess = vi.mocked(getCurrentAdminOperatorAccess);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('OperationsPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
    mockedGetAccess.mockReset();
    mockedGetAccess.mockResolvedValue(null);
  });

  it('loads only settings and renders the operator group workflow by default', async () => {
    mockSettings(policySettings());

    const markup = renderToStaticMarkup(await OperationsPolicyPage({ searchParams: Promise.resolve({}) }));

    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/operational-policy', [], {
      freshness: 'aggregate',
      revalidateSeconds: 30,
      tags: ['operations-policy'],
    });
    expect(markup).toContain('Policy command strip');
    expect(markup).toContain('Workspace');
    expect(markup).toContain('Shift &amp; Queue SLA');
    expect(markup).toContain('Matching &amp; Availability');
    expect(markup).toContain('Current value');
    expect(markup).toContain('Last changed');
    expect(markup).toContain('Review change');
    expect(markup).not.toContain('Recommended value</span>');
    expect(markup).not.toContain('Operating impact</span>');
    expect(markup).not.toContain('Saved override');
    expect(markup).not.toContain('Needs owner choice');
  });

  it('separates saved values, provenance, and current-deviation counts', async () => {
    mockSettings([
      policy({
        key: 'matching.provider_response_window_minutes',
        auditSource: 'operator',
        updatedAt: '2026-08-11T00:00:00.000Z',
        value: 10,
      }),
      policy({
        key: 'matching.marketplace_partner_radius_meters',
        label: 'Marketplace Partner radius',
        recommendedValue: 10000,
        unit: 'meters',
        value: 12000,
      }),
    ]);

    const markup = renderToStaticMarkup(await OperationsPolicyPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Current deviations</span><strong>1</strong>');
    expect(markup).toContain('Saved values</span><strong>1</strong>');
    expect(markup).toContain('Operator 1 · Smoke 0 · Legacy/unknown 0');
    expect(markup).toContain('Operator changed');
    expect(markup).toContain('Restored to baseline');
    expect(markup).toContain('Live · baseline aligned');
    expect(markup).toContain('Recommended: 10 km');
  });

  it('filters policy rows by lifecycle without hiding lifecycle counts', async () => {
    mockSettings([
      policy({ key: 'matching.provider_response_window_minutes', lifecycle: 'live' }),
      policy({ key: 'matching.marketplace_open_mode', label: 'Marketplace open mode', lifecycle: 'locked' }),
    ]);

    const markup = renderToStaticMarkup(await OperationsPolicyPage({
      searchParams: Promise.resolve({ lifecycle: 'locked' }),
    }));

    expect(markup).toContain('Marketplace open mode');
    expect(markup).not.toContain('First-pick response window</strong>');
    expect(markup).toContain('name="lifecycle"');
    expect(markup).toContain('Locked</span><strong>1</strong>');
  });

  it('opens one focused change form and keeps the deep-link anchor', async () => {
    mockSettings([policy({ key: 'matching.provider_response_window_minutes' })]);

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ edit: 'matching.provider_response_window_minutes' }),
      }),
    );

    expect(markup).toContain('operations-policy-editor');
    expect(markup).toContain('Change First-pick response window');
    expect(markup).toContain('id="policy-matching-provider-response-window-minutes"');
    expect((markup.match(/Save policy change/g) ?? [])).toHaveLength(1);
  });

  it('fails closed when a selected policy has no lifecycle contract', async () => {
    mockSettings([policy({ key: 'matching.provider_response_window_minutes', lifecycle: undefined })]);

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ edit: 'matching.provider_response_window_minutes' }),
      }),
    );

    expect(markup).toContain('Unknown · editing disabled');
    expect(markup).toContain('Lifecycle metadata is missing or unsupported');
    expect(markup).not.toContain('Save policy change');
  });

  it('disables live policy writes when operator audit evidence is unavailable', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: href === '/admin/operational-policy'
        ? [policy({ key: 'matching.provider_response_window_minutes' })]
        : fallback,
      ok: href !== '/admin/operational-policy/audit?source=operator&take=1',
      status: href === '/admin/operational-policy/audit?source=operator&take=1' ? 503 : 200,
    }));

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ edit: 'matching.provider_response_window_minutes' }),
      }),
    );

    expect(markup).toContain('Policy audit is unavailable');
    expect(markup).toContain('Writes disabled');
    expect(markup).toContain('System Health');
    expect(markup).not.toContain('Save policy change');
  });

  it('does not turn a settings API failure into an aligned or empty state', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: [], ok: false, status: 503 });

    const markup = renderToStaticMarkup(await OperationsPolicyPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Operations Policy is not ready for decisions');
    expect(markup).toContain('could not be loaded');
    expect(markup).not.toContain('All launch baselines aligned');
    expect(markup).not.toContain('No policies loaded');
  });

  it('normalizes details=all and legacy policy editor links to the grouped Policies workspace', async () => {
    mockSettings(policySettings());

    const allMarkup = renderToStaticMarkup(
      await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'all' }) }),
    );
    const matchingMarkup = renderToStaticMarkup(
      await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'matching' }) }),
    );
    const decisionMarkup = renderToStaticMarkup(
      await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'decisions' }) }),
    );

    expect(allMarkup).toContain('Policy command strip');
    expect(allMarkup).not.toContain('Choose workspace');
    expect(matchingMarkup).toContain('Matching &amp; Availability');
    expect(matchingMarkup).not.toContain('aria-label="Shift &amp; Queue SLA policies"');
    expect(decisionMarkup).toContain('Exceptions &amp; Evidence');
    expect(decisionMarkup).not.toContain('planning');
  });

  it('shows observed source provenance, demo warning, and blocking supply state', async () => {
    allowDiagnostics();
    mockRouteData({
      '/admin/operational-policy': policySettings(),
      '/admin/bookings?take=20': [],
      '/admin/operations-policy/providers?take=30': [],
    });

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ details: 'matching', matching: 'supply' }),
      }),
    );

    expect(mockedAdminGetResult).toHaveBeenCalledTimes(3);
    expect(markup).toContain('Observed');
    expect(markup).toContain('bounded Partner records');
    expect(markup).toContain('Refresh evidence');
    expect(markup).toContain('Demo reference');
    expect(markup).toContain('Supply is not ready');
    expect(markup).toContain('0 usable Partners');
  });

  it('loads the server preview and keeps historical evidence independent from current supply', async () => {
    allowDiagnostics();
    mockRouteData({
      '/admin/operational-policy': policySettings(),
      '/admin/bookings?take=20': [],
      '/admin/operations-policy/matching-preview': {
        candidates: [],
        checkedAt: '2026-08-14T03:00:00.000Z',
        evidence: {
          newestAt: null,
          oldestAt: null,
          returnedCandidates: 0,
          totalEvaluated: 12,
          truncated: false,
        },
        primaryBlocker: {
          actionHref: '/bookings?view=matching',
          actionLabel: 'Open matching bookings',
          code: 'NO_ACTIONABLE_BOOKING',
          detail: 'No actionable booking coordinate is available.',
          title: 'No production booking reference',
        },
        reference: {
          bookingId: null,
          bookingStatus: null,
          kind: 'DEMO',
          label: 'Ho Chi Minh City demo reference',
          lat: 10.7769,
          lng: 106.7009,
          observedAt: null,
          serviceId: null,
        },
        safety: { dryRun: true, mutationsPerformed: false },
        stages: [],
        status: 'DEMO_PREVIEW_ONLY',
      },
    });

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ details: 'matching', matching: 'simulation' }),
      }),
    );

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/operations-policy/matching-preview',
      null,
    );
    expect(mockedAdminGetResult).not.toHaveBeenCalledWith(
      '/admin/operations-policy/providers?take=30',
      [],
    );
    expect(markup).toContain('Current dispatch preview');
    expect(markup).toContain('Demo preview only');
    expect(markup).toContain('Historical policy evidence');
    expect(markup).toContain('No historical booking evidence');
    expect(markup).not.toContain('Change impact preview');
  });

  it('fails closed for an operator with only a narrower Developer diagnostic category', async () => {
    mockedGetAccess.mockResolvedValue({
      categories: ['DEVELOPER_HEALTH'],
      email: 'health@example.com',
      fullName: 'Health operator',
      id: 'health-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ details: 'matching', matching: 'simulation' }),
      }),
    );

    expect(markup).toContain('403 · Access denied');
    expect(markup).not.toContain('Current dispatch preview');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('renders all historical evidence sections when the current production preview is blocked', async () => {
    allowDiagnostics();
    mockRouteData({
      '/admin/operational-policy': policySettings(),
      '/admin/bookings?take=20': [historicalBooking()],
      '/admin/operations-policy/matching-preview': {
        candidates: [],
        checkedAt: '2026-08-14T03:00:00.000Z',
        evidence: {
          newestAt: '2026-08-14T02:30:00.000Z',
          oldestAt: '2026-08-14T01:30:00.000Z',
          returnedCandidates: 0,
          totalEvaluated: 12,
          truncated: false,
        },
        primaryBlocker: {
          actionHref: '/partner-controls?details=controls&review=location',
          actionLabel: 'Review Partner locations',
          code: 'fresh-location',
          detail: '12 Partner records were excluded at this production gate.',
          title: 'Fresh dispatch location blocks dispatch',
        },
        reference: {
          bookingId: 'booking-history-1',
          bookingStatus: 'OPEN_MATCHING',
          kind: 'BOOKING',
          label: 'Booking booking-history-1',
          lat: 10.7769,
          lng: 106.7009,
          observedAt: '2026-08-14T02:45:00.000Z',
          serviceId: 'service-1',
        },
        safety: { dryRun: true, mutationsPerformed: false },
        stages: [{
          actionHref: '/partner-controls?details=controls&review=location',
          actionLabel: 'Review Partner locations',
          code: 'fresh-location',
          excludedCount: 12,
          label: 'Fresh dispatch location',
          passedCount: 0,
        }],
        status: 'BLOCKED_NO_ELIGIBLE_SUPPLY',
      },
    });

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ details: 'matching', matching: 'simulation' }),
      }),
    );

    expect(markup).toContain('Blocked · no eligible Partner supply');
    expect(markup).toContain('Historical policy evidence');
    expect(markup).toContain('Policy change impact');
    expect(markup).toContain('Policy impact drill-down');
    expect(markup).toContain('Policy outcome effect');
  });

  it('shows operator audit by default and server-verified smoke only through its filter', async () => {
    allowDiagnostics();
    mockRouteData({
      '/admin/operational-policy/audit?source=operator&take=8': {
        items: [auditLog('operator-row', { before: 10, after: 12, source: 'operator' })],
        nextCursor: null,
        source: 'operator',
      },
      '/admin/operational-policy/audit?source=automated_smoke&take=8': {
        items: [auditLog('smoke-row', {
          before: 12,
          after: 10,
          environment: 'test',
          restoration: true,
          runId: 'run-123456',
          source: 'automated_smoke',
        })],
        nextCursor: null,
        source: 'automated_smoke',
      },
    });

    const operatorMarkup = renderToStaticMarkup(
      await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'audit' }) }),
    );
    const smokeMarkup = renderToStaticMarkup(
      await OperationsPolicyPage({
        searchParams: Promise.resolve({ audit: 'automated_smoke', details: 'audit' }),
      }),
    );

    expect(operatorMarkup).toContain('Ops Lead');
    expect(operatorMarkup).toContain('>10<');
    expect(operatorMarkup).toContain('>12<');
    expect(operatorMarkup).not.toContain('Smoke restore');
    expect(smokeMarkup).toContain('Smoke restore');
    expect(smokeMarkup).toContain('run-1234');
    expect(smokeMarkup).not.toContain('Ops Lead');
  });

  it('distinguishes policy audit access denial from an API failure or empty history', async () => {
    allowDiagnostics();
    mockedAdminGetResult.mockResolvedValue({
      data: { items: [], nextCursor: null, source: 'operator' },
      ok: false,
      status: 403,
    });

    const markup = renderToStaticMarkup(
      await OperationsPolicyPage({ searchParams: Promise.resolve({ details: 'audit' }) }),
    );

    expect(markup).toContain('Policy audit access denied');
    expect(markup).toContain('403 · Access denied');
    expect(markup).not.toContain('No authenticated operator policy changes are recorded.');
  });

  it('keeps the desktop policy contract compact and free of the old six-column audit layout', () => {
    expect(pageSource).not.toContain("'Recommended value',");
    expect(pageSource).not.toContain("'Operating impact',");
    expect(pageSource).not.toContain('saved override(s)');
    expect(pageSource).not.toContain('control choice(s)');
    expect(globalCss).toContain('.operations-policy-list-row');
    expect(globalCss).toContain('grid-template-columns: minmax(250px, 2.1fr)');
    expect(globalCss).toContain('.operations-policy-page > .card');
    expect(globalCss).toContain(".operations-policy-workspace-nav a[aria-current='page']");
    expect(globalCss).toContain('box-shadow: inset 0 -2px 0 rgb(var(--admin-primary-channel));');
    expect(globalCss).toContain('max-height: none;');
    expect(globalCss).toContain('.operations-policy-page .admin-table-scroll .operations-policy-audit-table.admin-data-table');
    expect(globalCss).toContain('min-width: 1080px;');
    expect(globalCss).toContain('.operations-policy-audit-evidence');
    expect(globalCss).toContain('.operations-policy-audit-change > strong');
    expect(globalCss).toContain('-webkit-line-clamp: 1');
    expect(globalCss).not.toContain('.operations-policy-audit-table tbody tr {\n    height: 104px;');
    expect(globalCss).not.toContain('.operations-policy-audit-table th:nth-child(6)');
    expect(globalCss).toContain('.operations-policy-audit-sources a.is-active');
    expect(globalCss).toContain('.audit-scope-context');
    expect(globalCss).not.toContain('operations-policy-page > .card {\n  box-shadow: var(--admin-shadow-md);\n  max-height: min');
  });
});

function mockSettings(settings: AdminOperationalPolicySetting[]) {
  mockRouteData({ '/admin/operational-policy': settings });
}

function mockRouteData(dataByHref: Record<string, unknown>) {
  mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
    data: (dataByHref[href] ?? fallback) as never,
    ok: true,
    status: 200,
  }));
}

function allowDiagnostics() {
  mockedGetAccess.mockResolvedValue({
    categories: [],
    email: 'master@example.com',
    fullName: 'Master Admin',
    id: 'master-1',
    phone: null,
    roles: ['ADMIN', 'MASTER_ADMIN'],
    updatedAt: null,
  });
}

function policySettings() {
  return [
    policy({
      category: 'Command center',
      key: 'command.start_shift.matching_delays_sla_minutes',
      label: 'Matching delay review SLA',
      min: 5,
      max: 240,
      unit: 'minutes',
      value: 15,
      recommendedValue: 15,
    }),
    policy({ key: 'matching.provider_response_window_minutes' }),
    policy({
      category: 'Decision',
      key: 'cancellation.after_match_policy',
      label: 'Customer cancellation after match',
      value: 'ADMIN_REVIEW_FOR_MVP',
      recommendedValue: 'ADMIN_REVIEW_FOR_MVP',
    }),
  ];
}

function policy(overrides: Partial<AdminOperationalPolicySetting>): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    description: 'Controls the current operating policy.',
    enforced: true,
    lifecycle: 'live',
    risk: 'low',
    blastRadius: 'Current operations',
    consumerContract: {
      applicationScope: 'Current operations',
      consumerIds: ['service#consumer'],
      fallbackBehavior: 'Use the default value.',
      integrationTestIds: ['service.spec.ts'],
    },
    key: 'matching.provider_response_window_minutes',
    label: 'First-pick response window',
    max: 30,
    min: 3,
    recommendedValue: 10,
    unit: 'minutes',
    value: 10,
    ...overrides,
  };
}

function auditLog(id: string, metadata: Record<string, unknown>) {
  return {
    action: 'operational_policy.update',
    actor: id === 'operator-row' ? { fullName: 'Ops Lead' } : { fullName: 'HANDS Smoke Admin' },
    createdAt: '2026-08-11T02:00:00.000Z',
    id,
    metadata: {
      enforced: true,
      key: 'matching.provider_response_window_minutes',
      reason: 'Reviewed policy evidence before change',
      ...metadata,
    },
    target: 'operational_policy:matching.provider_response_window_minutes',
  };
}

function historicalBooking(): AdminBooking {
  return {
    createdAt: '2026-08-14T02:45:00.000Z',
    expiresAt: '2026-08-14T03:10:00.000Z',
    id: 'booking-history-1',
    metadata: {
      matchingPolicy: {
        backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
        backupProviderInvitationLimit: 5,
        backupProviderLocationMaxAgeMinutes: 90,
        backupProviderRadiusMeters: 10000,
        preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        providerResponseWindowMinutes: 10,
        travelBufferMinutes: 30,
      },
    },
    participants: [],
    services: [],
    status: 'OPEN_MATCHING',
  } as unknown as AdminBooking;
}
