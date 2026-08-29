import type {
  PartnerReviewControlPanelView,
  PartnerReviewHistoryRow,
} from './partner-detail-review-progress-section';
import { formatCurrency, formatDate } from './partner-detail-format';
import { buildPartnerDetailTargetHref } from './partner-detail-workspace-model';

type PartnerReviewControlProvider = {
  readonly id: string;
  readonly blockedAt?: string | null;
  readonly blockedReason?: string | null;
  readonly kyc?: { readonly submittedAt?: string | null } | null;
  readonly user?: { readonly createdAt?: string | null } | null;
};

type PartnerRegistrationDossier = {
  readonly blockers: number;
  readonly items: readonly {
    readonly detail: string;
    readonly label: string;
    readonly ok: boolean;
  }[];
  readonly ready: boolean;
};

type PartnerResubmissionPlan = {
  readonly items: readonly {
    readonly reason: string;
    readonly target: string;
  }[];
};

export function buildPartnerReviewControlPanel({
  cashDebtAmount,
  dossier,
  provider,
  resubmissionPlan,
  reviewHistoryRows,
  reviewIssues,
}: {
  readonly cashDebtAmount: number;
  readonly dossier: PartnerRegistrationDossier;
  readonly provider: PartnerReviewControlProvider;
  readonly resubmissionPlan: PartnerResubmissionPlan;
  readonly reviewHistoryRows: readonly PartnerReviewHistoryRow[];
  readonly reviewIssues: PartnerReviewControlPanelView['reviewIssues'];
}): PartnerReviewControlPanelView {
  const firstDossierGap = dossier.items.find((item) => !item.ok);
  const latestReview = reviewHistoryRows[0];
  const hasHold = Boolean(provider.blockedAt);
  const resubmissionCount = resubmissionPlan.items.length;
  const hasCashDebt = cashDebtAmount > 0;
  const approvalReady = dossier.ready && !resubmissionCount && !hasHold;
  const submittedLabel = formatDate(provider.kyc?.submittedAt ?? provider.user?.createdAt);
  const panelTone = hasHold
    ? 'pill-danger'
    : resubmissionCount || dossier.blockers
      ? 'pill-warn'
      : 'pill-success';
  const panelStatus = hasHold
    ? 'Partner on hold'
    : resubmissionCount
      ? `${resubmissionCount} resubmission item(s)`
      : dossier.blockers
        ? `${dossier.blockers} dossier gap(s)`
        : 'Review clear';

  return {
    status: panelStatus,
    tone: panelTone,
    reviewIssues,
    metrics: [
      {
        label: 'Submitted',
        value: submittedLabel,
        helper: provider.kyc?.submittedAt
          ? 'Latest KYC submission timestamp.'
          : 'Using account creation timestamp.',
      },
      {
        label: 'Hold state',
        value: hasHold ? 'On hold' : 'Clear',
        helper: hasHold ? (provider.blockedReason ?? 'Hold reason is missing.') : 'No active account hold.',
      },
      {
        label: 'Resubmission',
        value: `${resubmissionCount}`,
        helper: resubmissionCount
          ? 'Rejected items need Partner correction.'
          : 'No rejected item currently requires resubmission.',
      },
      {
        label: 'Latest review',
        value: latestReview?.atLabel ?? 'No log',
        helper: latestReview
          ? `${latestReview.statusLabel} / ${latestReview.actorLabel}`
          : 'No review log loaded.',
      },
    ],
    items: [
      {
        id: 'submitted-dossier',
        label: 'SUBMIT',
        title: dossier.ready ? 'Submitted dossier is complete' : 'Submitted dossier has gaps',
        detail: firstDossierGap
          ? `${firstDossierGap.label}: ${firstDossierGap.detail}`
          : 'Basic identity, service profile, public media, KYC, required documents, and account checks are complete.',
        status: dossier.ready ? 'READY' : `${dossier.blockers} GAP(S)`,
        tone: dossier.ready ? 'pill-success' : 'pill-warn',
        href: buildPartnerDetailTargetHref(provider.id, 'connected-records'),
      },
      {
        id: 'approval-decision',
        label: 'APPROVE',
        title: 'Approval decision',
        detail: hasHold
          ? 'Partner remains on hold. Release hold or record the required correction before approval.'
          : resubmissionCount
            ? `${resubmissionPlan.items[0]?.target}: ${resubmissionPlan.items[0]?.reason}`
            : firstDossierGap
              ? `${firstDossierGap.label}: ${firstDossierGap.detail}`
              : 'Profile, service profile, KYC, required documents, public media, and account checks are clear for approval.',
        status: hasHold ? 'HOLD' : approvalReady ? 'READY' : 'REVIEW',
        tone: hasHold ? 'pill-danger' : approvalReady ? 'pill-success' : 'pill-warn',
        href: buildPartnerDetailTargetHref(provider.id, 'control-queue'),
      },
      {
        id: 'booking-access-state',
        label: 'BOOK',
        title: 'Booking access',
        detail: hasHold
          ? 'Account hold blocks booking access until the correction is reviewed. Negative wallet is handled separately.'
          : dossier.ready
            ? hasCashDebt
              ? 'Negative wallet is a settlement warning. Marketplace visibility and participation stay visible, but final acceptance, service start, and payout release wait for settlement.'
              : 'Booking access can stay open after approval, subject to location freshness, service pricing, and app reachability.'
            : 'Dossier gaps keep booking access under review until identity, service profile, public media, and account readiness are clear.',
        status: hasHold ? 'BLOCKED' : hasCashDebt ? 'WARNING' : dossier.ready ? 'CLEAR' : 'REVIEW',
        tone: hasHold ? 'pill-danger' : hasCashDebt || !dossier.ready ? 'pill-warn' : 'pill-success',
        href: buildPartnerDetailTargetHref(provider.id, 'booking-gate'),
      },
      {
        id: 'settlement-warning',
        label: 'SETTLE',
        title: hasCashDebt ? 'Settlement warning' : 'No settlement warning',
        detail: hasCashDebt
          ? `${formatCurrency(cashDebtAmount)} company fee debt is a settlement warning. Marketplace visibility and participation stay visible, but final acceptance, service start, and payout release wait for settlement.`
          : 'No company fee debt is loaded. Settlement does not add a warning for this Partner.',
        status: hasCashDebt ? 'WARNING' : 'CLEAR',
        tone: hasCashDebt ? 'pill-warn' : 'pill-success',
        href: buildPartnerDetailTargetHref(provider.id, 'cash-debt'),
      },
      {
        id: 'account-hold-state',
        label: 'HOLD',
        title: hasHold ? 'Active Partner hold' : 'No active Partner hold',
        detail: hasHold
          ? (provider.blockedReason ?? 'Hold reason is missing. Add a clear operator note before release.')
          : 'Partner is not on account hold. Use Hold Partner only when correction is required.',
        status: hasHold ? 'ON HOLD' : 'CLEAR',
        tone: hasHold ? 'pill-danger' : 'pill-success',
        href: buildPartnerDetailTargetHref(provider.id, 'control-queue'),
      },
      {
        id: 'resubmission-needs',
        label: 'FIX',
        title: resubmissionCount ? 'Partner resubmission needed' : 'No resubmission needed',
        detail: resubmissionCount
          ? `${resubmissionPlan.items[0]?.target}: ${resubmissionPlan.items[0]?.reason}`
          : 'No rejected KYC, document, service profile, or public media item is waiting for correction.',
        status: resubmissionCount ? `${resubmissionCount} ITEM(S)` : 'CLEAR',
        tone: resubmissionCount ? 'pill-warn' : 'pill-success',
        href: buildPartnerDetailTargetHref(provider.id, 'review-history'),
      },
      {
        id: 'latest-review-event',
        label: 'LOG',
        title: latestReview ? latestReview.title : 'No review event yet',
        detail: latestReview
          ? `${latestReview.statusLabel} by ${latestReview.actorLabel} at ${latestReview.atLabel}.`
          : 'Approval, rejection, hold, release, and resubmission decisions will appear in review history.',
        status: latestReview ? latestReview.action : 'NO LOG',
        tone: latestReview ? 'pill-info' : 'pill-neutral',
        href: buildPartnerDetailTargetHref(provider.id, 'review-history'),
      },
    ],
  };
}
