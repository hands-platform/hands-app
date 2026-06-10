export type PartnerDetailSummaryRailItem = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

export function buildPartnerOperatorFirstRead({
  backupRadiusMeters,
  bookingRecordCount,
  cashDebtLabel,
  chatMessageCount,
  chatRetentionRowCount,
  displayLabel,
  hasCashFeeDebt,
  joinedAtLabel,
  latestStaffNoteDetail,
  locationRecordedAtLabel,
  noteCount,
  payoutBlockerDetail,
  payoutStatus,
  responseWindowMinutes,
  userPhone,
  nextActionDetail,
  nextActionStatus,
}: {
  readonly backupRadiusMeters: number;
  readonly bookingRecordCount: number;
  readonly cashDebtLabel: string;
  readonly chatMessageCount: number;
  readonly chatRetentionRowCount: number;
  readonly displayLabel: string;
  readonly hasCashFeeDebt: boolean;
  readonly joinedAtLabel: string;
  readonly latestStaffNoteDetail?: string;
  readonly locationRecordedAtLabel?: string;
  readonly noteCount: number;
  readonly payoutBlockerDetail?: string;
  readonly payoutStatus: string;
  readonly responseWindowMinutes: number;
  readonly userPhone?: string | null;
  readonly nextActionDetail: string;
  readonly nextActionStatus: string;
}): PartnerDetailSummaryRailItem[] {
  return [
    {
      href: '#partner-master-facts',
      label: 'Identity',
      value: displayLabel,
      detail: `${userPhone ?? 'No phone'} / joined ${joinedAtLabel}`,
    },
    {
      href: '#partner-booking-journey',
      label: 'Booking flow',
      value: `${bookingRecordCount} records`,
      detail: `${responseWindowMinutes}m first-pick / ${Math.round(
        backupRadiusMeters / 1000,
      )}km marketplace radius.`,
    },
    {
      href: '#cash-debt-origin',
      label: 'Marketplace access',
      value: hasCashFeeDebt ? 'Blocked by unpaid fee' : 'Open',
      detail: hasCashFeeDebt
        ? `${cashDebtLabel} company fee must be settled before joining.`
        : 'No unpaid cash fee debt loaded.',
    },
    {
      href: '#partner-chat-retention-ledger',
      label: 'Retained chat',
      value: `${chatMessageCount} messages`,
      detail: `${chatRetentionRowCount} room(s) retained for admin review after completion.`,
    },
    {
      href: '#payout',
      label: 'Payout',
      value: payoutStatus,
      detail: payoutBlockerDetail ?? 'Payout gate clear or deferred.',
    },
    {
      href: '#partner-ops-command-center',
      label: 'Next action',
      value: nextActionStatus,
      detail: nextActionDetail,
    },
    {
      href: '#partner-operator-notes',
      label: 'Latest staff note',
      value: `${noteCount} note(s)`,
      detail: latestStaffNoteDetail ?? 'No manual partner note saved.',
    },
    {
      href: '#location',
      label: 'Location',
      value: locationRecordedAtLabel ? 'Recorded' : 'No pin',
      detail: locationRecordedAtLabel ?? 'No latest partner location loaded.',
    },
  ];
}

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
