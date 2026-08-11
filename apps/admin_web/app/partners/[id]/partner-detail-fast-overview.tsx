import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { buildPartnerControlDetailsHref } from '../../partner-controls/partner-control-page-load-plan';
import {
  countDistinctActivePartnerBookings,
  type PartnerBookingArchiveRecord,
} from './partner-detail-booking-model';
import {
  PartnerDetailFastOverviewSection,
  type PartnerDetailFastActionItem,
  type PartnerDetailFastOverviewLink,
  type PartnerDetailFastWorkItem,
} from './partner-detail-fast-overview-section';
import { formatDate, locationAgeLabel, locationAgeMinutes, shortRecordId } from './partner-detail-format';
import {
  buildPartnerOperationalChecks,
  openPartnerOperationalChecks,
  partnerOperationalDomainLabel,
  type PartnerOperationalCheck,
} from './partner-detail-operational-status-model';
import { bookingServiceLabel, type PartnerDetailBooking } from './partner-detail-record-helpers';
import { partnerOpsPillClass, type PartnerOpsTone } from './partner-detail-tone';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';
import { buildPartnerDetailWorkspaceHref } from './partner-detail-workspace-model';

type PartnerFastOverviewKycEvidence = {
  readonly allRequiredApproved: boolean;
  readonly missingDocuments: readonly string[];
  readonly nextAction: string;
};

type PartnerFastOverviewPayoutOps = {
  readonly blockers: readonly string[];
  readonly hold?: { readonly reason: string } | null;
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

type PartnerFastOverviewServicePricing = {
  readonly readyCount: number;
  readonly rows: readonly unknown[];
};

type PartnerDetailFastOverviewProps = {
  readonly bookingArchive: readonly PartnerBookingArchiveRecord<PartnerDetailBooking>[];
  readonly cashDebt: number;
  readonly dispatchPolicy: PartnerDispatchPolicy;
  readonly kycEvidence: PartnerFastOverviewKycEvidence;
  readonly latestAccessAt?: string | null;
  readonly payoutOps: PartnerFastOverviewPayoutOps;
  readonly provider: ProviderDetail;
  readonly servicePricing: PartnerFastOverviewServicePricing;
};

export function PartnerDetailFastOverview({
  bookingArchive,
  cashDebt,
  dispatchPolicy,
  kycEvidence,
  latestAccessAt,
  payoutOps,
  provider,
  servicePricing,
}: PartnerDetailFastOverviewProps) {
  const partnerName = marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
  const latestBooking = bookingArchive[0]?.booking;
  const activeBookingCount = countDistinctActivePartnerBookings(bookingArchive);
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const locationFresh =
    Number.isFinite(locationMinutes) && locationMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const pushEnabled = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const profileComplete = Boolean(
    provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim(),
  );
  const checks = buildPartnerOperationalChecks({
    accountBlocked: Boolean(provider.blockedAt),
    accountBlockedReason: provider.blockedReason,
    activeBookingCount,
    activeBookingsHref: buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'journey'),
    availabilityChangedAtLabel: provider.availabilitySummary?.availabilityChangedAt
      ? formatDate(provider.availabilitySummary.availabilityChangedAt)
      : null,
    availabilityIntent: provider.availabilitySummary?.availabilityIntent,
    availabilityReason: provider.availabilitySummary?.availabilityReason,
    appActivityStatus: provider.appActivitySummary?.activityStatus ?? 'never_tracked',
    appLastActiveLabel: latestAccessAt ? formatDate(latestAccessAt) : null,
    bookableServiceCount: servicePricing.readyCount,
    cashDebtLabel: String(cashDebt),
    cashDebtOpen: cashDebt > 0,
    kycStatus: provider.kyc?.status,
    locationDetail: provider.currentLocationUpdatedAt
      ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`
      : 'No Partner location has been saved.',
    locationFresh,
    missingKycDocumentCount: kycEvidence.missingDocuments.length,
    nextAvailableAtLabel: provider.nextAvailableAt ? formatDate(provider.nextAvailableAt) : null,
    partnerStatus: provider.status,
    payoutHoldReason: payoutOps.hold?.reason,
    profileComplete,
    profileStatus: provider.verification?.status,
    pushEnabled,
    scheduleConfigured: provider.availabilitySummary?.scheduleConfigured,
    todayWorkingHoursLabel: provider.availabilitySummary?.todayWindowLabel,
    withinWorkingHours: provider.availabilitySummary?.withinWorkingHours,
  });
  const openChecks = openPartnerOperationalChecks(checks).slice(0, 5);
  const actionItems: PartnerDetailFastActionItem[] = openChecks.map((check) => ({
    area: partnerOperationalDomainLabel(check.domain),
    completion: completionCondition(check),
    href: resolveOverviewCheckHref(provider.id, check),
    id: check.id,
    impact: check.detail,
    nextAction: check.actionLabel,
    problem: check.title,
    status: check.status,
    tone: partnerOpsPillClass(check.tone),
  }));
  const approvalChecks = checks.filter((check) => check.domain === 'ACCOUNT' || check.domain === 'APPROVAL');
  const serviceCheck = checks.find((check) => check.id === 'bookable-services');
  const availabilityCheck = checks.find((check) => check.id === 'availability-reason');
  const financeChecks = checks.filter((check) => check.domain === 'FINANCE');
  const payoutReason =
    payoutOps.blockers[0] ??
    payoutOps.hold?.reason ??
    (payoutOps.status === 'DEFERRED'
      ? 'Not eligible yet — no payable earning.'
      : 'No payout blocker is recorded.');
  const workItems: PartnerDetailFastWorkItem[] = [
    statusLane(
      'Approval',
      approvalChecks,
      buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'approval'),
      approvalChecks.some((check) => check.open) ? 'Profile or KYC approval is incomplete.' : 'Profile and KYC are approved.',
    ),
    statusLane(
      'Service',
      serviceCheck ? [serviceCheck] : [],
      buildPartnerDetailWorkspaceHref(provider.id, 'access', 'readiness'),
      serviceCheck?.detail ?? 'No service readiness data is available.',
    ),
    statusLane(
      'Availability',
      availabilityCheck ? [availabilityCheck] : [],
      buildPartnerDetailWorkspaceHref(provider.id, 'access', 'readiness'),
      availabilityCheck?.detail ?? 'No availability data is available.',
    ),
    statusLane(
      'Wallet',
      financeChecks,
      buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'finance'),
      cashDebt > 0 ? <><MoneyText amount={cashDebt} /> owed by Partner. {payoutReason}</> : provider.activitySummary?.walletBalance && provider.activitySummary.walletBalance > 0 ? <><MoneyText amount={provider.activitySummary.walletBalance} /> held for Partner. {payoutReason}</> : payoutReason,
    ),
  ];
  const workspaceLinks: PartnerDetailFastOverviewLink[] = [
    workspaceLink('Approval & profile', buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'approval'), approvalChecks),
    workspaceLink('Work readiness', buildPartnerDetailWorkspaceHref(provider.id, 'access', 'readiness'), checks.filter((check) => check.domain === 'WORK')),
    { detail: `${bookingArchive.length} linked booking record(s).`, href: buildPartnerDetailWorkspaceHref(provider.id, 'bookings', 'journey'), label: 'Booking evidence', status: `${bookingArchive.length} records`, tone: bookingArchive.length ? 'pill-info' : 'pill-neutral' },
    workspaceLink('Money', buildPartnerDetailWorkspaceHref(provider.id, 'dossier', 'finance'), financeChecks),
    { detail: 'Operator notes, reviews, reports, and account controls.', href: buildPartnerDetailWorkspaceHref(provider.id, 'control', 'records'), label: 'History & controls', status: 'Open', tone: 'pill-info' },
  ];

  return (
    <PartnerDetailFastOverviewSection
      accountControlsHref={buildPartnerControlDetailsHref('sanctions', { q: provider.id })}
      actionItems={actionItems}
      activityItems={[
        {
          at: latestBooking ? <DateTimeText fallback="Missing" value={latestBooking.updatedAt ?? latestBooking.createdAt} /> : undefined,
          detail: latestBooking ? `${shortRecordId(latestBooking.id)} / ${latestBooking.status} / ${bookingServiceLabel(latestBooking)}` : 'No linked booking record.',
          label: 'Latest booking',
        },
        {
          at: provider.currentLocationUpdatedAt ? <DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} /> : undefined,
          detail: provider.currentLocationUpdatedAt ? locationAgeLabel(provider.currentLocationUpdatedAt) : 'No saved Partner location.',
          label: 'Location',
        },
        {
          at: latestAccessAt ? <DateTimeText fallback="Missing" value={latestAccessAt} /> : undefined,
          detail: latestAccessAt ? 'Latest recorded Partner app activity.' : 'No Partner app activity recorded.',
          label: 'App access',
        },
      ]}
      chatHref={`/chat-archive?q=${encodeURIComponent(provider.id)}`}
      currentStatus={availabilityCheck?.status ?? provider.status}
      fullHref={`/partners/${provider.id}?section=full`}
      partnerName={partnerName}
      phone={provider.user?.phone}
      subtitle={`${provider.user?.phone ?? 'No phone'} / ${provider.city ?? 'No city'}`}
      workItems={workItems}
      workspaceLinks={workspaceLinks}
    />
  );
}

function statusLane(
  label: string,
  checks: readonly PartnerOperationalCheck[],
  href: string,
  detail: PartnerDetailFastWorkItem['detail'],
): PartnerDetailFastWorkItem {
  if (!checks.length) return { detail, href, label, status: 'No data', tone: 'pill-neutral' };
  if (checks.some((check) => check.tone === 'blocked' && check.open)) {
    return { detail, href, label, status: 'Blocked', tone: 'pill-danger' };
  }
  if (checks.some((check) => check.open || check.tone === 'pending')) {
    return { detail, href, label, status: 'Needs review', tone: 'pill-warn' };
  }
  return { detail, href, label, status: 'Ready', tone: 'pill-success' };
}

function workspaceLink(
  label: string,
  href: string,
  checks: readonly PartnerOperationalCheck[],
): PartnerDetailFastOverviewLink {
  const openCount = checks.filter((check) => check.open).length;
  return {
    detail: openCount ? `${openCount} unresolved issue(s).` : 'No unresolved issue.',
    href,
    label,
    status: openCount ? `${openCount} open` : 'Ready',
    tone: openCount ? 'pill-warn' : 'pill-success',
  };
}

function resolveOverviewCheckHref(partnerId: string, check: PartnerOperationalCheck) {
  if (check.domain === 'APPROVAL' || check.domain === 'ACCOUNT') {
    return buildPartnerDetailWorkspaceHref(partnerId, 'dossier', 'approval');
  }
  if (check.domain === 'FINANCE') {
    return buildPartnerDetailWorkspaceHref(partnerId, 'dossier', 'finance');
  }
  return buildPartnerDetailWorkspaceHref(partnerId, 'access', 'readiness');
}

function completionCondition(check: PartnerOperationalCheck) {
  switch (check.id) {
    case 'account-control': return 'The account hold is released after the recorded issue is resolved.';
    case 'profile-approval': return 'Required identity and public profile fields are approved.';
    case 'kyc-approval': return 'KYC and every required identity document are approved.';
    case 'bookable-services': return 'At least one approved, enabled service can be booked.';
    case 'location-freshness': return 'A Partner location is saved within the current freshness policy.';
    case 'push-reachability': return 'At least one enabled Partner push device is reachable.';
    case 'app-activity': return 'Partner app activity is recorded within seven days.';
    case 'availability-reason': return 'Partner availability matches the linked booking and saved work intent.';
    case 'cash-debt': return 'The Partner receivable is fully settled.';
    case 'payout-hold': return 'The payout hold is released with an audit reason.';
    default: return 'The source record no longer reports this issue.';
  }
}
