import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    const history = {
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
    };
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'finance-operator-1' } as never);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.includes('/reconciliation-owner-summary?')) {
        return {
          currency: 'VND',
          openAmount: 150000,
          openCount: 1,
          owners: [{
            assignee: {
              email: 'finance-operator-1@hands.test',
              fullName: 'Finance Operator',
              id: 'finance-operator-1',
            },
            assigneeAdminId: 'finance-operator-1',
            oldestOccurredAt: '2026-06-29T05:00:00.000Z',
            openAmount: 150000,
            openCount: 1,
            over48hAmount: 150000,
            over48hCount: 1,
          }],
          unassigned: {
            oldestOccurredAt: null,
            openAmount: 0,
            openCount: 0,
            over48hAmount: 0,
            over48hCount: 0,
          },
        } as never;
      }
      if (href.startsWith('/admin/users?')) {
        return [{
          id: 'finance-operator-1',
          email: 'finance-operator-1@hands.test',
          fullName: 'Finance Operator',
          roles: ['ADMIN'],
          adminOperatorPermission: { categories: ['FINANCE_BANK_RECONCILIATION'] },
        }] as never;
      }
      if (href.includes('/deposit-requests/history?')) return history as never;
      return fallback as never;
    });

    const page = await PartnerBankDepositsPage({
      searchParams: Promise.resolve({
        period: '2026-06',
        returnTo: '/finance-overview?view=queues',
        review: 'needs-reconciliation',
        scope: 'all-open',
        sort: 'oldest',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=2026-06',
      expect.anything(),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/reconciliation-owner-summary?period=2026-06',
      expect.anything(),
    );
    expect(markup).toContain('Needs reconciliation');
    expect(markup).toContain('Review owner workload');
    expect(markup).toContain('My reviews');
    expect(markup).toContain('48h+');
    expect(markup).toContain('PARTIALLY MATCHED');
    expect(markup).toContain('150.000 VND');
    expect(markup).toContain('Bank reconciliation');
    expect(markup).toContain('OVER 24H · 31H');
    expect(markup).toContain('Owner Finance Operator');
    expect(markup).toContain('Requested by Deposit Maker');
    expect(markup).toContain('Approved &amp; executed by Finance Approver');
    expect(markup).toContain('Executed');
    expect(markup).toContain('server');
    expect(markup).toContain('Assign selected to');
    expect(markup).toContain('Assign selected');
    expect(markup).toContain('name="partnerBankDepositRequestIds"');
    expect(markup).toContain('value="deposit-1"');
    expect(markup).toContain('href="/finance-overview?view=queues"');
    expect(markup).toContain('name="returnTo" value="/finance-overview?view=queues"');
    expect(markup).toContain('name="scope" value="all-open"');
    expect(markup).toContain('name="sort" value="oldest"');
    expect(markup).toContain(
      'href="/finance-tax/partner-bank-deposits?review=needs-reconciliation&amp;period=2026-06&amp;returnTo=%2Ffinance-overview%3Fview%3Dqueues&amp;scope=all-open&amp;sort=oldest"',
    );
  });

  it('applies owner and SLA filters before server pagination', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'finance-operator-1' } as never);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.includes('/deposit-requests/history?')) {
        return {
          items: [],
          pagination: { skip: 0, take: 25, total: 0 },
          statusCounts: {},
          reconciliationSummary: { openAmount: 0, openCount: 0, period: null },
        } as never;
      }
      return fallback as never;
    });

    await PartnerBankDepositsPage({
      searchParams: Promise.resolve({ owner: 'mine', sla: 'escalate' }),
    });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&assigneeAdminId=finance-operator-1&sla=escalate',
      expect.anything(),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/reconciliation-owner-summary?sla=escalate',
      expect.anything(),
    );
  });

  it('posts bounded Partner deposit selections to the bulk reconciliation assignment route', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

    expect(source).toContain('assignPartnerBankDepositReconciliationReviewsAction');
    expect(source).toContain(
      "'/admin/provider-wallet/deposit-requests/reconciliation-assignments'",
    );
    expect(source).toContain(".getAll('partnerBankDepositRequestIds')");
    expect(source).toContain('partnerBankDepositRequestIds.length > 50');
    expect(source).toContain('Reconciled or changed records reject the whole request.');
  });
});
