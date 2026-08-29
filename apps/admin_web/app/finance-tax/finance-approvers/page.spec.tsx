import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import FinanceApproversPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('FinanceApproversPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminGetResult.mockImplementation(async (path: string) => {
      if (path.endsWith('/summary')) return { data: governanceSummary(), ok: true, status: 200 } as never;
      if (path.includes('/operators')) return { data: operatorPage(), ok: true, status: 200 } as never;
      if (path.includes('/requests')) return { data: requestPage(), ok: true, status: 200 } as never;
      if (path.includes('/history')) return { data: historyPage(), ok: true, status: 200 } as never;
      return { data: null, ok: false, status: 500 } as never;
    });
  });

  it('renders server-derived blocked readiness and the four URL-backed governance views', async () => {
    const markup = renderToStaticMarkup(await FinanceApproversPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Finance approval access');
    expect(markup).toContain('Independent approval readiness');
    expect(markup).toContain('Blocked');
    expect(markup).toContain('1 / 2 required');
    expect(markup).not.toContain('Primary approval coverage');
    expect(markup).toContain('Independent backup available');
    expect(markup).toContain('Production pending requests');
    expect(markup).toContain('Production ready candidates');
    expect(markup).toContain('Unknown high-privilege accounts');
    expect(markup).toContain('Release-blocking accounts');
    expect(markup).toContain('Finance category checker coverage');
    expect(markup).toContain('Review unknown accounts');
    expect(markup).toContain('Active approvers');
    expect(markup).toContain('Production ready candidates');
    expect(markup).toContain('Pending requests');
    expect(markup).toContain('History');
    expect(markup).toContain('You');
    expect(markup).not.toContain('Approver coverage');
    expect(markup).not.toContain('Protected');
    expect(markup).not.toContain('admin(s)');
  });

  it('opens one access review drawer with policy preflight and no row-level reason forms', async () => {
    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({ dialog: 'review', targetUserId: 'candidate-1', view: 'eligible' }),
    }));

    expect(markup).toContain('Review Candidate Admin&#x27;s access');
    expect(markup).toContain('Target and proposed access');
    expect(markup).toContain('Policy preflight');
    expect(markup).toContain('Impact and reassignment');
    expect(markup).toContain('Request summary');
    expect(markup).toContain('Reason for changing Candidate Admin&#x27;s access');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain('Submit access request');
    expect(markup.match(/name="operatorReason"/g)).toHaveLength(1);
    expect(markup).not.toContain('Grant approver');
    expect(markup).not.toContain('Revoke approver');
  });

  it('blocks the same maker from deciding a pending request before a form is rendered', async () => {
    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({ dialog: 'decision', requestId: 'request-1', view: 'pending' }),
    }));

    expect(markup).toContain('Independent decision unavailable');
    expect(markup).toContain('The requester or target cannot decide this access request');
    expect(markup).not.toContain('Approve and execute');
  });

  it('shows requested and current permission versions while keeping stale approval disabled', async () => {
    mockedAdminGetResult.mockImplementation(async (path: string) => {
      if (path.endsWith('/summary')) {
        return {
          data: {
            ...governanceSummary(),
            currentActor: { ...governanceSummary().currentActor, id: 'checker-1' },
          },
          ok: true,
          status: 200,
        } as never;
      }
      if (path.includes('/requests')) {
        const request = requestRecord();
        return {
          data: {
            items: [
              {
                ...request,
                targetPolicy: {
                  ...request.targetPolicy,
                  permissionVersion: 4,
                  permissionVersionMatches: false,
                },
              },
            ],
            skip: 0,
            take: 25,
            totalCount: 1,
          },
          ok: true,
          status: 200,
        } as never;
      }
      return { data: null, ok: false, status: 500 } as never;
    });

    const markup = renderToStaticMarkup(
      await FinanceApproversPage({
        searchParams: Promise.resolve({ dialog: 'decision', requestId: 'request-1', view: 'pending' }),
      }),
    );

    expect(markup).toContain('Requested permission version');
    expect(markup).toContain('Current permission version');
    expect(markup).toContain('Permission changed since request');
    expect(markup).toContain('Approve unavailable');
    expect(markup).toContain('Reject and close request');
    expect(markup).toMatch(/value="APPROVE"[^>]*disabled=""/u);
  });

  it('keeps pending drawer return focus on the exact filtered request link', async () => {
    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({
        dialog: 'decision',
        requestId: 'request-1',
        source: 'test',
        view: 'pending',
      }),
    }));

    expect(markup).toContain(
      '/finance-tax/finance-approvers?view=pending&amp;source=test&amp;dialog=decision&amp;requestId=request-1',
    );
    expect(markup).not.toContain('accountStatus=active&amp;source=test&amp;dialog=decision');
  });

  it('separates API failure from an actual empty list and never infers readiness', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: null, ok: false, requestId: 'req-500', status: 500 });
    const markup = renderToStaticMarkup(await FinanceApproversPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Unknown');
    expect(markup).toContain('No readiness decision was made');
    expect(markup).toContain('This is not an empty result');
    expect(markup).toContain('Request ID: req-500');
    expect(markup).not.toContain('0 / 2 required');
  });

  it('shows exact request history without broad query or page-view copy', async () => {
    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({ view: 'history' }),
    }));

    expect(markup).toContain('Exact role history');
    expect(markup).toContain('Page views are excluded');
    expect(markup).toContain('Requested');
    expect(markup).toContain('View exact audit');
    expect(markup).toContain('targetPrefix=finance_approver_request%3Arequest-1');
    expect(markup).toContain('Legacy attestation lifecycle');
    expect(markup).toContain('Current');
    expect(markup).toContain('Expires 8 Nov 2026');
    expect(markup).toContain('targetPrefix=finance_approver_attestation%3Acandidate-1%3Aowner-review-1');
    expect(markup).not.toContain('>View role history</a>');
    expect(markup).not.toContain('q=finance_approver');
  });

  it('uses a compact readiness strip and one consolidated candidate empty state', async () => {
    mockedAdminGetResult.mockImplementation(async (path: string) => {
      if (path.endsWith('/summary')) return { data: governanceSummary(), ok: true, status: 200 } as never;
      if (path.includes('/operators')) {
        return { data: { items: [], skip: 0, take: 25, totalCount: 0 }, ok: true, status: 200 } as never;
      }
      return { data: null, ok: false, status: 500 } as never;
    });

    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({ view: 'eligible' }),
    }));

    expect(markup).toContain('finance-approver-readiness-compact');
    expect(markup).toContain('Selected source:');
    expect(markup).toContain('No operators are available in this scope');
    expect(markup.match(/<h2>Eligible operators<\/h2>/gu)).toHaveLength(1);
    expect(markup).not.toContain('<h2>Ready for request</h2>');
    expect(markup).not.toContain('<h2>Needs verification</h2>');
  });

  it('loads ready and verification candidate groups from separate server-policy queries', async () => {
    await FinanceApproversPage({ searchParams: Promise.resolve({ view: 'eligible' }) });

    const paths = mockedAdminGetResult.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.includes('/operators?') && path.includes('readiness=ready'))).toBe(true);
    expect(paths.some((path) => path.includes('/operators?') && path.includes('readiness=needs'))).toBe(true);
    expect(paths.filter((path) => path.includes('/operators?'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('status=production'),
        expect.stringContaining('status=production'),
      ]),
    );
  });

  it('uses permission-aware header copy and truthful production scope labels', async () => {
    mockedAdminGetResult.mockImplementation(async (path: string) => {
      if (path.endsWith('/summary')) {
        return {
          data: {
            ...governanceSummary(),
            currentActor: { ...governanceSummary().currentActor, canRequest: false },
          },
          ok: true,
          status: 200,
        } as never;
      }
      if (path.includes('/operators')) return { data: operatorPage(), ok: true, status: 200 } as never;
      return { data: null, ok: false, status: 500 } as never;
    });

    const markup = renderToStaticMarkup(await FinanceApproversPage({
      searchParams: Promise.resolve({ view: 'eligible' }),
    }));

    expect(markup).toContain('View governance requirements');
    expect(markup).toContain('Open Admin Operators');
    expect(markup).toContain('Production and legacy');
    expect(markup).toContain('Eligible operators');
    expect(markup).not.toContain('Verified production');
  });

  it('defaults pending work to verified production sources', async () => {
    await FinanceApproversPage({ searchParams: Promise.resolve({ view: 'pending' }) });

    expect(mockedAdminGetResult.mock.calls.some(([path]) =>
      path.includes('/requests?') && path.includes('source=production'),
    )).toBe(true);
  });

  it('uses result-aware APIs, shared drawer atoms, and request actions rather than direct role mutation', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/page.tsx'), 'utf8');
    const actionSource = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/actions.ts'), 'utf8');
    const drawerSource = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/finance-approver-drawer-shell.tsx'), 'utf8');
    const formSource = readFileSync(join(process.cwd(), 'app/finance-tax/finance-approvers/finance-approver-action-form.tsx'), 'utf8');
    const globalStyles = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(pageSource).toContain('adminGetResult');
    expect(pageSource).not.toContain('adminGet<');
    expect(pageSource).toContain('AdminSegmentedControl');
    expect(drawerSource).toContain('AdminDrawerSurface');
    expect(drawerSource).toContain('useAdminModalFocus');
    expect(drawerSource).toContain('new MutationObserver');
    expect(drawerSource).toContain('focus({ preventScroll: true })');
    expect(drawerSource).toContain("window.addEventListener('beforeunload'");
    expect(drawerSource).toContain('FINANCE_APPROVER_FORM_SUCCESS_EVENT');
    expect(drawerSource).not.toContain('onSubmitCapture');
    expect(formSource).toContain('FINANCE_APPROVER_REQUEST_CLOSE_EVENT');
    expect(formSource).toContain('window.dispatchEvent(new Event(FINANCE_APPROVER_FORM_SUCCESS_EVENT))');
    expect(actionSource).toContain('/admin/finance-approver-governance/requests');
    expect(actionSource).not.toContain('/admin/users/${encodeURIComponent(userId)}/finance-approver');
    expect(pageSource).not.toContain('appSessions');
    expect(pageSource).not.toContain('pushDevices');
    expect(pageSource).toContain('className="finance-approver-source-badge"');
    expect(globalStyles).toContain('.finance-approver-drawer .finance-approver-source-badge .pill');
    expect(globalStyles).toContain('.calendar-drawer.finance-approver-drawer');
    expect(globalStyles).toContain('.finance-approver-drawer > div');
    expect(globalStyles).toContain('.finance-approver-drawer .operator-access-reauth-form');
    expect(globalStyles).toContain('overflow-wrap: anywhere');
  });
});

function governanceSummary() {
  return {
    backupReady: false,
    blockers: [{ code: 'MINIMUM_APPROVER_COVERAGE_REQUIRED', message: 'Assign 1 more verified real Finance approver through independent review.' }],
    categoryCoverage: [
      { category: 'FINANCE_PAYMENT_CLEARING', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
      { category: 'FINANCE_GENERAL_LEDGER', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
      { category: 'FINANCE_BANK_RECONCILIATION', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
      { category: 'FINANCE_WALLET_ADJUSTMENTS', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
      { category: 'FINANCE_SETTLEMENTS', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
      { category: 'FINANCE_TAX', checkerCount: 1, ready: false, requiredCheckerCount: 2 },
    ],
    currentActor: {
      canDecide: true,
      canReadHistory: true,
      canRequest: true,
      email: 'maker@example.com',
      fullName: 'Maker Admin',
      id: 'maker-1',
    },
    eligibleCandidateCount: 1,
    fixtureExcludedCount: 12,
    releaseBlockingAccountCount: 14,
    unknownHighPrivilegeCount: 13,
    unattestedLegacyCount: 1,
    lastEvaluatedAt: '2026-08-11T05:00:00.000Z',
    pendingRequestCount: 1,
    primaryReady: true,
    readiness: 'BLOCKED',
    requiredApproverCount: 2,
    verifiedRealApproverCount: 1,
  };
}

function operatorPage() {
  return {
    items: [
      {
        accountStatus: 'ACTIVE',
        action: { allowed: true, blockers: [], requestedEnabled: true },
        attestationStatus: 'NOT_REQUIRED',
        credentialState: 'ACTIVE',
        email: 'candidate@example.com',
        financeAccess: 'PREPARATION_ONLY',
        fixtureExpiresAt: null,
        fixtureKind: null,
        fixtureRunId: null,
        fullName: 'Candidate Admin',
        id: 'candidate-1',
        isCurrentActor: false,
        lastChangedAt: null,
        legacyAttestationLifecycle: 'NOT_REQUIRED',
        mfaVerified: true,
        openFinanceWork: { available: false, count: null },
        pendingRequest: null,
        permissionVersion: 3,
        policyBlockers: [],
        provenance: 'PRODUCTION',
        source: 'PRODUCTION',
        reviewStatus: 'NONE',
        separationReadiness: 'READY',
      },
      {
        accountStatus: 'ACTIVE',
        action: {
          allowed: false,
          blockers: [{ code: 'SELF_ACCESS_CHANGE_FORBIDDEN', message: 'You cannot change your own finance approval access.' }],
          requestedEnabled: false,
        },
        email: 'maker@example.com',
        financeAccess: 'APPROVER',
        attestationStatus: 'UNATTESTED',
        credentialState: 'ACTIVE',
        fixtureExpiresAt: null,
        fixtureKind: null,
        fixtureRunId: null,
        fullName: 'Maker Admin',
        id: 'maker-1',
        isCurrentActor: true,
        lastChangedAt: '2026-08-10T05:00:00.000Z',
        legacyAttestationLifecycle: 'MISSING',
        mfaVerified: true,
        openFinanceWork: { available: false, count: null },
        pendingRequest: null,
        permissionVersion: 4,
        policyBlockers: [{ code: 'LEGACY_ACCESS_UNATTESTED', message: 'Legacy finance approval access requires independent attestation.' }],
        provenance: 'PRODUCTION',
        source: 'LEGACY',
        reviewStatus: 'NONE',
        separationReadiness: 'BLOCKED',
      },
    ],
    skip: 0,
    take: 25,
    totalCount: 2,
  };
}

function requestPage() {
  return { items: [requestRecord()], skip: 0, take: 25, totalCount: 1 };
}

function historyPage() {
  return {
    items: [{
      ...requestRecord(),
      events: [{
        action: 'admin_user.finance_approver.requested',
        actor: { id: 'maker-1', email: 'maker@example.com', fullName: 'Maker Admin' },
        createdAt: '2026-08-11T05:00:00.000Z',
        id: 'audit-1',
        metadata: {},
        target: 'finance_approver_request:request-1',
      }],
    }],
    legacyAttestationHistoryTruncated: false,
    legacyAttestations: [{
      action: 'admin_user.finance_approver.legacy_attestation.approved',
      actor: { id: 'owner-1', email: 'owner@example.com', fullName: 'Policy Owner' },
      actorId: 'owner-1',
      auditHref: '/audit-log?range=all&sort=oldest&targetPrefix=finance_approver_attestation%3Acandidate-1%3Aowner-review-1',
      createdAt: '2026-08-10T05:00:00.000Z',
      expiresAt: '2026-11-08T05:00:00.000Z',
      id: 'attestation-audit-1',
      lifecycle: 'CURRENT',
      metadata: {},
      source: 'LEGACY',
      target: 'finance_approver_attestation:candidate-1:owner-review-1',
      targetUser: { id: 'candidate-1', email: 'candidate@example.com', fullName: 'Candidate Admin' },
      targetUserId: 'candidate-1',
    }],
    skip: 0,
    take: 25,
    totalCount: 1,
  };
}

function requestRecord() {
  return {
    createdAt: '2026-08-11T05:00:00.000Z',
    decidedAt: null,
    decidedByAdmin: null,
    decidedByAdminId: null,
    decisionReason: null,
    executedAt: null,
    expectedPermissionVersion: 3,
    expectedTargetUpdatedAt: '2026-08-11T04:55:00.000Z',
    id: 'request-1',
    idempotencyKey: 'finance-access:test-request-1',
    operatorReason: 'Independent treasury backup coverage',
    previousEnabled: false,
    previousRoles: ['ADMIN'],
    requestedAt: '2026-08-11T05:00:00.000Z',
    requestedByAdmin: { id: 'maker-1', email: 'maker@example.com', fullName: 'Maker Admin' },
    requestedByAdminId: 'maker-1',
    requestedEnabled: true,
    source: 'PRODUCTION',
    sourceReference: null,
    status: 'PENDING',
    targetUser: { id: 'candidate-1', email: 'candidate@example.com', fullName: 'Candidate Admin' },
    targetUserId: 'candidate-1',
    targetPolicy: {
      attestationStatus: 'NOT_REQUIRED',
      blockers: [],
      credentialState: 'ACTIVE',
      legacyAttestationLifecycle: 'NOT_REQUIRED',
      mfaVerified: true,
      permissionVersion: 3,
      permissionVersionMatches: true,
      requestedPermissionVersion: 3,
      ready: true,
    },
    updatedAt: '2026-08-11T05:00:00.000Z',
  };
}
