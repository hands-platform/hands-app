import { adminActionTitleText } from '../../../lib/admin-copy';
import type { PartnerReviewHistoryRow } from './partner-detail-review-progress-section';
import { formatDate, metadataPreview } from './partner-detail-format';

type PartnerReviewLog = {
  readonly action: string;
  readonly actor?: { readonly fullName?: string | null; readonly phone?: string | null } | null;
  readonly createdAt: string;
  readonly fromStatus?: string | null;
  readonly id: string;
  readonly metadata?: unknown;
  readonly toStatus?: string | null;
};

type PartnerReviewHistoryProvider = {
  readonly verificationLogs?: readonly PartnerReviewLog[] | null;
};

export function buildPartnerReviewHistoryRows(
  provider: PartnerReviewHistoryProvider,
): PartnerReviewHistoryRow[] {
  return (provider.verificationLogs ?? []).slice(0, 8).map((log) => ({
    action: log.action,
    actorLabel: log.actor?.fullName ?? log.actor?.phone ?? 'System',
    atLabel: formatDate(log.createdAt),
    id: log.id,
    preview: metadataPreview(log.metadata),
    statusLabel: partnerReviewStatusTransition(log),
    title: adminActionTitleText(log.action),
  }));
}

export function partnerReviewStatusTransition(log: PartnerReviewLog) {
  if (log.fromStatus || log.toStatus) {
    return `${log.fromStatus ?? 'New'} -> ${log.toStatus ?? 'Unknown'}`;
  }
  return 'Decision recorded';
}
