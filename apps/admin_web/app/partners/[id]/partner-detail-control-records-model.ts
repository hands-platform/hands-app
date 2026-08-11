import type { AdminAuditLog } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { partnerControlActionConfirmHref } from './partner-detail-control-action-confirmation';
import { shortRecordId } from './partner-detail-format';
import type { activePayoutHold } from './partner-detail-payout-security-model';
import { auditLogNoteText } from './partner-detail-record-helpers';
import type {
  PartnerAccountControlRow,
  PartnerReportControlPayoutHold,
  PartnerReportRow,
} from './partner-detail-reports-controls-section';
import type { PartnerOperatorNoteRow } from './partner-detail-operator-notes-section';
import type { ProviderDetail } from './partner-detail-types';

export function buildPartnerOperatorNoteRows(logs: readonly AdminAuditLog[]): PartnerOperatorNoteRow[] {
  return logs.slice(0, 6).map((log) => ({
    actorTargetLabel: `${marketplaceDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'System')} / ${marketplaceDisplayText(
      log.target,
    )}`,
    createdAt: log.createdAt,
    id: log.id,
    note: auditLogNoteText(log),
  }));
}

export function buildPartnerReportControlPayoutHold(
  payoutHold: ReturnType<typeof activePayoutHold>,
): PartnerReportControlPayoutHold | null {
  if (!payoutHold) return null;

  return {
    expiresAt: payoutHold.expiresAt,
    idLabel: shortRecordId(payoutHold.id),
    reason: payoutHold.reason,
    startsAt: payoutHold.startsAt,
    type: payoutHold.type,
  };
}

export function buildPartnerReportRows(provider: ProviderDetail): PartnerReportRow[] {
  return (provider.reports ?? []).map((report) => ({
    bookingHref: report.bookingId ? `/bookings/${report.bookingId}` : undefined,
    bookingLabel: report.bookingId ? shortRecordId(report.bookingId) : undefined,
    category: report.category,
    createdAt: report.createdAt,
    defaultControlType: report.severity === 'CRITICAL' ? 'ACCOUNT_BLOCK' : 'WARNING',
    details: report.details,
    id: report.id,
    resolutionNote: report.resolutionNote,
    severity: report.severity,
    smallLabel: shortRecordId(report.id),
    source: report.source,
    status: report.status,
    summary: report.summary,
  }));
}

export function buildPartnerAccountControlRows(provider: ProviderDetail): PartnerAccountControlRow[] {
  return (provider.sanctions ?? []).map((sanction) => ({
    expiresAt: sanction.expiresAt,
    id: sanction.id,
    liftControlHref:
      sanction.status === 'ACTIVE' ? partnerControlActionConfirmHref(provider.id, sanction.id) : undefined,
    reason: sanction.reason,
    reportLine: sanction.report ? `Report: ${sanction.report.category} / ${sanction.report.severity}` : null,
    smallLabel: shortRecordId(sanction.id),
    startsAt: sanction.startsAt,
    status: sanction.status,
    type: sanction.type,
  }));
}
