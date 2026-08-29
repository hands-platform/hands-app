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
    nonProductionScheduledCount: 0,
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
      '/admin/tax-policy-versions?view=drafts&take=25&skip=0&source=production',
      '/admin/tax-policy-capabilities',
      '/admin/tax-policy-workspace-summary',
    ]);
  });

  it('shows non-production scheduled work as a release blocker with a separate source entry', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) {
        return ok({ ...workspaceSummary(), nonProductionScheduledCount: 2 }) as never;
      }
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'drafts' }),
    }));

    expect(markup).toContain('Non-production scheduled policies block release');
    expect(markup).toContain('2 scheduled test or legacy policies');
    expect(markup).toContain('/tax-policy?view=drafts&amp;source=test-legacy');
    expect(markup).toContain('Production work');
    expect(markup).toContain('Test / legacy work');
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

  it('renders complete activation handoff evidence with copy and exact audit recovery', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy({
        revision: 4,
        payloadHash: 'hash-1',
        activationEvidence: {
          activationAuditAt: '2026-08-01T17:00:00.000Z',
          activationAuditId: 'audit/activation-1',
          activatedAt: '2026-08-01T17:00:00.000Z',
          approvalRequestId: 'approval-1',
          approvedAt: '2026-07-20T03:00:00.000Z',
          checker: { id: 'checker-1', fullName: 'Finance Checker', email: 'checker@example.com' },
          maker: { id: 'maker-1', fullName: 'Policy Maker', email: 'maker@example.com' },
          payloadHash: 'hash-1',
          policyVersionId: 'policy-1',
          revision: 4,
        },
      })], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Activation evidence');
    expect(markup).toContain('Copy activation evidence');
    expect(markup).toContain('<dt>Content hash</dt><dd><code>hash-1</code>');
    expect(markup).toContain('approval-1');
    expect(markup).toContain('Policy Maker · maker-1');
    expect(markup).toContain('Finance Checker · checker-1');
    expect(markup).toContain('auditEventId=audit%2Factivation-1#tax-policy-audit-event');
    expect(markup).not.toContain('checker@example.com');
  });

  it('does not hide missing activation evidence fields', async () => {
    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Activation evidence');
    expect(markup).toContain('<dt>Approval request ID</dt><dd><code>Missing</code>');
    expect(markup).toContain('<dt>Activation audit ID</dt><dd>Missing</dd>');
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
    expect(markup).toContain('Candidate provenance');
    expect(markup).toContain('Smoke test');
    expect(markup).toContain('No predecessor recorded');
    expect(markup).not.toContain('New production source');
    expect(markup).not.toContain('Production policy, checker receipt');
  });

  it('separates a clean operator candidate from its retained smoke predecessor', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) {
        return ok({
          items: [policy({
            supersedesPolicyVersion: {
              id: 'smoke-policy-1',
              name: 'Retained smoke baseline',
              provenance: 'SMOKE_TEST',
            },
          })],
          total: 1,
          skip: 0,
          take: 2,
        }) as never;
      }
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Candidate provenance');
    expect(markup).toContain('<dt>Candidate provenance</dt><dd>Production</dd>');
    expect(markup).toContain('Superseded source lineage');
    expect(markup).toContain('Retained smoke baseline · Smoke test');
  });

  it('documents the production candidate and historical predecessor as independent invariants', () => {
    const runbook = readFileSync(
      new URL('../../../../docs/runbooks/tax-policy-smoke-active-replacement.md', import.meta.url),
      'utf8',
    );
    expect(runbook).toContain('The candidate provenance must be `OPERATOR`');
    expect(runbook).toContain('A historical predecessor may have non-production provenance');
    expect(runbook).not.toContain('the source lineage is non-production');
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

  it('keeps draft inputs closed until production write capability is restored', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) {
        return ok(capabilities({
          canDraft: false,
          draftBlockers: [{ code: 'MFA_REQUIRED', message: 'Complete MFA before creating a production draft.' }],
        })) as never;
      }
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'drafts' }),
    }));

    expect(markup).toContain('Production draft unavailable');
    expect(markup).toContain('Complete MFA before creating a production draft.');
    expect(markup).toContain('No draft fields are opened or preserved');
    expect(markup).toContain('Re-check capability');
    expect(markup).not.toContain('name="legalSourceUrl"');
    expect(markup).not.toContain('name="effectiveFrom"');
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
      '/admin/tax-policy-integrity-summary?source=production',
    );
    expect(markup).toContain('30-day integrity summary');
    expect(markup).toContain('bounded 30-day evidence sample, not an all-period KPI');
    expect(markup).not.toContain('/admin/audit-logs?q=tax_');
  });

  it('keeps zero integrity metrics compact and deep-links only actionable evidence', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-integrity-summary')) {
        return ok({
          generatedAt: '2026-08-14T08:00:00.000Z',
          range: '30d',
          rangeStart: '2026-07-15T08:00:00.000Z',
          source: 'production',
          sourceTotals: { production: 300, test: 100, legacy: 5, unknown: 13 },
          total: 300,
          recordIntegrity: {
            healthy: 287, amountMismatch: 0, missingTaxLog: 13, missingSnapshot: 0,
            oldestAmountMismatch: null, oldestMissingTaxLog: '2026-08-01T01:00:00.000Z', oldestMissingSnapshot: null,
          },
          taxApplicability: {
            noActivePolicy: 0, noApprovedTaxProfile: 0, noMatchingRule: 0,
            oldestNoActivePolicy: null, oldestNoApprovedTaxProfile: null, oldestNoMatchingRule: null,
          },
        }) as never;
      }
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'integrity' }),
    }));

    expect(markup).toContain('13 earning(s) have unknown provenance');
    expect(markup).toContain('issue=missing-tax-log&amp;issueSource=production&amp;issuePage=1#tax-policy-integrity-queue');
    expect(markup.match(/Review exact evidence/gu)).toHaveLength(1);
    expect(markup.match(/Owner not assigned/gu)).toHaveLength(1);
    expect(markup).toContain('0 / 300 · no matching 30-day evidence');
  });

  it('keeps Integrity usable while an older API response omits additive source fields', async () => {
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('/admin/tax-policy-integrity-summary')) {
        return ok({
          generatedAt: '2026-08-14T08:00:00.000Z',
          range: '30d',
          rangeStart: '2026-07-15T08:00:00.000Z',
          total: 55,
          recordIntegrity: {
            healthy: 42, amountMismatch: 0, missingTaxLog: 13, missingSnapshot: 0,
            oldestAmountMismatch: null, oldestMissingTaxLog: '2026-08-01T01:00:00.000Z', oldestMissingSnapshot: null,
          },
          taxApplicability: {
            noActivePolicy: 0, noApprovedTaxProfile: 0, noMatchingRule: 0,
            oldestNoActivePolicy: null, oldestNoApprovedTaxProfile: null, oldestNoMatchingRule: null,
          },
        }) as never;
      }
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'integrity', issueSource: 'production' }),
    }));
    expect(markup).toContain('Source-classified integrity unavailable');
    expect(markup).toContain('No all-source count is being represented as production');
    expect(markup).not.toContain('Production · 55');
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

  it('offers audit action presets while preserving exact action input', async () => {
    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'integrity', auditAction: 'tax_policy.activated' }),
    }));
    expect(markup).toContain('Action preset or exact action');
    expect(markup).toContain('list="tax-policy-audit-action-presets"');
    expect(markup).toContain('<option value="tax_policy.activation_blocked"></option>');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/tax-policy-audit-logs?source=production&amp;take=25&amp;skip=0&amp;action=tax_policy.activated'.replaceAll('&amp;', '&'),
    );
  });

  it('truncates dense test history IDs visually while retaining full accessible copy', async () => {
    const fullId = 'smoke-tax-policy-2026-08-28-run-000000000001';
    mockedAdminGetResult.mockImplementation((href, fallback) => {
      if (href.includes('view=current')) return ok({ items: [policy()], total: 1, skip: 0, take: 2 }) as never;
      if (href.includes('view=history')) return ok({
        items: [policy({ id: fullId, provenance: 'SMOKE_TEST', lifecycleStatus: 'SUPERSEDED' })],
        total: 1,
        skip: 0,
        take: 25,
      }) as never;
      if (href.includes('/admin/tax-policy-capabilities')) return ok(capabilities()) as never;
      if (href.includes('/admin/tax-policy-workspace-summary')) return ok(workspaceSummary()) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await TaxPolicyPage({
      searchParams: Promise.resolve({ view: 'history', source: 'test-legacy' }),
    }));
    expect(markup).toContain('smoke-tax-po…0000000001');
    expect(markup).toContain(`title="${fullId}"`);
    expect(markup).toContain(`aria-label="Copy full policy ID ${fullId}"`);
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
