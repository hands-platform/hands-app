import type { ReactNode } from 'react';

import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';

type PartnerDetailFullRecordIndexSectionProps = {
  readonly appActivityCount: number;
  readonly bookingRecordCount: number;
  readonly cashDebtLabel: ReactNode;
  readonly dailyDigestCount: number;
  readonly missingKycDocumentCount: number;
};

export function PartnerDetailFullRecordIndexSection({
  appActivityCount,
  bookingRecordCount,
  cashDebtLabel,
  dailyDigestCount,
  missingKycDocumentCount,
}: PartnerDetailFullRecordIndexSectionProps) {
  return (
    <AdminCard className="admin-mb-16" id="partner-full-record-index">
      <AdminSectionHeader
        actions={<StatusBadge tone="info">{bookingRecordCount} booking record(s)</StatusBadge>}
        description="Factual partner record map for operators. Use these links to jump to identity, booking/chat, payout, documents, app activity, agreements, and review history inside this partner detail record."
        title="Partner full record index"
      />
      <div className="service-trace-summary admin-mt-12">
        <a href="#booking-chat-records">
          <span>Booking and chat</span>
          <strong>{bookingRecordCount}</strong>
          <small>Preferred, selected, and marketplace participation requests.</small>
        </a>
        <a href="#payout">
          <span>Wallet and payout</span>
          <strong>{cashDebtLabel}</strong>
          <small>Cash fee debt and payout status.</small>
        </a>
        <a href="#documents">
          <span>KYC documents</span>
          <strong>{missingKycDocumentCount} missing</strong>
          <small>CCCD front/back and selfie evidence.</small>
        </a>
        <a href="#app-activity">
          <span>App activity</span>
          <strong>{appActivityCount}</strong>
          <small>Sessions, devices, push, and location records.</small>
        </a>
        <a href="#partner-daily-digest">
          <span>Daily digest</span>
          <strong>{dailyDigestCount}</strong>
          <small>Date-grouped partner operations records.</small>
        </a>
      </div>
    </AdminCard>
  );
}
