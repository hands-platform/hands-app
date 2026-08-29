import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { adminGetResult } from '../../lib/admin-api';
import WalletAdjustmentsPage, { metadata } from './page';

vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/admin-api')>();
  return { ...actual, adminGetResult: vi.fn() };
});
vi.mock('./wallet-adjustment-create-workspace', () => ({
  WalletAdjustmentCreateWorkspace: () => <div data-testid="create-workspace">Create workspace</div>,
}));
vi.mock('./wallet-adjustment-detail-focus', () => ({
  WalletAdjustmentDetailFocusManager: () => null,
  WalletAdjustmentDetailPanel: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

const mockedAccess = vi.mocked(getCurrentAdminOperatorAccess);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync('app/wallet-adjustments/page.tsx', 'utf8');
const detailFocusSource = readFileSync('app/wallet-adjustments/wallet-adjustment-detail-focus.tsx', 'utf8');
const createSource = readFileSync('app/wallet-adjustments/wallet-adjustment-create-workspace.tsx', 'utf8');
const actionSource = readFileSync('app/wallet-adjustments/actions.ts', 'utf8');
const cssSource = readFileSync('app/globals.css', 'utf8');

function resultFor(path: string) {
  if (path.includes('/policy')) {
    return {
      data: {
        allowedCombinations: [
          { adjustmentTypes: ['PARTNER_BONUS'], direction: 'CREDIT', ownerType: 'PARTNER' },
        ],
        constraints: { amountMax: 1000000000, attachmentRequiredAt: 10000000, attachmentUrlMaxLength: 500, reasonMaxLength: 1000 },
        openPeriodStatuses: ['DRAFT', 'REVIEWED'],
        specialFlows: { cashBookingDeduction: 'SETTLEMENT_ROUTE_REQUIRED', manualReversal: 'SOURCE_REQUEST_REQUIRED' },
      },
      ok: true,
      status: 200,
    };
  }
  if (path.includes('/open-periods')) {
    return {
      data: [{ currency: 'VND', id: 'period-2026-08', period: '2026-08', status: 'DRAFT', updatedAt: '2026-08-10T00:00:00.000Z' }],
      ok: true,
      status: 200,
    };
  }
  if (path.includes('/workspace-summary')) {
    return { data: { awaitingApproval: 0, history: 0, needsRecreation: 0, staleOrBlocked: 0 }, ok: true, status: 200 };
  }
  if (path.includes('/summary')) return { data: { total: 0 }, ok: true, status: 200 };
  return { data: [], ok: true, status: 200 };
}

describe('WalletAdjustmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAccess.mockResolvedValue({ id: 'admin-1', categories: ['FINANCE_WALLET_ADJUSTMENTS'], roles: ['MASTER_ADMIN'] });
    mockedAdminGetResult.mockImplementation(async (path) => resultFor(path) as never);
  });

  it('lets the root metadata template append the Admin title exactly once', () => {
    expect(metadata).toEqual({ title: 'Wallet Adjustments' });
  });

  it('defaults unknown views to the oldest awaiting approval queue', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'unknown' }),
    }));

    expect(markup).toContain('Wallet adjustment requests');
    expect(markup).toContain('All pending');
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(4);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests?sort=oldest&review=awaiting&take=10', []);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests/summary?sort=oldest&review=awaiting', { total: 0 });
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests/summary?review=awaiting&age=24h-plus', { total: 0 });
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests/workspace-summary', expect.any(Object));
    expect(mockedAdminGetResult.mock.calls.some(([path]) => String(path).includes('/policy'))).toBe(false);
  });

  it('loads only request lifecycle data in Requests view with independent prefixed filters', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        requestOwnerType: 'CUSTOMER',
        requestPage: '2',
        requestPageSize: '25',
        view: 'requests',
      }),
    }));

    expect(markup).toContain('Wallet adjustment requests');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests?ownerType=CUSTOMER&sort=oldest&review=awaiting&take=25&skip=25',
      [],
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests/summary?ownerType=CUSTOMER&sort=oldest&review=awaiting',
      { total: 0 },
    );
    expect(mockedAdminGetResult.mock.calls.some(([path]) => String(path).startsWith('/admin/wallet-adjustments?'))).toBe(false);
  });

  it('explains overlapping quick views and keeps recreation under Blocked', async () => {
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/workspace-summary')) {
        return { data: { awaitingApproval: 10, history: 35, needsRecreation: 4, staleOrBlocked: 7 }, ok: true, status: 200 } as never;
      }
      if (path.includes('age=24h-plus')) return { data: { total: 6 }, ok: true, status: 200 } as never;
      if (path.includes('/summary')) return { data: { total: 10 }, ok: true, status: 200 } as never;
      return { data: [], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'requests' }),
    }));

    expect(markup).toContain('All pending · 10');
    expect(markup).toContain('Blocked · 7');
    expect(markup).toContain('Needs recreation · 4');
    expect(markup).toContain('Aged 24h+ · 6');
    expect(markup).toContain('History · 35');
    expect(markup).toContain('Quick views may overlap. All pending is the total backlog. Needs recreation is a subset of Blocked.');
  });

  it('uses the existing age predicate for Aged 24h+ list, count, and pagination', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        requestPage: '2',
        requestPageSize: '25',
        requestReview: 'aged24h',
        view: 'requests',
      }),
    }));

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests?sort=oldest&review=awaiting&age=24h-plus&take=25&skip=25',
      [],
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests/summary?sort=oldest&review=awaiting&age=24h-plus',
      { total: 0 },
    );
    expect(markup).toContain('requestReview=aged24h');
    expect(markup).toContain('requestAge=24h-plus');
    expect(markup).not.toContain('Age: 24h-plus');
  });

  it('keeps request advanced filters functional while reducing the default filter surface', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        requestAdjustmentType: 'CUSTOMER_COMPENSATION',
        requestBlocker: 'WALLET_BALANCE_CHANGED',
        requestDirection: 'CREDIT',
        requestEvidence: 'missing',
        requestFrom: '2026-08-01',
        requestMakerId: 'maker-1',
        requestPageSize: '25',
        requestPeriod: '2026-08',
        requestPeriodMissing: 'true',
        requestSort: 'newest',
        view: 'requests',
      }),
    }));

    const listCall = mockedAdminGetResult.mock.calls.find(([path]) =>
      String(path).startsWith('/admin/wallet-adjustment-requests?'),
    );
    expect(String(listCall?.[0])).toContain('adjustmentType=CUSTOMER_COMPENSATION');
    expect(String(listCall?.[0])).toContain('blocker=WALLET_BALANCE_CHANGED');
    expect(String(listCall?.[0])).toContain('direction=CREDIT');
    expect(String(listCall?.[0])).toContain('evidence=missing');
    expect(String(listCall?.[0])).toContain('makerId=maker-1');
    expect(markup.indexOf('Advanced request filters')).toBeLessThan(markup.indexOf('Adjustment type'));
    expect(markup).toContain('Applied filters');
    expect(markup).toContain('Clear all filters');
  });

  it('keeps record advanced filters functional while exposing only the core filters by default', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        recordAdjustmentType: 'CUSTOMER_COMPENSATION',
        recordApproverId: 'approver-1',
        recordDirection: 'CREDIT',
        recordEvidence: 'attached',
        recordMakerId: 'maker-1',
        recordPageSize: '25',
        recordPeriod: '2026-08',
        recordPeriodMissing: 'true',
        view: 'records',
      }),
    }));

    const listCall = mockedAdminGetResult.mock.calls.find(([path]) =>
      String(path).startsWith('/admin/wallet-adjustments?'),
    );
    expect(String(listCall?.[0])).toContain('adjustmentType=CUSTOMER_COMPENSATION');
    expect(String(listCall?.[0])).toContain('approverId=approver-1');
    expect(String(listCall?.[0])).toContain('direction=CREDIT');
    expect(String(listCall?.[0])).toContain('evidence=attached');
    expect(String(listCall?.[0])).toContain('makerId=maker-1');
    expect(markup.indexOf('Advanced record filters')).toBeLessThan(markup.indexOf('Adjustment type'));
    expect(markup).toContain('Applied filters');
  });

  it('loads an exact executed record even when it is outside the current page', async () => {
    const exactRecord = {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      afterBalance: 110000,
      amount: 10000,
      beforeBalance: 100000,
      currency: 'VND',
      direction: 'CREDIT',
      id: 'ledger-outside-page',
      ledgerType: 'ADMIN_ADJUSTMENT',
      ownerId: 'customer-1',
      ownerLabel: 'Customer One',
      ownerPhone: '+84*******01',
      ownerType: 'CUSTOMER',
      sourceKey: 'manual-wallet-adjustment:CUSTOMER:customer-1:request-1',
      walletDelta: 10000,
    };
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path === `/admin/wallet-adjustments/${exactRecord.id}`) {
        return { data: exactRecord, ok: true, status: 200 } as never;
      }
      if (path.includes('/summary')) return { data: { total: 47 }, ok: true, status: 200 } as never;
      return { data: [], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        recordDetailId: exactRecord.id,
        recordPage: '5',
        view: 'records',
      }),
    }));

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      `/admin/wallet-adjustments/${exactRecord.id}`,
      expect.any(Object),
    );
    expect(markup).toContain('Wallet adjustment evidence');
    expect(markup).toContain(exactRecord.id);
    expect(markup).toContain('<dt>Balance before</dt><dd>100.000 VND</dd>');
    expect(markup).toContain('<dt>Balance after</dt><dd>110.000 VND</dd>');
    expect(markup).not.toContain('Selected executed record is unavailable');
  });

  it('labels record balance endpoints and gives repeated detail actions unique names', async () => {
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/summary')) return { data: { total: 1 }, ok: true, status: 200 } as never;
      if (path.startsWith('/admin/wallet-adjustments?')) {
        return { data: [{
          adjustmentType: 'CUSTOMER_COMPENSATION',
          afterBalance: 110000,
          amount: 10000,
          beforeBalance: 100000,
          currency: 'VND',
          direction: 'CREDIT',
          id: 'ledger-row-1',
          ownerId: 'customer-1',
          ownerLabel: 'Customer One',
          ownerPhone: '+84*******01',
          ownerType: 'CUSTOMER',
          walletDelta: 10000,
        }], ok: true, status: 200 } as never;
      }
      return resultFor(path) as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'records' }),
    }));

    expect(markup).toContain('<strong>Before 100.000 VND · After 110.000 VND</strong>');
    expect(markup).toContain('aria-label="Open details for Customer One (ledger-row-1)"');
  });

  it('loads the finance policy and open accounting periods in New request view', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'create' }),
    }));

    expect(markup).toContain('Create workspace');
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(2);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustments/policy', expect.any(Object));
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustments/open-periods', []);
  });

  it('hides New request and normalizes create to Requests without maker permission', async () => {
    mockedAccess.mockResolvedValue({ id: 'admin-2', categories: ['BOOKINGS'], roles: [] });
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'create' }),
    }));

    expect(markup).not.toContain('New request');
    expect(markup).toContain('Wallet adjustment requests');
  });

  it('shows section failure instead of rendering an API failure as a genuine empty result', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: [], ok: false, status: 503 });
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({}));

    expect(markup).toContain('Could not load wallet adjustment requests');
    expect(markup).toContain('This is not an empty result');
    expect(markup).not.toContain('No wallet adjustment requests match these filters');
  });

  it('keeps record and request query contracts independent and bounded', () => {
    expect(pageSource).toContain("readParam(params, 'recordOwnerType')");
    expect(pageSource).toContain("readParam(params, 'requestOwnerType')");
    expect(pageSource).toContain("readParam(params, 'recordPageSize')");
    expect(pageSource).toContain("readParam(params, 'requestPageSize')");
    expect(pageSource).toContain('PAGE_SIZE_MAX = 50');
    expect(pageSource).not.toContain('readWalletAdjustmentFormState');
    expect(pageSource).toContain('Applied filters');
    expect(pageSource).toContain('Clear all filters');
  });

  it('keeps create draft values out of URL and redirect construction', () => {
    expect(actionSource).toContain("new URLSearchParams({ adjustmentNotice: notice, view: 'create' })");
    expect(actionSource).not.toContain("params.set('reason'");
    expect(actionSource).not.toContain("params.set('attachmentUrl'");
    expect(actionSource).not.toContain("params.set('amount'");
    expect(actionSource).not.toContain("params.set('ownerId'");
    expect(createSource).not.toContain('method="get"');
  });

  it('derives adjustment options from the API policy and removes general reversal and settlement options', () => {
    expect(createSource).toContain('policy.allowedCombinations.find');
    expect(createSource).not.toContain("value: 'MANUAL_REVERSAL'");
    expect(createSource).not.toContain("value: 'CASH_BOOKING_DEDUCTION'");
    expect(createSource).toContain("ownerType === 'PARTNER' ? 'Partner compensation'");
  });

  it('invalidates preview when the controlled payload changes and disables creation until it matches', () => {
    expect(createSource).toContain('previewState.inputKey === currentInputKey');
    expect(createSource).toContain('disabled={!currentPreview || submitPending}');
    expect(createSource).toContain('formAction={previewAction}');
    expect(createSource).toContain('onReset={(event) => event.preventDefault()}');
  });

  it('keeps the visible wallet owner scope aligned with the submitted search', () => {
    expect(actionSource).toContain("return { ownerType, owners: result.data, status: 'success' }");
    expect(createSource).toContain("defaultValue={searchState.ownerType ?? 'PARTNER'}");
    expect(createSource).toContain("key={searchState.ownerType ?? 'initial'}");
  });

  it('uses unique accessible table names, visible labels, and desktop-safe table sizing', () => {
    expect(pageSource).toContain('ariaLabel="Wallet adjustment requests"');
    expect(pageSource).toContain('ariaLabel="Executed wallet ledger"');
    expect(pageSource).toContain('labelVisibility="visible"');
    expect(createSource).toContain("ariaInvalid={actionError.field === 'amount'}");
    expect(createSource).toContain('AdminFormInput');
    expect(createSource).toContain('AdminFormSelect');
    expect(cssSource).toContain('.wallet-adjustment-table-scroll table');
    expect(cssSource).toContain('min-width: 1040px');
    expect(cssSource).toContain('white-space: nowrap');
    expect(cssSource).toContain('word-break: normal');
    expect(cssSource).toContain('.wallet-adjustment-table-scroll td:nth-child(5) .pill');
  });

  it('provides pending age, blockers, and the single Approval Queue action', () => {
    expect(pageSource).toContain('requestAge(request.createdAt)');
    expect(pageSource).toContain('/finance-tax/approval-queue?view=wallet&requestId=');
    expect(pageSource).not.toContain('approveManualWalletAdjustmentRequest');
    expect(pageSource).toContain('Legacy invalid — cannot approve');
  });

  it.each([
    {
      actorLabel: 'Finance Approver',
      actor: { fullName: 'Finance Approver', id: 'approver-1' },
      actorKey: 'approvedBy',
      actorIdKey: 'approvedByAdminId',
      decidedAt: '2026-08-20T03:00:00.000Z',
      decidedAtKey: 'executedAt',
      decisionLabel: 'Executed at',
      ledgerEntryId: 'ledger-executed-1',
      reason: 'Approved from verified finance evidence',
      status: 'EXECUTED',
    },
    {
      actorLabel: 'Finance Reviewer',
      actor: { fullName: 'Finance Reviewer', id: 'reviewer-1' },
      actorKey: 'rejectedBy',
      actorIdKey: 'rejectedByAdminId',
      decidedAt: '2026-08-20T04:00:00.000Z',
      decidedAtKey: 'rejectedAt',
      decisionLabel: 'Rejected at',
      ledgerEntryId: null,
      reason: 'Evidence did not support the adjustment',
      status: 'REJECTED',
    },
    {
      actorLabel: 'Wallet Maker',
      actor: { fullName: 'Wallet Maker', id: 'maker-1' },
      actorKey: 'requestedBy',
      actorIdKey: 'requestedByAdminId',
      decidedAt: '2026-08-20T05:00:00.000Z',
      decidedAtKey: 'updatedAt',
      decisionLabel: 'Cancelled at',
      ledgerEntryId: null,
      reason: 'Live balance changed; create a fresh request',
      status: 'CANCELLED',
    },
  ])('renders stored $status lifecycle evidence without current approval warnings', async (fixture) => {
    const request = {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      amount: 10000,
      createdAt: '2026-08-19T03:00:00.000Z',
      currency: 'VND',
      decisionReason: fixture.reason,
      direction: 'CREDIT',
      id: `request-${fixture.status.toLowerCase()}`,
      ledgerEntryId: fixture.ledgerEntryId,
      ownerId: 'customer-1',
      ownerName: 'Customer One',
      ownerType: 'CUSTOMER',
      reason: 'Customer service correction',
      requestedAfterBalance: 110000,
      requestedBeforeBalance: 100000,
      requestedByAdminId: 'maker-1',
      requestedBy: { fullName: 'Wallet Maker', id: 'maker-1' },
      requiresAttachment: false,
      status: fixture.status,
      [fixture.actorIdKey]: fixture.actor.id,
      [fixture.actorKey]: fixture.actor,
      [fixture.decidedAtKey]: fixture.decidedAt,
    };
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/workspace-summary')) {
        return { data: { awaitingApproval: 0, history: 3, needsRecreation: 0, staleOrBlocked: 0 }, ok: true, status: 200 } as never;
      }
      if (path.includes('/summary')) return { data: { total: 1 }, ok: true, status: 200 } as never;
      if (path === `/admin/wallet-adjustment-requests/${request.id}`) {
        return { data: request, ok: true, status: 200 } as never;
      }
      return { data: [request], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        requestDetailId: request.id,
        requestReview: 'history',
        view: 'requests',
      }),
    }));

    expect(markup).toContain(fixture.status === 'EXECUTED' ? 'Executed' : fixture.status === 'REJECTED' ? 'Rejected' : 'Cancelled');
    expect(markup).toContain(fixture.decisionLabel);
    expect(markup).toContain(fixture.actorLabel);
    expect(markup).toContain(fixture.reason);
    if (fixture.ledgerEntryId) expect(markup).toContain(fixture.ledgerEntryId);
    expect(markup).not.toContain('Request must be recreated before approval');
    expect(markup).not.toContain('Approval is blocked');
    expect(markup).not.toContain('Cancel and recreate');
    expect(markup).not.toContain('Policy blockers are rechecked');
    expect(markup).toContain('Decided / executed');
    expect(markup).toContain(`aria-label="Open details for Customer One (${request.id})"`);
    expect(markup).toMatch(/<small>Before .*100\.000 VND.* · After .*110\.000 VND.*<\/small>/);
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests?review=history&sort=newest&take=10',
      [],
    );
  });

  it.each([
    {
      expectedAction: 'Cancel and recreate',
      preflight: { canApprove: false, canCancel: true, canReject: false },
    },
    {
      expectedAction: 'Reject in Approval Queue',
      preflight: { canApprove: false, canCancel: false, canReject: true },
    },
    {
      expectedAction: 'Review in Approval Queue',
      preflight: { canApprove: true, canCancel: false, canReject: true },
    },
    {
      expectedAction: null,
      preflight: { canApprove: false, canCancel: false, canReject: false },
    },
  ])('aligns pending row actions with server capabilities: $expectedAction', async ({ expectedAction, preflight }) => {
    const request = {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      amount: 10000,
      createdAt: '2026-08-19T03:00:00.000Z',
      currency: 'VND',
      direction: 'CREDIT',
      id: `request-${expectedAction ?? 'details-only'}`,
      ownerId: 'customer-1',
      ownerName: 'Customer One',
      ownerType: 'CUSTOMER',
      preflight: {
        blockers: [{ code: 'WALLET_BALANCE_CHANGED', message: 'The live wallet balance changed.' }],
        currentAfterBalance: 120000,
        currentBeforeBalance: 110000,
        ready: false,
        warnings: [],
        ...preflight,
      },
      reason: 'Customer service correction',
      requestedAfterBalance: 110000,
      requestedBeforeBalance: 100000,
      requestedByAdminId: 'maker-1',
      requiresAttachment: false,
      status: 'REQUESTED',
    };
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/workspace-summary')) {
        return { data: { awaitingApproval: 1, history: 0, needsRecreation: 1, staleOrBlocked: 1 }, ok: true, status: 200 } as never;
      }
      if (path.includes('/summary')) return { data: { total: 1 }, ok: true, status: 200 } as never;
      return { data: [request], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'requests' }),
    }));

    expect(markup).toContain('Open details');
    if (expectedAction) expect(markup).toContain(expectedAction);
    else {
      expect(markup).not.toContain('Cancel and recreate');
      expect(markup).not.toContain('Reject in Approval Queue');
      expect(markup).not.toContain('Review in Approval Queue');
    }
  });

  it('uses the same capability action in the row and detail panel', async () => {
    const request = {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      amount: 10000,
      createdAt: '2026-08-19T03:00:00.000Z',
      currency: 'VND',
      direction: 'CREDIT',
      id: 'request-reject-capability',
      ownerId: 'customer-1',
      ownerName: 'Customer One',
      ownerType: 'CUSTOMER',
      preflight: {
        blockers: [{ code: 'WALLET_BALANCE_CHANGED', message: 'The live wallet balance changed.' }],
        canApprove: false,
        canCancel: false,
        canReject: true,
        currentAfterBalance: 120000,
        currentBeforeBalance: 110000,
        ready: false,
        warnings: [],
      },
      reason: 'Customer service correction',
      requestedAfterBalance: 110000,
      requestedBeforeBalance: 100000,
      requestedByAdminId: 'maker-1',
      requiresAttachment: false,
      status: 'REQUESTED',
    };
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/workspace-summary')) {
        return { data: { awaitingApproval: 1, history: 0, needsRecreation: 1, staleOrBlocked: 1 }, ok: true, status: 200 } as never;
      }
      if (path.includes('/summary')) return { data: { total: 1 }, ok: true, status: 200 } as never;
      if (path === `/admin/wallet-adjustment-requests/${request.id}`) {
        return { data: request, ok: true, status: 200 } as never;
      }
      return { data: [request], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({
        requestDetailId: request.id,
        view: 'requests',
      }),
    }));

    expect(markup.match(/Reject in Approval Queue/g)).toHaveLength(2);
    expect(markup).not.toContain('Cancel and recreate');
  });

  it('summarizes intrinsic blockers before actor role blockers', async () => {
    const request = {
      adjustmentType: 'PARTNER_BONUS',
      amount: 10000,
      createdAt: '2026-08-19T03:00:00.000Z',
      currency: 'VND',
      direction: 'CREDIT',
      id: 'request-intrinsic-priority',
      ownerId: 'customer-1',
      ownerName: 'Customer One',
      ownerType: 'CUSTOMER',
      preflight: {
        blockers: [
          { code: 'FINANCE_APPROVER_REQUIRED', message: 'Current operator lacks the finance role.' },
          { code: 'WALLET_BALANCE_CHANGED', message: 'The live wallet balance changed.' },
          { code: 'POLICY_MIGRATION_REQUIRED', message: 'This legacy request must use the current policy.' },
        ],
        canApprove: false,
        canCancel: false,
        canReject: false,
        currentAfterBalance: 120000,
        currentBeforeBalance: 110000,
        ready: false,
        warnings: [],
      },
      reason: 'Customer service correction',
      requestedAfterBalance: 110000,
      requestedBeforeBalance: 100000,
      requestedByAdminId: 'maker-1',
      requiresAttachment: false,
      status: 'REQUESTED',
    };
    mockedAdminGetResult.mockImplementation(async (path) => {
      if (path.includes('/workspace-summary')) {
        return { data: { awaitingApproval: 1, history: 0, needsRecreation: 1, staleOrBlocked: 1 }, ok: true, status: 200 } as never;
      }
      if (path.includes('/summary')) return { data: { total: 1 }, ok: true, status: 200 } as never;
      return { data: [request], ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'requests' }),
    }));

    expect(markup).toContain('This legacy request must use the current policy.');
    expect(markup).not.toContain('Current operator lacks the finance role.');
  });

  it('moves long evidence out of the table cell into one URL-addressed full-width panel', () => {
    expect(pageSource).toContain("readParam(params, 'requestDetailId')");
    expect(pageSource).toContain("readParam(params, 'recordDetailId')");
    expect(pageSource).toContain('WalletAdjustmentDetailPanel');
    expect(detailFocusSource).toContain('className="wallet-adjustment-evidence-panel"');
    expect(pageSource).not.toContain('wallet-adjustment-row-details');
    expect(cssSource).toContain('.wallet-adjustment-evidence-panel');
  });

  it('shows exact owner context with a clear action', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ recordOwnerId: 'customer-with-long-reference-12345', view: 'records' }),
    }));
    expect(markup).toContain('Exact owner:');
    expect(markup).toContain('Clear exact owner');
  });
});
