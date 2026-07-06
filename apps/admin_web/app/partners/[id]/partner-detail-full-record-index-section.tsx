import type { ReactNode } from 'react';

import { AdminTraceSummary } from '../../../components/admin-overview-card';
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
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'Preferred, selected, and marketplace participation requests.',
            href: '#booking-chat-records',
            label: 'Booking and chat',
            value: bookingRecordCount,
          },
          {
            detail: 'Cash fee debt and payout status.',
            href: '#payout',
            label: 'Wallet and payout',
            value: cashDebtLabel,
          },
          {
            detail: 'CCCD front/back and selfie evidence.',
            href: '#documents',
            label: 'KYC documents',
            value: `${missingKycDocumentCount} missing`,
          },
          {
            detail: 'Sessions, devices, push, and location records.',
            href: '#app-activity',
            label: 'App activity',
            value: appActivityCount,
          },
          {
            detail: 'Date-grouped partner operations records.',
            href: '#partner-daily-digest',
            label: 'Daily digest',
            value: dailyDigestCount,
          },
        ]}
      />
    </AdminCard>
  );
}
