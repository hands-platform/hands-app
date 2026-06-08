import { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { operationalPolicyHref } from '../../lib/operations-policy';

type ActionGatePolicyValueFormatter = (
  settings: AdminOperationalPolicySetting[],
  key: string,
  value: string | number,
) => string;

export type ActionGatePolicyChecklist = {
  alignedCount: number;
  totalCount: number;
  summary: Array<{ label: string; value: string; helper: string }>;
  cards: Array<{
    title: string;
    status: string;
    current: string;
    detail: string;
    operatorAction: string;
    href: string;
    className: string;
    pillClass: string;
  }>;
};

export function buildActionGatePolicyChecklist(
  settings: AdminOperationalPolicySetting[],
  formatSnapshotPolicyValue: ActionGatePolicyValueFormatter,
): ActionGatePolicyChecklist {
  const rows = [
    {
      key: 'decision.action_evidence_gate_mode',
      title: 'Booking action evidence',
      recommendedValue: 'ADMIN_EVIDENCE_REVIEW',
      detail:
        'Capture, release, expiry, no-show, and closeout actions should keep payment, chat, address, wallet, and audit evidence visible before operators decide.',
      operatorAction:
        'Use booking detail action gates before pressing irreversible money or closeout buttons.',
      href: '/bookings?view=manual-decision',
    },
    {
      key: 'cash.settlement_clearance_policy',
      title: 'Cash fee clearance',
      recommendedValue: 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED',
      detail:
        'Negative wallet from cash jobs can be cleared by verified company deposit or approved settlement offset, with evidence retained.',
      operatorAction:
        'Check cash settlement references before clearing partner marketplace and payout holds.',
      href: '/cash-settlements',
    },
    {
      key: 'payout.batch_cycle_policy',
      title: 'Payout batch cycle',
      recommendedValue: 'WEEKLY_OR_MONTHLY_BATCH',
      detail:
        'Positive partner earnings should move through weekly, monthly, or admin-selected payout batches instead of instant one-booking payouts.',
      operatorAction:
        'Use payout batches with transfer references so finance can reconcile earnings, tax, withholding, and wallet records.',
      href: '/payouts',
    },
    {
      key: 'matching.first_pick_expiry_action_policy',
      title: 'First-pick expiry',
      recommendedValue: 'OPEN_MARKETPLACE_AND_OPERATOR_REVIEW',
      detail:
        'When the first-pick timer passes, marketplace alternatives can stay visible while operators monitor the request. Final partner choice still belongs to the customer.',
      operatorAction: 'Review first-pick overdue bookings and marketplace supply before expiring a request.',
      href: '/bookings?view=first-pick',
    },
    {
      key: 'no_show.evidence_requirement_policy',
      title: 'No-show evidence',
      recommendedValue: 'CHAT_ALERT_LOCATION_OR_NOTE_REQUIRED',
      detail:
        'No-show closeout should be based on retained factual records such as chat, alerts, location snapshot, or operator notes.',
      operatorAction: 'Keep no-show decisions factual and inspect the booking transcript before closing.',
      href: '/bookings?view=no-show',
    },
  ];

  const cards = rows.map((row) => {
    const setting = settings.find((item) => item.key === row.key);
    const value = setting?.value ?? row.recommendedValue;
    const current = formatSnapshotPolicyValue(settings, row.key, String(value));
    const aligned = String(value) === row.recommendedValue;
    return {
      title: row.title,
      status: aligned ? 'Recommended' : 'Owner override',
      current,
      detail: row.detail,
      operatorAction: row.operatorAction,
      href: setting ? operationalPolicyHref(row.key) : row.href,
      className: aligned ? 'ops-task-done' : 'ops-task-warning',
      pillClass: aligned ? 'pill-success' : 'pill-warn',
    };
  });
  const alignedCount = cards.filter((card) => card.status === 'Recommended').length;

  return {
    alignedCount,
    totalCount: cards.length,
    summary: [
      {
        label: 'Recommended posture',
        value: `${alignedCount}/${cards.length}`,
        helper: 'Policies aligned with current MVP operating rules.',
      },
      {
        label: 'Money actions',
        value: cards[0]?.status ?? 'Unknown',
        helper: 'Payment and closeout gates should keep evidence review visible.',
      },
      {
        label: 'Cash fee clearance',
        value: cards[1]?.status ?? 'Unknown',
        helper: 'Negative wallet clearance is tied to settlement evidence.',
      },
      {
        label: 'Payout cycle',
        value: cards[2]?.status ?? 'Unknown',
        helper: 'Positive earnings stay batch-settled by finance.',
      },
      {
        label: 'No-show closeout',
        value: cards[4]?.status ?? 'Unknown',
        helper: 'No-show remains an admin evidence decision.',
      },
    ],
    cards,
  };
}
