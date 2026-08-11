import type {
  AdminCompanyBankAccountApprovalSummary,
  AdminFinanceReviewOwnerWorkloadSummary,
} from '../lib/admin-api';

export type StartShiftFinanceReviewWorkloadLane = {
  readonly allHref: string;
  readonly assigneeLabel?: string;
  readonly currency: string;
  readonly isMonetary: boolean;
  readonly key:
    | 'bank-reconciliation'
    | 'company-bank-accounts'
    | 'partner-bank-deposits'
    | 'payment-clearing';
  readonly label: string;
  readonly mine: {
    readonly amount: number;
    readonly count: number;
    readonly href: string;
  };
  readonly oldestOccurredAt: string | null;
  readonly openAmount: number;
  readonly openCount: number;
  readonly over48h: {
    readonly amount: number;
    readonly count: number;
    readonly href: string;
  };
  readonly primaryHref: string;
  readonly state: 'available' | 'unavailable';
  readonly status:
    | 'Approval pending'
    | 'Assigned'
    | 'Clear'
    | 'Data unavailable'
    | 'My queue'
    | 'Needs owner'
    | 'SLA overdue';
  readonly tone: 'danger' | 'info' | 'ok' | 'warn';
  readonly unassigned: {
    readonly amount: number;
    readonly count: number;
    readonly href: string;
  };
};

type StartShiftFinanceReviewWorkloadInput = {
  readonly currentOperatorId?: string | null;
  readonly summaries?: {
    readonly bankReconciliation?: AdminFinanceReviewOwnerWorkloadSummary | null;
    readonly companyBankAccounts?: AdminCompanyBankAccountApprovalSummary | null;
    readonly partnerBankDeposits?: AdminFinanceReviewOwnerWorkloadSummary | null;
    readonly paymentClearing?: AdminFinanceReviewOwnerWorkloadSummary | null;
  } | null;
};

const LANE_CONFIG = [
  {
    allHref: '/finance-tax/payment-clearing?range=all&review=open',
    key: 'payment-clearing',
    label: 'Payment clearing',
    mineHref: '/finance-tax/payment-clearing?range=all&review=open&owner=mine',
    overdueHref: '/finance-tax/payment-clearing?range=all&review=open&age=48h',
    unassignedHref: '/finance-tax/payment-clearing?range=all&review=open&owner=unassigned',
  },
  {
    allHref: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
    key: 'bank-reconciliation',
    label: 'Bank reconciliation',
    mineHref: '/finance-tax/bank-reconciliation?range=all&review=unmatched&owner=mine',
    overdueHref: '/finance-tax/bank-reconciliation?range=all&review=unmatched&age=48h',
    unassignedHref:
      '/finance-tax/bank-reconciliation?range=all&review=unmatched&owner=unassigned',
  },
  {
    allHref: '/finance-tax/partner-bank-deposits?review=needs-reconciliation',
    key: 'partner-bank-deposits',
    label: 'Partner deposit reconciliation',
    mineHref: '/finance-tax/partner-bank-deposits?review=needs-reconciliation&owner=mine',
    overdueHref:
      '/finance-tax/partner-bank-deposits?review=needs-reconciliation&sla=escalate',
    unassignedHref:
      '/finance-tax/partner-bank-deposits?review=needs-reconciliation&owner=unassigned',
  },
] as const;

export function buildStartShiftFinanceReviewWorkload(
  input: StartShiftFinanceReviewWorkloadInput,
): StartShiftFinanceReviewWorkloadLane[] {
  const reviewLanes = LANE_CONFIG.map<StartShiftFinanceReviewWorkloadLane>((config) => {
    const summary = input.summaries?.[summaryKey(config.key)] ?? null;
    if (!summary) {
      return unavailableLane(config);
    }

    const mine = summary.owners.find(
      (owner) => owner.assigneeAdminId === input.currentOperatorId,
    );
    const over48hCount =
      summary.unassigned.over48hCount +
      summary.owners.reduce((total, owner) => total + owner.over48hCount, 0);
    const over48hAmount =
      summary.unassigned.over48hAmount +
      summary.owners.reduce((total, owner) => total + owner.over48hAmount, 0);
    const status = financeReviewLaneStatus({
      mineCount: mine?.openCount ?? 0,
      openCount: summary.openCount,
      over48hCount,
      unassignedCount: summary.unassigned.openCount,
    });

    return {
      allHref: config.allHref,
      assigneeLabel: financeReviewAssigneeLabel(summary, input.currentOperatorId),
      currency: summary.currency,
      isMonetary: true,
      key: config.key,
      label: config.label,
      mine: {
        amount: mine?.openAmount ?? 0,
        count: mine?.openCount ?? 0,
        href: config.mineHref,
      },
      oldestOccurredAt: oldestOccurredAt([
        summary.unassigned.oldestOccurredAt,
        ...summary.owners.map((owner) => owner.oldestOccurredAt),
      ]),
      openAmount: summary.openAmount,
      openCount: summary.openCount,
      over48h: {
        amount: over48hAmount,
        count: over48hCount,
        href: config.overdueHref,
      },
      primaryHref:
        over48hCount > 0
          ? config.overdueHref
          : summary.unassigned.openCount > 0
            ? config.unassignedHref
            : (mine?.openCount ?? 0) > 0
              ? config.mineHref
              : config.allHref,
      state: 'available',
      status: status.label,
      tone: status.tone,
      unassigned: {
        amount: summary.unassigned.openAmount,
        count: summary.unassigned.openCount,
        href: config.unassignedHref,
      },
    };
  });

  return [
    ...reviewLanes,
    companyBankAccountApprovalLane(input.summaries?.companyBankAccounts),
  ].sort(compareFinanceReviewLanes);
}

function summaryKey(key: (typeof LANE_CONFIG)[number]['key']) {
  if (key === 'bank-reconciliation') return 'bankReconciliation' as const;
  if (key === 'partner-bank-deposits') return 'partnerBankDeposits' as const;
  return 'paymentClearing' as const;
}

function unavailableLane(
  config: (typeof LANE_CONFIG)[number],
): StartShiftFinanceReviewWorkloadLane {
  return {
    allHref: config.allHref,
    currency: 'VND',
    isMonetary: true,
    key: config.key,
    label: config.label,
    mine: { amount: 0, count: 0, href: config.mineHref },
    oldestOccurredAt: null,
    openAmount: 0,
    openCount: 0,
    over48h: { amount: 0, count: 0, href: config.overdueHref },
    primaryHref: config.allHref,
    state: 'unavailable',
    status: 'Data unavailable',
    tone: 'danger',
    unassigned: { amount: 0, count: 0, href: config.unassignedHref },
  };
}

function companyBankAccountApprovalLane(
  summary: AdminCompanyBankAccountApprovalSummary | null | undefined,
): StartShiftFinanceReviewWorkloadLane {
  const href = '/finance-tax/approval-queue?view=bank-accounts';
  if (!summary) {
    return {
      allHref: href,
      currency: 'VND',
      isMonetary: false,
      key: 'company-bank-accounts',
      label: 'Bank account approvals',
      mine: { amount: 0, count: 0, href },
      oldestOccurredAt: null,
      openAmount: 0,
      openCount: 0,
      over48h: { amount: 0, count: 0, href },
      primaryHref: href,
      state: 'unavailable',
      status: 'Data unavailable',
      tone: 'danger',
      unassigned: { amount: 0, count: 0, href },
    };
  }

  return {
    allHref: href,
    currency: 'VND',
    isMonetary: false,
    key: 'company-bank-accounts',
    label: 'Bank account approvals',
    mine: { amount: 0, count: 0, href },
    oldestOccurredAt: summary.oldestRequestedAt,
    openAmount: 0,
    openCount: summary.pendingCount,
    over48h: { amount: 0, count: summary.over48hCount, href },
    primaryHref: href,
    state: 'available',
    status:
      summary.over48hCount > 0
        ? 'SLA overdue'
        : summary.pendingCount > 0
          ? 'Approval pending'
          : 'Clear',
    tone:
      summary.over48hCount > 0
        ? 'warn'
        : summary.pendingCount > 0
          ? 'warn'
          : 'ok',
    unassigned: { amount: 0, count: 0, href },
  };
}

function financeReviewLaneStatus(input: {
  readonly mineCount: number;
  readonly openCount: number;
  readonly over48hCount: number;
  readonly unassignedCount: number;
}) {
  if (input.over48hCount > 0) return { label: 'SLA overdue', tone: 'warn' } as const;
  if (input.unassignedCount > 0) return { label: 'Needs owner', tone: 'warn' } as const;
  if (input.mineCount > 0) return { label: 'My queue', tone: 'info' } as const;
  if (input.openCount > 0) return { label: 'Assigned', tone: 'info' } as const;
  return { label: 'Clear', tone: 'ok' } as const;
}

function financeReviewAssigneeLabel(
  summary: AdminFinanceReviewOwnerWorkloadSummary,
  currentOperatorId?: string | null,
) {
  if (summary.unassigned.openCount > 0) {
    return 'Unassigned';
  }
  if (summary.owners.some(
    (owner) => owner.assigneeAdminId === currentOperatorId && owner.openCount > 0,
  )) {
    return 'Mine';
  }
  if (summary.owners.length === 1) {
    const assignee = summary.owners[0]?.assignee;
    return assignee?.fullName?.trim() || assignee?.email?.trim() || '1 assigned operator';
  }
  if (summary.owners.length > 1) {
    return `${summary.owners.length} assigned operators`;
  }
  return undefined;
}

function oldestOccurredAt(values: readonly (string | null)[]) {
  return values.reduce<string | null>((oldest, value) => {
    if (!value) return oldest;
    if (!oldest) return value;
    return Date.parse(value) < Date.parse(oldest) ? value : oldest;
  }, null);
}

function compareFinanceReviewLanes(
  left: StartShiftFinanceReviewWorkloadLane,
  right: StartShiftFinanceReviewWorkloadLane,
) {
  const priority = (lane: StartShiftFinanceReviewWorkloadLane) => {
    if (lane.state === 'unavailable') return 0;
    if (lane.over48h.count > 0) return 1;
    if (lane.unassigned.count > 0) return 2;
    if (lane.mine.count > 0) return 3;
    if (lane.openCount > 0) return 4;
    return 5;
  };
  const priorityDifference = priority(left) - priority(right);
  if (priorityDifference !== 0) return priorityDifference;
  if (left.over48h.count !== right.over48h.count) {
    return right.over48h.count - left.over48h.count;
  }
  return right.openCount - left.openCount;
}
