import type {
  AdminCashSettlementSummary,
  AdminDashboardSummary,
} from '../lib/admin-api';
import { buildOperationsCommandBoard } from './start-shift-operations-command-board';
import { prioritizeStartShiftCommandItems } from './start-shift-action-priority';

describe('Start Shift operations command board', () => {
  it('routes finance follow-up to the owning queue instead of the retired generic closeout hub', () => {
    const cashDebtRows = buildOperationsCommandBoard(fixture({ cashRows: 2, debtPartners: 1 }));
    const payoutRows = buildOperationsCommandBoard(fixture({ payoutBatches: 3 }));
    const clearRows = buildOperationsCommandBoard(fixture({}));

    expect(financeItem(cashDebtRows).href).toBe('/cash-settlements');
    expect(financeItem(payoutRows).href).toBe('/payouts');
    expect(financeItem(clearRows).href).toBe('/finance-overview');
    expect([cashDebtRows, payoutRows, clearRows].flat().some((item) => item.href === '/finance-closeout')).toBe(
      false,
    );
  });

  it('keeps live booking failures ahead of lower-severity informational work', () => {
    const rows = buildOperationsCommandBoard(
      fixture({
        openRows: [
          {
            backupState: 'Marketplace open',
            customerState: 'Customer waiting',
            expired: true,
            freshEligibleCount: 0,
          },
        ],
      }),
    );

    expect(rows[0]).toMatchObject({
      href: '/bookings?view=attention',
      isLiveBlock: true,
      lane: 'Live booking command',
      tone: 'danger',
    });
  });

  it('preserves Finance assignee metadata through the global command priority flow', () => {
    const [item] = prioritizeStartShiftCommandItems([
      {
        ...financeItem(buildOperationsCommandBoard(fixture({}))),
        assigneeLabel: 'Mine',
        mineCount: 2,
        status: 'My queue',
      },
    ]);

    expect(item).toMatchObject({ assigneeLabel: 'Mine', mineCount: 2 });
  });
});

function financeItem(rows: ReturnType<typeof buildOperationsCommandBoard>) {
  const item = rows.find((row) => row.lane === 'Finance follow-up');
  if (!item) throw new Error('Finance follow-up item is missing');
  return item;
}

function fixture(input: {
  cashRows?: number;
  debtPartners?: number;
  openRows?: Array<{
    backupState: string;
    customerState: string;
    expired: boolean;
    freshEligibleCount: number;
  }>;
  payoutBatches?: number;
}) {
  return {
    activePayoutBatchCount: input.payoutBatches ?? 0,
    appPresence: { liveOpenMatchingCustomers: 0 } as AdminDashboardSummary['appPresence'],
    bookingDeepDive: {
      customerFinalSelection: 0,
      expiredOpenMatching: 0,
      matchedWithoutChat: 0,
      openWithoutParticipants: 0,
      quietActiveChats: 0,
    },
    bookingOps: {
      completedCloseoutChecks: 0,
      openMatching: input.openRows?.length ?? 0,
    },
    cashSettlementSummary: {
      providerCount: input.debtPartners ?? 0,
      rowCount: input.cashRows ?? 0,
    } as AdminCashSettlementSummary,
    failedNotificationCount: 0,
    matchingControl: {
      metrics: [{ label: 'Marketplace radius', value: '10 km' }],
      openRows: input.openRows ?? [],
    },
    partnerSupply: {
      liveSessions: 0,
      noLocation: 0,
      online: 0,
      onlineAvailable: 0,
      pendingVerification: 0,
      staleLocation: 0,
    } as AdminDashboardSummary['partnerSupply'],
  };
}
