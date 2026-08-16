import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import TaxPolicyPage from './page';

vi.mock('../../lib/admin-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/admin-api')>();
  return { ...original, adminGetResult: vi.fn() };
});
vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedAccess = vi.mocked(getCurrentAdminOperatorAccess);

function ok<T>(data: T) {
  return Promise.resolve({ data, ok: true as const, status: 200 });
}

function policy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    name: 'Vietnam withholding',
    status: 'ACTIVE',
    lifecycleStatus: 'ACTIVE',
    provenance: 'OPERATOR',
    effectiveFrom: '2026-08-01T17:00:00.000Z',
    effectiveTo: null,
    approvedAt: '2026-07-20T03:00:00.000Z',
    legalSourceTitle: 'Decree 01',
    legalSourceUrl: 'https://example.gov.vn/decree-01',
    promulgatedDate: '2026-07-01T17:00:00.000Z',
    taxSubject: 'Independent massage Partners',
    changeSummary: 'Approved production withholding policy.',
    revision: 1,
    rules: [{
      id: 'rule-1', policyVersionId: 'policy-1', scope: 'DEFAULT', rateBps: 500,
      fixedAmount: 0, active: true,
    }],
    ...overrides,
  };
}

function capabilities(overrides: Record<string, unknown> = {}) {
  return {
    actorId: 'admin-1',
    canDraft: true,
    canSubmit: false,
    canDecide: false,
    draftBlockers: [],
    submitBlockers: [{
      code: 'INDEPENDENT_CHECKER_UNAVAILABLE',
      message: 'Blocked — independent Finance approver unavailable.',
    }],
    decisionBlockers: [],
    generatedAt: '2026-08-14T08:00:00.000Z',
    independentCheckerCount: 0,
    source: 'PRODUCTION',
    warning: null,
    ...overrides,
  };
}

function workspaceSummary() {
  return {
    generatedAt: '2026-08-14T08:00:00.000Z',
    drafts: { needsAuthor: 1, awaitingChecker: 0, approved: 0, scheduled: 0 },
    history: { production: 1, testOrLegacy: 145 },
    nextScheduled: null,
  };
}

describe('TaxPolicyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAccess.mockResolvedValue({
      id: 'admin-1', fullName: 'Finance Operator', roles: ['ADMIN'], categories: ['FINANCE_TAX'],
    });
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });
  });

  it('loads only current and bounded draft data in the default view', async () => {
    await TaxPolicyPage({ searchParams: Promise.resolve({}) });
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toEqual([
      '/admin/tax-policy-versions?view=current&take=2',
      '/admin/tax-policy-versions?view=drafts&take=25&skip=0',
      '/admin/tax-policy-capabilities',
      '/admin/tax-policy-workspace-summary',
    ]);
  });

  it('renders the current policy read-only with Vietnam time and no direct update control', async () => {
    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({ view: 'current' }) }));
    expect(markup).toContain('Tax Policy Control');
    expect(markup).toContain('Current policy');
    expect(markup).toContain('2026-08-02 00:00 ICT');
    expect(markup).toContain('Clone as new draft');
    expect(markup).not.toContain('Save draft');
    expect(markup).not.toContain('approvalAdminId');
  });

  it('never shows a smoke policy as ready', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) {
        return ok({ items: [policy({ provenance: 'SMOKE_TEST' })], total: 1, skip: 0, take: 2 }) as never;
      }
      return ok(fallback) as never;
    });
    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Critical');
    expect(markup).toContain('Smoke test policy is controlling live withholding');
    expect(markup).not.toContain('Production policy, checker receipt');
  });

  it('loads a requested draft by exact id and renders the durable approval action', async () => {
    const draft = policy({ id: 'draft-1', status: 'DRAFT', lifecycleStatus: 'DRAFT', name: 'Draft 2027' });
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('view=drafts')) return ok({ items: [draft], total: 1, skip: 0, take: 25 }) as never;
      if (href.includes('id=draft-1')) return ok({ items: [draft], total: 1, skip: 0, take: 1 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'drafts', policyId: 'draft-1' }),
    }));
    expect(markup).toContain('Draft · Draft 2027');
    expect(markup).toContain('Submit for Finance review');
    expect(markup).toContain('Blocked — independent Finance approver unavailable');
    expect(markup).toContain('href="/finance-tax/finance-approvers"');
    expect(markup).toContain('disabled="" type="submit">Submit for Finance review');
    expect(markup).toContain('Save draft');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/tax-policy-versions?id=draft-1&take=1',
    );
  });

  it('uses service catalog input and server calculation results for current-vs-proposed preview', async () => {
    const draft = policy({ id: 'draft-1', status: 'DRAFT', lifecycleStatus: 'DRAFT', name: 'Draft 2027' });
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('view=drafts')) return ok({ items: [draft], total: 1, skip: 0, take: 25 }) as never;
      if (href.includes('id=draft-1')) return ok({ items: [draft], total: 1, skip: 0, take: 1 }) as never;
      if (href.includes('/admin/services/groups')) return ok([{
        key: 'massage', name: 'Massage', durationSummary: '60 min', activeOptionCount: 1,
        missingStandardDurations: [], minBasePrice: 500000, maxBasePrice: 500000, payoutRuleCount: 1,
        options: [{ id: 'service-60', name: 'Relaxing massage', durationMin: 60, basePrice: 500000, priceStep: 0, displayOrder: 1, active: true, publicationStatus: 'PUBLISHED' }],
      }]) as never;
      if (href.includes('/policy-1/simulation')) return ok({ amount: 25_000, currency: 'VND', grossAmount: 500_000, policyName: 'Current', policyVersionId: 'policy-1', serviceType: 'service-60', lines: [{ amount: 25_000, fixedAmount: 0, rateBps: 500, ruleId: 'rule-1', scope: 'DEFAULT', taxKind: 'PARTNER_WITHHOLDING_COMBINED' }] }) as never;
      if (href.includes('/draft-1/simulation')) return ok({ amount: 30_000, currency: 'VND', grossAmount: 500_000, policyName: 'Draft', policyVersionId: 'draft-1', serviceType: 'service-60', lines: [{ amount: 30_000, fixedAmount: 0, rateBps: 600, ruleId: 'rule-2', scope: 'SERVICE_TYPE', taxKind: 'PARTNER_WITHHOLDING_COMBINED' }] }) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'drafts', policyId: 'draft-1' }),
    }));

    expect(markup).toContain('production calculation contract');
    expect(markup).toContain('Relaxing massage · 60 min');
    expect(markup).toContain('30,000 VND');
    expect(markup).toContain('Specific service · 6% · Combined withholding');
    const proposedSimulationHref = mockedAdminGetResult.mock.calls
      .map(([href]) => href)
      .find((href) => href.startsWith('/admin/tax-policy-versions/draft-1/simulation?'));
    expect(proposedSimulationHref).toBeDefined();
    expect(proposedSimulationHref).toContain('serviceType=service-60');
    expect(proposedSimulationHref).toContain('grossAmount=500000');
  });

  it('does not silently fall back when an exact requested policy is missing', async () => {
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'drafts', policyId: 'missing-policy' }),
    }));
    expect(markup).toContain('Requested policy was not found');
    expect(markup).not.toContain('Draft · Vietnam withholding');
  });

  it('hides the production draft action when the signed-in operator capability is blocked', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) {
        return ok(capabilities({ canDraft: false, draftBlockers: [{ code: 'MFA_REQUIRED', message: 'MFA is required.' }] })) as never;
      }
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });
    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).not.toContain('Prepare production draft</a>');
    expect(markup).toContain('Open withholding records');
  });

  it('separates API failure from a true empty result', async () => {
    mockedAdminGetResult.mockImplementation((_href, fallback) =>
      Promise.resolve({ data: fallback, ok: false, status: 500, errorCode: 'UPSTREAM_FAILED' }) as never,
    );
    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Tax Policy data is incomplete');
    expect(markup).toContain('No missing records are being represented as zero');
  });

  it('uses exact paginated audit and labels integrity rows as a bounded sample', async () => {
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'integrity' }),
    }));
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/tax-policy-audit-logs?source=production&take=25&skip=0',
    );
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/tax-policy-integrity-summary',
    );
    expect(markup).toContain('30-day integrity summary');
    expect(markup).toContain('bounded 30-day evidence sample, not an all-period KPI');
    expect(markup).not.toContain('/admin/audit-logs?q=tax_');
  });

  it('loads and renders an exact audit event with provenance, copy, and recovery actions', async () => {
    const event = {
      id: 'audit-1',
      action: 'tax_policy.activated',
      target: 'tax_policy:policy-1',
      metadata: { policyVersionId: 'policy-1', payloadHash: 'hash-1' },
      policyProvenance: 'OPERATOR',
      createdAt: '2026-08-14T08:00:00.000Z',
      actor: { id: 'checker-1', fullName: 'Finance Checker' },
    };
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('eventId=audit-1')) return ok({ items: [event], total: 1, skip: 0, take: 1 }) as never;
      if (href.includes('/admin/tax-policy-audit-logs')) return ok({ items: [event], total: 1, skip: 0, take: 25 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'integrity', auditEventId: 'audit-1' }),
    }));
    expect(markup).toContain('id="tax-policy-audit-event"');
    expect(markup).toContain('Copy event ID');
    expect(markup).toContain('Production / operator');
    expect(markup).toContain('Back to filtered audit');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/tax-policy-audit-logs?eventId=audit-1&amp;source=production&amp;take=1&amp;skip=0'.replaceAll('&amp;', '&'),
    );
  });

  it('renders filtered integrity evidence with exact source and finance trace', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-integrity-records')) return ok({
        generatedAt: '2026-08-14T08:00:00.000Z',
        issue: 'amount-mismatch',
        items: [{
          bookingId: 'booking-1', classification: 'CURRENT_REGRESSION', createdAt: '2026-08-10T01:00:00.000Z',
          evidenceSource: 'PRODUCTION', grossAmount: 500000, id: 'earning-1', policyProvenance: 'OPERATOR',
          policyVersionId: 'policy-1', providerDisplayName: 'Lan Anh', providerProfileId: 'partner-1',
          taxLogWithholdingAmount: 20000, withholdingAmount: 25000,
        }],
        skip: 0, sort: 'newest', source: 'production', take: 25, total: 1,
      }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({
        view: 'integrity', issue: 'amount-mismatch', issueSort: 'newest', issueSource: 'production',
      }),
    }));
    expect(markup).toContain('Current production regression');
    expect(markup).toContain('Lan Anh');
    expect(markup).toContain('Partner / booking evidence');
    expect(markup).toContain('Partner <code>partner-1</code>');
    expect(markup).toContain('Booking <code>booking-1</code>');
    expect(markup).toContain('Earning <code>earning-1</code>');
    expect(markup).toContain('20,000 VND tax log');
    expect(markup).toContain('Open booking finance evidence');
    expect(markup).toContain('/bookings/booking-1#finance');
    expect(markup).not.toContain('/finance-tax/booking-settlements');
  });

  it('keeps the Tax Policy workspace on document scroll with horizontal-only data table overflow', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');
    const taxPolicyCss = css.slice(css.indexOf('.tax-policy-page'), css.indexOf('.payout-release-policy-card'));
    expect(taxPolicyCss).toContain('.tax-policy-page > .card');
    expect(taxPolicyCss).toContain('overflow: visible;');
    expect(taxPolicyCss).toContain('max-height: none;');
    expect(taxPolicyCss).toContain('overflow-y: visible;');
    expect(taxPolicyCss).toContain('.tax-policy-page .admin-data-table :is(th, td)');
    expect(taxPolicyCss).toContain('overflow-wrap: normal;');
    expect(taxPolicyCss).toContain('.tax-policy-history-section .admin-data-table code');
    expect(taxPolicyCss).toContain('overflow-wrap: anywhere;');
  });
});
