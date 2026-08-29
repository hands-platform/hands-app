import type {
  AdminCashSettlementSummary,
  AdminDashboardSummary,
} from '../lib/admin-api';
import { adminCountLabel } from '../lib/admin-copy';

export type DashboardTone = 'ok' | 'info' | 'warn' | 'danger';

export type OperationsCommandBoardItem = {
  ageing?: Array<{
    href?: string;
    label: string;
    tone: 'danger' | 'info' | 'success' | 'warning';
  }>;
  lane: string;
  nextCases?: Array<{
    href: string;
    label: string;
  }>;
  impactLabel?: string;
  impactAmount?: number;
  isLiveBlock?: boolean;
  isServiceBlock?: boolean;
  mineCount?: number;
  oldestAt?: string | null;
  oldestLabel?: string;
  overdueCount?: number;
  assigneeLabel?: string;
  scopeLabel?: string;
  owner: 'Dispatch' | 'Finance' | 'Partner Ops' | 'Support' | 'Setup';
  status: string;
  value: string;
  detail: string;
  href: string;
  tone: DashboardTone;
  unassignedCount?: number;
  checks: string[];
};

type OperationsCommandBoardInput = {
  bookingOps: {
    completedCloseoutChecks: number;
    openMatching: number;
  };
  bookingDeepDive: {
    customerFinalSelection: number;
    expiredOpenMatching: number;
    matchedWithoutChat: number;
    openWithoutParticipants: number;
    quietActiveChats: number;
  };
  matchingControl: {
    metrics: ReadonlyArray<{ label: string; value: string }>;
    openRows: ReadonlyArray<{
      backupState: string;
      customerState: string;
      expired: boolean;
      freshEligibleCount: number;
    }>;
  };
  appPresence: AdminDashboardSummary['appPresence'];
  partnerSupply: AdminDashboardSummary['partnerSupply'];
  cashSettlementSummary: AdminCashSettlementSummary;
  failedNotificationCount: number;
  activePayoutBatchCount: number;
};

export function buildOperationsCommandBoard(
  input: OperationsCommandBoardInput,
): OperationsCommandBoardItem[] {
  const openMatchingFollowUp = input.matchingControl.openRows.filter(
    (row) => row.expired || row.freshEligibleCount === 0,
  ).length;
  const firstPickRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('first-pick'),
  ).length;
  const marketplaceRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('marketplace'),
  ).length;
  const customerChoiceRows = input.matchingControl.openRows.filter((row) =>
    row.customerState.toLowerCase().includes('choose'),
  ).length;
  const chatHandoffRows = input.bookingDeepDive.matchedWithoutChat + input.bookingDeepDive.quietActiveChats;
  const financeRows =
    input.bookingOps.completedCloseoutChecks +
    input.cashSettlementSummary.rowCount +
    input.activePayoutBatchCount;

  const items: OperationsCommandBoardItem[] = [
    {
      lane: 'Live booking command',
      owner: 'Dispatch',
      status: openMatchingFollowUp ? 'Action' : input.bookingOps.openMatching ? 'Live' : 'Clear',
      value: adminCountLabel(input.bookingOps.openMatching, 'item'),
      detail: openMatchingFollowUp
        ? `${adminCountLabel(openMatchingFollowUp, 'active booking row')} ${openMatchingFollowUp === 1 ? 'has' : 'have'} expired timers or no fresh nearby Partner.`
        : `${adminCountLabel(input.appPresence.liveOpenMatchingCustomers, 'customer')} ${input.appPresence.liveOpenMatchingCustomers === 1 ? 'is' : 'are'} live while matching is open.`,
      href: openMatchingFollowUp ? '/bookings?view=attention' : '/bookings?view=matching',
      isLiveBlock: openMatchingFollowUp > 0,
      tone: openMatchingFollowUp ? 'danger' : input.bookingOps.openMatching ? 'warn' : 'ok',
      checks: [
        `${input.bookingDeepDive.openWithoutParticipants} without Partner`,
        adminCountLabel(input.bookingDeepDive.expiredOpenMatching, 'expired timer'),
        'Confirmed address record',
      ],
    },
    {
      lane: 'First-pick and 10km market',
      owner: 'Dispatch',
      status: firstPickRows || marketplaceRows ? 'Monitoring' : 'Clear',
      value: adminCountLabel(firstPickRows + marketplaceRows, 'item'),
      detail:
        firstPickRows || marketplaceRows
          ? 'Preferred Partner keeps the first window while nearby Partners can request to participate for customer choice.'
          : 'No first-pick or marketplace lane is waiting in the current open sample.',
      href: firstPickRows ? '/bookings?view=first-pick' : '/bookings?view=marketplace',
      tone: firstPickRows || marketplaceRows ? 'info' : 'ok',
      checks: [
        '10 minute first-pick',
        input.matchingControl.metrics.find((item) => item.label === 'Marketplace radius')?.value ?? '10 km',
        'No auto assignment',
      ],
    },
    {
      lane: 'Customer final choice',
      owner: 'Support',
      status: customerChoiceRows ? 'Choose' : 'Waiting',
      value: adminCountLabel(customerChoiceRows, 'item'),
      detail:
        customerChoiceRows > 0
          ? 'Accepted Partners are visible; customer must select the final Partner before work is locked.'
          : 'No customer final-choice decision is waiting now.',
      href: customerChoiceRows ? '/bookings?view=customer-choice' : '/bookings',
      tone: customerChoiceRows ? 'info' : 'ok',
      checks: [
        `${input.bookingDeepDive.customerFinalSelection} selection wait`,
        'Customer-owned decision',
        'No direct cancel after match',
      ],
    },
    {
      lane: 'Chat and evidence',
      owner: 'Support',
      status: chatHandoffRows ? 'Review' : 'Clear',
      value: adminCountLabel(chatHandoffRows, 'item'),
      detail:
        chatHandoffRows > 0
          ? 'Matched work must have chat available during service and retained for admin decisions after completion.'
          : 'Matched chat and retained message checks are clear in the loaded data.',
      href: chatHandoffRows ? '/bookings?view=chat-repair' : '/bookings?view=chat',
      tone: chatHandoffRows ? 'warn' : 'ok',
      checks: [
        `${input.bookingDeepDive.matchedWithoutChat} missing room`,
        `${input.bookingDeepDive.quietActiveChats} quiet room`,
        'Chat record retained',
      ],
    },
    {
      lane: 'Partner supply',
      owner: 'Partner Ops',
      status: input.partnerSupply.onlineAvailable
        ? input.partnerSupply.staleLocation
          ? 'Refresh'
          : 'Available'
        : 'Check',
      value: `${input.partnerSupply.onlineAvailable} available`,
      detail:
        input.partnerSupply.staleLocation > 0
          ? `${adminCountLabel(input.partnerSupply.staleLocation, 'location pin')} ${input.partnerSupply.staleLocation === 1 ? 'needs' : 'need'} refresh before dispatch.`
          : input.partnerSupply.onlineAvailable > 0
            ? `${adminCountLabel(input.partnerSupply.onlineAvailable, 'available Partner')} ${input.partnerSupply.onlineAvailable === 1 ? 'is' : 'are'} ready for customer demand.`
            : 'No online available Partner is visible; check app activity, location update, and onboarding review.',
      href:
        input.partnerSupply.staleLocation > 0
          ? '/partners?review=available-blocked-location'
          : input.partnerSupply.onlineAvailable > 0
            ? '/partners'
            : '/partners/overview?range=7d&selectionIssue=availability&selectionSort=response',
      tone: input.partnerSupply.onlineAvailable
        ? input.partnerSupply.staleLocation
          ? 'warn'
          : 'ok'
        : 'warn',
      checks: [
        `${input.partnerSupply.liveSessions} recent app activity`,
        `${input.partnerSupply.noLocation} missing pin`,
        `${input.partnerSupply.pendingVerification} KYC waiting`,
      ],
    },
    {
      lane: 'Finance follow-up',
      owner: 'Finance',
      status: financeRows ? 'Review' : 'Clear',
      value: adminCountLabel(financeRows, 'item'),
      detail:
        input.cashSettlementSummary.providerCount > 0
          ? 'Negative wallet keeps marketplace list visibility, but final acceptance, service start, and payout release wait for cash fee settlement.'
          : 'Completed work, cash settlement, and payout batch rows are visible for batch closeout.',
      href:
        input.cashSettlementSummary.providerCount > 0
          ? '/cash-settlements'
          : input.activePayoutBatchCount > 0
            ? '/payouts'
            : '/finance-overview',
      tone: financeRows ? 'warn' : 'ok',
      checks: [
        adminCountLabel(input.cashSettlementSummary.rowCount, 'cash fee row'),
        adminCountLabel(input.activePayoutBatchCount, 'payout batch', 'payout batches'),
        'Weekly/monthly/admin batch',
      ],
    },
    {
      lane: 'Notifications',
      owner: 'Support',
      status: input.failedNotificationCount ? 'Retry' : 'Clear',
      value: `${input.failedNotificationCount} failed`,
      detail:
        input.failedNotificationCount > 0
          ? 'Failed delivery rows should be retried or marked so operators know whether the customer or Partner saw it.'
          : 'No failed notification rows are visible in the current operations window.',
      href: input.failedNotificationCount ? '/notifications?review=failed' : '/notifications',
      tone: input.failedNotificationCount ? 'warn' : 'ok',
      checks: ['Delivery status', 'Disabled device', 'Retry status'],
    },
  ];

  const tonePriority: Record<DashboardTone, number> = {
    danger: 4,
    warn: 3,
    info: 2,
    ok: 1,
  };

  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const toneDelta = tonePriority[right.item.tone] - tonePriority[left.item.tone];
      if (toneDelta !== 0) return toneDelta;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}
