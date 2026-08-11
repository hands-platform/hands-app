import { describe, expect, it } from 'vitest';

import type { AdminFinanceReviewOwnerWorkloadSummary } from '../lib/admin-api';
import { buildStartShiftFinanceReviewWorkload } from './start-shift-finance-review-workload';

function workload(
  input: Partial<AdminFinanceReviewOwnerWorkloadSummary> = {},
): AdminFinanceReviewOwnerWorkloadSummary {
  return {
    currency: 'VND',
    openAmount: 0,
    openCount: 0,
    owners: [],
    unassigned: {
      oldestOccurredAt: null,
      openAmount: 0,
      openCount: 0,
      over48hAmount: 0,
      over48hCount: 0,
    },
    ...input,
  };
}

describe('Start Shift finance review workload', () => {
  it('prioritizes overdue and unassigned queues and preserves exact queue links', () => {
    const lanes = buildStartShiftFinanceReviewWorkload({
      currentOperatorId: 'admin-current',
      summaries: {
        bankReconciliation: workload({
          openAmount: 900_000,
          openCount: 3,
          owners: [
            {
              assignee: {
                email: 'operator@hands.test',
                fullName: 'Operator',
                id: 'admin-current',
              },
              assigneeAdminId: 'admin-current',
              oldestOccurredAt: '2026-07-23T00:00:00.000Z',
              openAmount: 300_000,
              openCount: 1,
              over48hAmount: 300_000,
              over48hCount: 1,
            },
          ],
          unassigned: {
            oldestOccurredAt: '2026-07-22T00:00:00.000Z',
            openAmount: 600_000,
            openCount: 2,
            over48hAmount: 600_000,
            over48hCount: 2,
          },
        }),
        companyBankAccounts: {
          oldestRequestedAt: '2026-07-20T00:00:00.000Z',
          over48hCount: 1,
          pendingCount: 2,
        },
        partnerBankDeposits: workload(),
        paymentClearing: workload({
          openAmount: 100_000,
          openCount: 1,
          unassigned: {
            oldestOccurredAt: '2026-07-25T00:00:00.000Z',
            openAmount: 100_000,
            openCount: 1,
            over48hAmount: 0,
            over48hCount: 0,
          },
        }),
      },
    });

    expect(lanes.map((lane) => lane.key)).toEqual([
      'bank-reconciliation',
      'company-bank-accounts',
      'payment-clearing',
      'partner-bank-deposits',
    ]);
    expect(lanes[0]).toMatchObject({
      assigneeLabel: 'Unassigned',
      mine: { count: 1 },
      over48h: {
        count: 3,
        href: '/finance-tax/bank-reconciliation?range=all&review=unmatched&age=48h',
      },
      primaryHref: '/finance-tax/bank-reconciliation?range=all&review=unmatched&age=48h',
      status: 'SLA overdue',
      tone: 'warn',
      unassigned: {
        count: 2,
        href:
          '/finance-tax/bank-reconciliation?range=all&review=unmatched&owner=unassigned',
      },
    });
    expect(lanes[1]).toMatchObject({
      isMonetary: false,
      openCount: 2,
      primaryHref: '/finance-tax/approval-queue?view=bank-accounts',
      status: 'SLA overdue',
      tone: 'warn',
    });
    expect(lanes[2]).toMatchObject({
      assigneeLabel: 'Unassigned',
      over48h: {
        href: '/finance-tax/payment-clearing?range=all&review=open&age=48h',
      },
      primaryHref: '/finance-tax/payment-clearing?range=all&review=open&owner=unassigned',
      status: 'Needs owner',
    });
    expect(lanes[3]).toMatchObject({ status: 'Clear' });
  });

  it('uses the assigned operator identity when a queue has one owner and no unassigned work', () => {
    const lanes = buildStartShiftFinanceReviewWorkload({
      summaries: {
        bankReconciliation: workload({
          openAmount: 250_000,
          openCount: 2,
          owners: [
            {
              assignee: {
                email: 'finance@hands.test',
                fullName: 'Finance Operator',
                id: 'admin-finance',
              },
              assigneeAdminId: 'admin-finance',
              oldestOccurredAt: '2026-07-23T00:00:00.000Z',
              openAmount: 250_000,
              openCount: 2,
              over48hAmount: 0,
              over48hCount: 0,
            },
          ],
        }),
        partnerBankDeposits: workload(),
        paymentClearing: workload(),
      },
    });

    expect(lanes.find((lane) => lane.key === 'bank-reconciliation')).toMatchObject({
      assigneeLabel: 'Finance Operator',
      oldestOccurredAt: '2026-07-23T00:00:00.000Z',
      status: 'Assigned',
    });
  });

  it('labels the signed-in operator queue as Mine', () => {
    const lanes = buildStartShiftFinanceReviewWorkload({
      currentOperatorId: 'admin-finance',
      summaries: {
        bankReconciliation: workload({
          openCount: 1,
          owners: [
            {
              assignee: { email: 'finance@hands.test', fullName: 'Finance Operator', id: 'admin-finance' },
              assigneeAdminId: 'admin-finance',
              oldestOccurredAt: '2026-07-23T00:00:00.000Z',
              openAmount: 0,
              openCount: 1,
              over48hAmount: 0,
              over48hCount: 0,
            },
          ],
        }),
        partnerBankDeposits: workload(),
        paymentClearing: workload(),
      },
    });

    expect(lanes.find((lane) => lane.key === 'bank-reconciliation')).toMatchObject({
      assigneeLabel: 'Mine',
      status: 'My queue',
    });
  });

  it('keeps failed sources separate from genuine zero workload', () => {
    const lanes = buildStartShiftFinanceReviewWorkload({
      summaries: {
        bankReconciliation: null,
        companyBankAccounts: {
          oldestRequestedAt: null,
          over48hCount: 0,
          pendingCount: 0,
        },
        partnerBankDeposits: workload(),
        paymentClearing: workload(),
      },
    });

    expect(lanes[0]).toMatchObject({
      key: 'bank-reconciliation',
      state: 'unavailable',
      status: 'Data unavailable',
    });
    expect(lanes.filter((lane) => lane.status === 'Clear')).toHaveLength(3);
  });
});
