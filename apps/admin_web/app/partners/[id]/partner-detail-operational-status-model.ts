export type PartnerOperationalDomain = 'ACCOUNT' | 'APPROVAL' | 'FINANCE' | 'WORK';

export type PartnerOperationalTone = 'blocked' | 'done' | 'pending';

export type PartnerAppActivityStatus = 'active' | 'inactive_7d' | 'never_tracked';

export type PartnerOperationalCheck = {
  readonly actionLabel: string;
  readonly detail: string;
  readonly domain: PartnerOperationalDomain;
  readonly href?: string;
  readonly id: string;
  readonly open: boolean;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerOperationalTone;
};

export type PartnerOperationalStatusInput = {
  readonly accountBlocked: boolean;
  readonly accountBlockedReason?: string | null;
  readonly activeBookingCount: number;
  readonly activeBookingsHref?: string;
  readonly availabilityChangedAtLabel?: string | null;
  readonly availabilityIntent?: 'AVAILABLE' | 'OFFLINE' | null;
  readonly availabilityReason?: string | null;
  readonly appActivityStatus: PartnerAppActivityStatus;
  readonly appLastActiveLabel?: string | null;
  readonly bookableServiceCount: number;
  readonly cashDebtLabel: string;
  readonly cashDebtOpen: boolean;
  readonly kycStatus?: string | null;
  readonly locationDetail: string;
  readonly locationFresh: boolean;
  readonly missingKycDocumentCount: number;
  readonly partnerStatus: string;
  readonly nextAvailableAtLabel?: string | null;
  readonly payoutHoldReason?: string | null;
  readonly profileComplete: boolean;
  readonly profileStatus?: string | null;
  readonly pushEnabled: boolean;
  readonly scheduleConfigured?: boolean;
  readonly todayWorkingHoursLabel?: string | null;
  readonly withinWorkingHours?: boolean;
};

export type PartnerAvailabilityDecision = Pick<
  PartnerOperationalCheck,
  'actionLabel' | 'detail' | 'open' | 'status' | 'tone'
>;

export function buildPartnerAvailabilityDecision(
  input: Pick<
    PartnerOperationalStatusInput,
    | 'activeBookingCount'
    | 'availabilityIntent'
    | 'availabilityReason'
    | 'appActivityStatus'
    | 'nextAvailableAtLabel'
    | 'partnerStatus'
    | 'scheduleConfigured'
    | 'todayWorkingHoursLabel'
    | 'withinWorkingHours'
  >,
): PartnerAvailabilityDecision {
  if (input.activeBookingCount > 0) {
    const workStatusMatchesActiveBooking =
      input.partnerStatus === 'ONLINE_BUSY' || input.partnerStatus === 'OFFLINE';
    return {
      actionLabel: 'Open active bookings',
      detail: workStatusMatchesActiveBooking
        ? `${input.activeBookingCount} active booking(s) explain why this Partner is not ready for new work.`
        : `${input.activeBookingCount} active booking(s) are linked, but Partner status is ${input.partnerStatus}. New matching should wait for a status refresh.`,
      open: !workStatusMatchesActiveBooking,
      status: workStatusMatchesActiveBooking ? 'Working now' : 'Status mismatch',
      tone: workStatusMatchesActiveBooking ? 'done' : 'blocked',
    };
  }

  if (input.partnerStatus === 'ONLINE_AVAILABLE') {
    return {
      actionLabel: 'No action',
      detail: 'Partner is online and ready to receive a new booking.',
      open: false,
      status: 'Ready now',
      tone: 'done',
    };
  }

  if (input.partnerStatus === 'ONLINE_AVAILABLE_SOON') {
    return {
      actionLabel: input.nextAvailableAtLabel ? 'Monitor availability' : 'Review availability time',
      detail: input.nextAvailableAtLabel
        ? `Partner is expected to become available at ${input.nextAvailableAtLabel}.`
        : 'Partner is marked available soon, but no next-available time is recorded.',
      open: !input.nextAvailableAtLabel,
      status: input.nextAvailableAtLabel ? 'Available soon' : 'Availability time missing',
      tone: 'pending',
    };
  }

  if (input.partnerStatus === 'ONLINE_BUSY') {
    return {
      actionLabel: 'Review booking state',
      detail: 'Partner is marked busy, but no active linked booking was found.',
      open: true,
      status: 'Status mismatch',
      tone: 'blocked',
    };
  }

  if (input.appActivityStatus === 'inactive_7d') {
    return {
      actionLabel: 'Contact Partner',
      detail: 'Partner is offline after at least 7 days without recorded app activity.',
      open: true,
      status: 'Inactive 7d+',
      tone: 'pending',
    };
  }

  if (input.availabilityReason === 'MANUAL_OFFLINE' || input.availabilityIntent === 'OFFLINE') {
    return {
      actionLabel: 'No action',
      detail: 'Partner manually turned work availability off.',
      open: false,
      status: 'Partner set offline',
      tone: 'pending',
    };
  }

  if (
    input.availabilityReason === 'OUTSIDE_WORKING_HOURS' ||
    (input.scheduleConfigured && input.withinWorkingHours === false)
  ) {
    return {
      actionLabel: 'No action',
      detail: input.todayWorkingHoursLabel
        ? `Partner is outside today's saved working hours (${input.todayWorkingHoursLabel}).`
        : 'Partner is outside saved working hours.',
      open: false,
      status: 'Outside working hours',
      tone: 'pending',
    };
  }

  if (input.appActivityStatus === 'active') {
    return {
      actionLabel: 'No action',
      detail:
        'Partner is offline with recent app activity. The current data does not record whether this was a manual switch or outside working hours.',
      open: false,
      status: 'Offline reason not recorded',
      tone: 'pending',
    };
  }

  return {
    actionLabel: 'No action',
    detail: 'Partner is offline and no app activity has been recorded yet.',
    open: false,
    status: 'No app activity',
    tone: 'pending',
  };
}

export function buildPartnerOperationalChecks(
  input: PartnerOperationalStatusInput,
): PartnerOperationalCheck[] {
  const kycApproved = input.kycStatus === 'APPROVED' && input.missingKycDocumentCount === 0;
  const profileApproved = input.profileStatus === 'APPROVED' && input.profileComplete;
  const profileStatus = input.profileComplete
    ? input.profileStatus === 'REJECTED'
      ? 'Profile rejected'
      : 'Profile review pending'
    : 'Profile incomplete';
  const appActivityTracked = input.appActivityStatus !== 'never_tracked';
  const appActivityOpen =
    input.appActivityStatus === 'inactive_7d' ||
    (!appActivityTracked && input.partnerStatus !== 'OFFLINE');
  const availabilityDecision = buildPartnerAvailabilityDecision(input);

  return [
    {
      actionLabel: input.accountBlocked ? 'Review account control' : 'No action',
      detail: input.accountBlocked
        ? input.accountBlockedReason?.trim() || 'The Partner account is blocked.'
        : 'No account-level block is active.',
      domain: 'ACCOUNT',
      href: input.accountBlocked ? '#partner-reports-controls-title' : undefined,
      id: 'account-control',
      open: input.accountBlocked,
      status: input.accountBlocked ? 'Blocked' : 'Clear',
      title: 'Account access',
      tone: input.accountBlocked ? 'blocked' : 'done',
    },
    {
      actionLabel: profileApproved ? 'No action' : 'Review profile',
      detail: profileApproved
        ? 'Required identity and public profile fields are approved.'
        : input.profileComplete
          ? `Profile review is ${input.profileStatus ?? 'DRAFT'}.`
          : 'Required identity or public profile fields are missing.',
      domain: 'APPROVAL',
      href: profileApproved ? undefined : '#basic-profile-title',
      id: 'profile-approval',
      open: !profileApproved,
      status: profileApproved ? 'Approved' : profileStatus,
      title: 'Profile approval',
      tone: profileApproved ? 'done' : input.profileStatus === 'REJECTED' ? 'blocked' : 'pending',
    },
    {
      actionLabel: kycApproved ? 'No action' : 'Review KYC evidence',
      detail: kycApproved
        ? 'KYC and all required identity documents are approved.'
        : input.missingKycDocumentCount > 0
          ? `${input.missingKycDocumentCount} required identity document(s) are missing or unapproved.`
          : `KYC decision is ${input.kycStatus ?? 'DRAFT'}.`,
      domain: 'APPROVAL',
      href: kycApproved ? undefined : '#kyc-title',
      id: 'kyc-approval',
      open: !kycApproved,
      status: kycApproved
        ? 'Approved'
        : input.missingKycDocumentCount > 0
          ? `${input.missingKycDocumentCount} documents missing`
          : input.kycStatus === 'REJECTED'
            ? 'KYC rejected'
            : 'KYC not submitted',
      title: 'KYC and documents',
      tone: kycApproved ? 'done' : input.kycStatus === 'REJECTED' ? 'blocked' : 'pending',
    },
    {
      actionLabel: input.bookableServiceCount > 0 ? 'No action' : 'Review service prices',
      detail:
        input.bookableServiceCount > 0
          ? `${input.bookableServiceCount} service option(s) can be booked.`
          : 'No approved and enabled service option is ready for customer booking.',
      domain: 'WORK',
      href: input.bookableServiceCount > 0 ? undefined : '#service-pricing-title',
      id: 'bookable-services',
      open: input.bookableServiceCount === 0,
      status: input.bookableServiceCount > 0 ? 'Bookable' : 'No bookable service',
      title: 'Bookable services',
      tone: input.bookableServiceCount > 0 ? 'done' : 'blocked',
    },
    {
      actionLabel: input.locationFresh ? 'No action' : 'Ask Partner to refresh location',
      detail: input.locationDetail,
      domain: 'WORK',
      href: input.locationFresh ? undefined : '#location-title',
      id: 'location-freshness',
      open: !input.locationFresh,
      status: input.locationFresh ? 'Fresh' : 'Location stale',
      title: 'Location freshness',
      tone: input.locationFresh ? 'done' : 'pending',
    },
    {
      actionLabel: input.pushEnabled ? 'No action' : 'Ask Partner to reopen the app',
      detail: input.pushEnabled
        ? 'At least one enabled Partner push device is available.'
        : 'No enabled push device can receive booking requests.',
      domain: 'WORK',
      id: 'push-reachability',
      open: !input.pushEnabled,
      status: input.pushEnabled ? 'Reachable' : 'No push device',
      title: 'App reachability',
      tone: input.pushEnabled ? 'done' : 'blocked',
    },
    {
      actionLabel: appActivityOpen ? 'Ask Partner to reopen the app' : 'No action',
      detail:
        input.appActivityStatus === 'active'
          ? `App activity was recorded within 7 days${input.appLastActiveLabel ? `, most recently ${input.appLastActiveLabel}` : ''}.`
          : input.appActivityStatus === 'inactive_7d'
            ? `No app activity has been recorded for at least 7 days${input.appLastActiveLabel ? `; last activity was ${input.appLastActiveLabel}` : ''}.`
            : 'No Partner app usage event has been recorded yet.',
      domain: 'WORK',
      id: 'app-activity',
      open: appActivityOpen,
      status:
        input.appActivityStatus === 'active'
          ? 'Active in 7d'
          : input.appActivityStatus === 'inactive_7d'
            ? 'Inactive 7d+'
            : 'No telemetry',
      title: 'Partner app activity',
      tone: input.appActivityStatus === 'active' ? 'done' : 'pending',
    },
    {
      actionLabel: availabilityDecision.actionLabel,
      detail: availabilityDecision.detail,
      domain: 'WORK',
      href: input.activeBookingCount > 0 ? input.activeBookingsHref : undefined,
      id: 'availability-reason',
      open: availabilityDecision.open && input.appActivityStatus !== 'inactive_7d',
      status: availabilityDecision.status,
      title: 'Availability reason',
      tone: availabilityDecision.tone,
    },
    {
      actionLabel: input.activeBookingCount > 0 ? 'Open active bookings' : 'No action',
      detail:
        input.activeBookingCount > 0
          ? `${input.activeBookingCount} distinct active booking(s) are linked to this Partner.`
          : 'No matched or in-service booking is currently linked to this Partner.',
      domain: 'WORK',
      href: input.activeBookingCount > 0 ? input.activeBookingsHref : undefined,
      id: 'active-booking',
      open: false,
      status: input.activeBookingCount > 0 ? `${input.activeBookingCount} active booking` : 'No active booking',
      title: 'Active booking',
      tone: input.activeBookingCount > 0 ? 'pending' : 'done',
    },
    {
      actionLabel: 'No action',
      detail: input.scheduleConfigured
        ? `Today ${input.todayWorkingHoursLabel || 'Day off'} / ${
            input.withinWorkingHours ? 'currently inside working hours' : 'currently outside working hours'
          }${input.availabilityChangedAtLabel ? ` / availability changed ${input.availabilityChangedAtLabel}` : ''}.`
        : 'No weekly working-hours schedule has been saved yet.',
      domain: 'WORK',
      id: 'work-schedule-data',
      open: false,
      status: input.scheduleConfigured
        ? input.withinWorkingHours
          ? 'Inside working hours'
          : 'Outside working hours'
        : 'Schedule not recorded',
      title: 'Working-hours data',
      tone: input.scheduleConfigured && input.withinWorkingHours ? 'done' : 'pending',
    },
    {
      actionLabel: input.cashDebtOpen ? 'Review wallet ledger' : 'No action',
      detail: input.cashDebtOpen
        ? `${input.cashDebtLabel} remains a Partner receivable from cash-service settlement.`
        : 'No cash-service receivable is open.',
      domain: 'FINANCE',
      href: input.cashDebtOpen ? '#partner-wallet-detail-title' : undefined,
      id: 'cash-debt',
      open: input.cashDebtOpen,
      status: input.cashDebtOpen ? 'Partner owes balance' : 'Clear',
      title: 'Wallet and cash debt',
      tone: input.cashDebtOpen ? 'blocked' : 'done',
    },
    {
      actionLabel: input.payoutHoldReason ? 'Review payout controls' : 'No action',
      detail: input.payoutHoldReason?.trim() || 'No active payout hold is recorded.',
      domain: 'FINANCE',
      href: input.payoutHoldReason ? '#payout-operations-title' : undefined,
      id: 'payout-hold',
      open: Boolean(input.payoutHoldReason),
      status: input.payoutHoldReason ? 'On hold' : 'Clear',
      title: 'Payout release',
      tone: input.payoutHoldReason ? 'pending' : 'done',
    },
  ];
}

export function openPartnerOperationalChecks(checks: readonly PartnerOperationalCheck[]) {
  return checks.filter((check) => check.open);
}

export function partnerOperationalDomainLabel(domain: PartnerOperationalDomain) {
  if (domain === 'ACCOUNT') return 'Account';
  if (domain === 'APPROVAL') return 'Approval';
  if (domain === 'FINANCE') return 'Finance';
  return 'Work';
}
