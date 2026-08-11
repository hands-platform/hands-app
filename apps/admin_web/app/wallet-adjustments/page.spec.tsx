import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { adminGetResult } from '../../lib/admin-api';
import WalletAdjustmentsPage from './page';

vi.mock('../../lib/admin-operator-access', () => ({ getCurrentAdminOperatorAccess: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/admin-api')>();
  return { ...actual, adminGetResult: vi.fn() };
});
vi.mock('./wallet-adjustment-create-workspace', () => ({
  WalletAdjustmentCreateWorkspace: () => <div data-testid="create-workspace">Create workspace</div>,
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

  it('defaults unknown views to the oldest awaiting approval queue', async () => {
    const markup = renderToStaticMarkup(await WalletAdjustmentsPage({
      searchParams: Promise.resolve({ view: 'unknown' }),
    }));

    expect(markup).toContain('Wallet adjustment requests');
    expect(markup).toContain('Awaiting approval');
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(3);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests?sort=oldest&review=awaiting&take=10', []);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/wallet-adjustment-requests/summary?sort=oldest&review=awaiting', { total: 0 });
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
  });

  it('provides pending age, blockers, and the single Approval Queue action', () => {
    expect(pageSource).toContain('requestAge(request.createdAt)');
    expect(pageSource).toContain("request.preflight?.blockers?.[0]");
    expect(pageSource).toContain('/finance-tax/approval-queue?view=wallet&requestId=');
    expect(pageSource).not.toContain('approveManualWalletAdjustmentRequest');
    expect(pageSource).toContain('Legacy invalid — cannot approve');
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
