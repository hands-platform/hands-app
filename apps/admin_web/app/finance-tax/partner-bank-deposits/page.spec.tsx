import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import PartnerBankDepositsPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});
vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('PartnerBankDepositsPage', () => {
  it('keeps unresolved bank evidence on a server-paginated monthly review queue', async () => {
    mockedAdminGet.mockResolvedValue({
      items: [
        {
          id: 'deposit-1',
          providerProfileId: 'provider-1',
          amount: 200000,
          currency: 'VND',
          bankTransactionId: 'VCB-001',
          depositDate: '2026-06-29T04:00:00.000Z',
          requestedBeforeBalance: -100000,
          requestedAfterBalance: 100000,
          requestedReceivableRecovery: 100000,
          requestedWalletLiabilityIncrease: 100000,
          status: 'EXECUTED',
          requestedByAdminId: 'maker-1',
          requestedBy: { id: 'maker-1', fullName: 'Deposit Maker' },
          approvedByAdminId: 'approver-1',
          approvedBy: { id: 'approver-1', fullName: 'Finance Approver' },
          executedAt: '2026-06-29T05:00:00.000Z',
          journalBatchId: 'journal-1',
          createdAt: '2026-06-29T04:00:00.000Z',
          updatedAt: '2026-06-29T04:00:00.000Z',
          allocatedCashDebtAmount: 70000,
          reconciliationMatchedAmount: 50000,
          reconciliationRemainingAmount: 150000,
          reconciliationSlaStatus: 'OVER_24H',
          reconciliationWaitingHours: 31,
          reconciliationReviewAssignment: {
            assignedAt: '2026-06-30T00:00:00.000Z',
            assignedByAdminId: 'master-1',
            assigneeAdminId: 'finance-operator-1',
            assignee: { id: 'finance-operator-1', fullName: 'Finance Operator' },
            reason: 'Own unresolved deposit evidence',
          },
          reconciliationStatus: 'PARTIALLY_MATCHED',
          providerProfile: {
            id: 'provider-1',
            displayName: 'Partner One',
            user: { id: 'user-1', fullName: 'Partner One', phone: '+84900000001' },
          },
        },
      ],
      pagination: { skip: 0, take: 25, total: 1 },
      statusCounts: { EXECUTED: 1 },
      reconciliationSummary: { openAmount: 150000, openCount: 1, period: '2026-06' },
    } as never);

    const page = await PartnerBankDepositsPage({
      searchParams: Promise.resolve({ period: '2026-06', review: 'needs-reconciliation' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=2026-06',
      expect.anything(),
    );
    expect(markup).toContain('Needs reconciliation');
    expect(markup).toContain('PARTIALLY MATCHED');
    expect(markup).toContain('150.000 VND');
    expect(markup).toContain('Bank reconciliation');
    expect(markup).toContain('OVER 24H · 31H');
    expect(markup).toContain('Owner Finance Operator');
    expect(markup).toContain('Requested by Deposit Maker');
    expect(markup).toContain('Approved &amp; executed by Finance Approver');
    expect(markup).toContain('Executed');
    expect(markup).toContain('server');
  });

  it('applies owner and SLA filters before server pagination', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'finance-operator-1' } as never);
    mockedAdminGet.mockResolvedValue({
      items: [],
      pagination: { skip: 0, take: 25, total: 0 },
      statusCounts: {},
      reconciliationSummary: { openAmount: 0, openCount: 0, period: null },
    } as never);

    await PartnerBankDepositsPage({
      searchParams: Promise.resolve({ owner: 'mine', sla: 'escalate' }),
    });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&assigneeAdminId=finance-operator-1&sla=escalate',
      expect.anything(),
    );
  });
});
