export type PartnerDetailSummaryRailItem = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

export function buildPartnerOperationsQuickRail({
  activityRecordCount,
  activityTypeLabel,
  backupRadiusMeters,
  cashDebtLabel,
  chatRetentionRowCount,
  connectedRecordLinkCount,
  dateFilterLabel,
  missingKycDocumentCount,
  openCashDebtEarningCount,
  operationsDigestCount,
  payoutStatus,
  responseWindowMinutes,
  unpaidNetDetail,
  bookingJourneyRowCount,
}: {
  readonly activityRecordCount: number;
  readonly activityTypeLabel: string;
  readonly backupRadiusMeters: number;
  readonly cashDebtLabel: string;
  readonly chatRetentionRowCount: number;
  readonly connectedRecordLinkCount: number;
  readonly dateFilterLabel: string;
  readonly missingKycDocumentCount: number;
  readonly openCashDebtEarningCount: number;
  readonly operationsDigestCount: number;
  readonly payoutStatus: string;
  readonly responseWindowMinutes: number;
  readonly unpaidNetDetail?: string;
  readonly bookingJourneyRowCount: number;
}): PartnerDetailSummaryRailItem[] {
  return [
    {
      href: '#partner-operations-digest',
      label: 'Digest',
      value: `${operationsDigestCount} lanes`,
      detail: 'Identity, wallet, booking, location, payout, tax, and app reachability.',
    },
    {
      href: '#partner-connected-operations-records',
      label: 'Linked records',
      value: `${connectedRecordLinkCount} links`,
      detail: 'Booking, chat, KYC, bank, tax, location, wallet, payout, and notes.',
    },
    {
      href: '#partner-booking-journey',
      label: 'Booking journey',
      value: `${bookingJourneyRowCount}`,
      detail: `${responseWindowMinutes}m first-pick / ${Math.round(
        backupRadiusMeters / 1000,
      )}km marketplace policy.`,
    },
    {
      href: '#partner-chat-retention-ledger',
      label: 'Chat archive',
      value: `${chatRetentionRowCount}`,
      detail: 'Customer-final-selected chats retained for admin evidence.',
    },
    {
      href: '#cash-debt-origin',
      label: 'Cash debt',
      value: cashDebtLabel,
      detail: `${openCashDebtEarningCount} unpaid cash fee earning row(s). Marketplace alerts and participation are blocked until settled.`,
    },
    {
      href: '#payout',
      label: 'Payout',
      value: payoutStatus,
      detail: unpaidNetDetail ?? 'No unpaid net.',
    },
    {
      href: '#documents',
      label: 'Documents',
      value: `${missingKycDocumentCount} missing`,
      detail: 'CCCD front/back, selfie, public profile, and typed onboarding files.',
    },
    {
      href: '#app-activity',
      label: 'Activity',
      value: `${activityRecordCount}`,
      detail: `${dateFilterLabel}, ${activityTypeLabel}.`,
    },
  ];
}
