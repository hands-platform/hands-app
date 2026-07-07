import type { ReactNode } from 'react';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { providerDocumentLabel } from '../../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import type { PartnerActivityRecord } from './partner-detail-activity-model';
import type { PartnerBookingArchiveBooking, PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import { amountValue, dateValue, formatCurrency, formatDate, locationAgeLabel, locationAgeMinutes, shortRecordId } from './partner-detail-format';

const ACTIVE_BOOKING_STATUSES: readonly string[] = ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'];
const STAFF_ACTIVITY_TYPES: readonly string[] = ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'];

export type PartnerOperationsDigestRow = {
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly evidence: readonly string[];
  readonly href: string;
  readonly lane: string;
  readonly latestAt?: string;
  readonly status: string;
  readonly tone: string;
};

type PartnerOperationsDigestEarning = {
  readonly booking?: { readonly payment?: { readonly method?: string | null } | null } | null;
  readonly createdAt?: string | null;
  readonly netAmount: number | string;
  readonly status: string;
};
type PartnerOperationsDigestProvider = {
  readonly activityNickname?: string | null;
  readonly agreements?: readonly unknown[] | null;
  readonly auditLogs?: readonly unknown[] | null;
  readonly blockedAt?: string | null;
  readonly city?: string | null;
  readonly currentLat?: string | number | null;
  readonly currentLng?: string | number | null;
  readonly currentLocationUpdatedAt?: string | null;
  readonly dateOfBirth?: string | null;
  readonly devices?: readonly { readonly createdAt?: string | null; readonly id?: string; readonly lastSeenAt?: string | null; readonly updatedAt?: string | null }[] | null;
  readonly displayName?: string | null;
  readonly documents?: readonly { readonly type?: string | null; readonly status?: string | null }[] | null;
  readonly earnings?: readonly PartnerOperationsDigestEarning[] | null;
  readonly gender?: string | null;
  readonly id?: string;
  readonly kyc?: { readonly reviewedAt?: string | null; readonly status?: string | null; readonly submittedAt?: string | null } | null;
  readonly legalName?: string | null;
  readonly locationSnapshots?: readonly { readonly recordedAt?: string | null }[] | null;
  readonly reports?: readonly unknown[] | null;
  readonly sanctions?: readonly unknown[] | null;
  readonly sessions?: readonly { readonly lastSeenAt?: string | null; readonly loggedInAt?: string | null }[] | null;
  readonly user?: { readonly createdAt?: string | null; readonly phone?: string | null; readonly pushDevices?: readonly { readonly enabled?: boolean | null }[] | null; readonly updatedAt?: string | null } | null;
  readonly verification?: { readonly files?: readonly unknown[] | null; readonly status?: string | null } | null;
  readonly verificationLogs?: readonly unknown[] | null;
};
type PartnerOperationsDigestBookingAcceptance = { readonly canJoinMarketplace: boolean; readonly primaryReason: string };
type PartnerOperationsDigestServicePricing = { readonly readyCount: number };
type PartnerOperationsDigestPolicy = { readonly backupRadiusMeters: number; readonly locationFreshnessMinutes: number };

export function buildPartnerOperationsDigest<TBooking extends PartnerBookingArchiveBooking>({
  provider,
  bookingArchive,
  bookingAcceptance,
  providerServicePricing,
  dispatchPolicy,
  activityRecords,
}: {
  readonly provider: PartnerOperationsDigestProvider;
  readonly bookingArchive: readonly PartnerBookingArchiveRecord<TBooking>[];
  readonly bookingAcceptance: PartnerOperationsDigestBookingAcceptance;
  readonly providerServicePricing: PartnerOperationsDigestServicePricing;
  readonly dispatchPolicy: PartnerOperationsDigestPolicy;
  readonly activityRecords: readonly PartnerActivityRecord[];
}): PartnerOperationsDigestRow[] {
  const activeBookings = bookingArchive.filter((record) => ACTIVE_BOOKING_STATUSES.includes(record.booking.status ?? ''));
  const completedBookings = bookingArchive.filter((record) => record.booking.status === 'COMPLETED');
  const chatRooms = bookingArchive.filter((record) => record.booking.chatRoom);
  const chatMessages = bookingArchive.reduce((sum, record) => sum + readPartnerChatMessages(record.booking).length, 0);
  const latestBooking = bookingArchive[0]?.booking;
  const latestAccessAt = latestPartnerAccessAt(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const missingKycDocs = missingApprovedRequiredKycDocuments(provider);
  const cashDebt = cashFeeDebtAmount(provider);
  const locationFresh = locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const latestStaffRecord = activityRecords.find((record) => STAFF_ACTIVITY_TYPES.includes(record.type));
  const latestLocationSaved =
    provider.currentLat !== null &&
    provider.currentLat !== undefined &&
    provider.currentLng !== null &&
    provider.currentLng !== undefined;

  return [
    {
      lane: 'Identity',
      status: provider.legalName?.trim() ? 'Profile linked' : 'Profile incomplete',
      detail: `${marketplaceDisplayText(provider.legalName ?? 'No legal name')} / ${provider.user?.phone ?? 'No phone'} / ${provider.city ?? 'No city'}`,
      href: '#partner-master-facts',
      latestAt: optionalDate(provider.user?.updatedAt ?? provider.user?.createdAt),
      tone: provider.legalName?.trim() ? 'pill-success' : 'pill-warn',
      evidence: [provider.activityNickname ?? provider.displayName ?? 'No activity name', provider.gender ?? 'No gender', formatDate(provider.dateOfBirth)],
    },
    {
      lane: 'Activity gate',
      status: bookingAcceptance.canJoinMarketplace ? 'Marketplace participation clear' : 'Marketplace participation on hold',
      detail: bookingAcceptance.primaryReason,
      href: '#final-booking-gate',
      latestAt: latestBooking?.createdAt,
      tone: bookingAcceptance.canJoinMarketplace ? 'pill-success' : 'pill-warn',
      evidence: [`${providerServicePricing.readyCount} bookable option(s)`, cashDebt > 0 ? `${formatCurrency(cashDebt)} cash fee debt` : 'Cash fee clear', provider.blockedAt ? 'Account held' : 'Account open'],
    },
    {
      lane: 'Bookings',
      status: `${bookingArchive.length} total`,
      detail: latestBooking ? `Latest ${latestBooking.status ?? 'UNKNOWN'} / ${bookingServiceLabel(latestBooking)}.` : 'No preferred, selected, or marketplace participation booking is loaded.',
      href: '#booking-chat-records',
      latestAt: latestBooking?.createdAt,
      tone: activeBookings.length ? 'pill-info' : completedBookings.length ? 'pill-success' : 'pill-neutral',
      evidence: [`${activeBookings.length} active`, `${completedBookings.length} completed`, latestBooking ? shortRecordId(latestBooking.id) : 'No latest booking'],
    },
    {
      lane: 'Chat archive',
      status: `${chatRooms.length} room(s)`,
      detail: `${chatMessages} retained message(s). Admin keeps chat history after mobile closeout.`,
      href: '#booking-chat-records',
      latestAt: chatRooms[0]?.booking.chatRoom?.messages?.[0]?.createdAt ?? chatRooms[0]?.booking.createdAt,
      tone: chatRooms.length ? 'pill-success' : 'pill-neutral',
      evidence: ['Retained for admin', `${chatMessages} message(s)`, 'Customer coordination evidence'],
    },
    {
      lane: 'KYC and files',
      status: provider.kyc?.status ?? provider.verification?.status ?? 'DRAFT',
      detail: missingKycDocs.length > 0 ? `Missing approved file(s): ${missingKycDocs.map(providerDocumentLabel).join(', ')}.` : 'Required identity files are approved or ready for final decision.',
      href: '#kyc',
      latestAt: optionalDate(provider.kyc?.reviewedAt ?? provider.kyc?.submittedAt ?? provider.user?.createdAt),
      tone: missingKycDocs.length ? 'pill-warn' : 'pill-success',
      evidence: [`${provider.documents?.length ?? 0} document row(s)`, `${provider.verification?.files?.length ?? 0} verification file(s)`, `Profile ${provider.verification?.status ?? 'DRAFT'}`],
    },
    {
      lane: 'Location',
      status: locationAgeLabel(provider.currentLocationUpdatedAt),
      detail: latestLocationSaved
        ? `Latest Partner location saved for dispatch checks. Policy freshness ${dispatchPolicy.locationFreshnessMinutes}m.`
        : 'No latest location pin is saved.',
      href: '#location',
      latestAt: optionalDate(provider.currentLocationUpdatedAt ?? provider.locationSnapshots?.[0]?.recordedAt),
      tone: locationFresh ? 'pill-success' : 'pill-warn',
      evidence: [`${provider.locationSnapshots?.length ?? 0} record(s)`, `${Math.round(dispatchPolicy.backupRadiusMeters / 1000)}km marketplace radius`, locationFresh ? 'Fresh enough' : 'Refresh needed'],
    },
    {
      lane: 'App reachability',
      status: enabledPushCount > 0 ? 'Push-ready' : 'Push missing',
      detail: latestAccessAt ? `Last app access ${formatDate(latestAccessAt)}.` : 'No app access row is loaded for this partner.',
      href: '#app-activity',
      latestAt: latestAccessAt ?? undefined,
      tone: enabledPushCount > 0 ? 'pill-success' : 'pill-warn',
      evidence: [`${provider.devices?.length ?? 0} device row(s)`, `${provider.sessions?.length ?? 0} session row(s)`, `${enabledPushCount} enabled push device(s)`],
    },
    {
      lane: 'Staff trail',
      status: `${provider.auditLogs?.length ?? 0} audit row(s)`,
      detail: latestStaffRecord ? `${latestStaffRecord.title} / ${latestStaffRecord.detail}` : 'No staff record appears in the selected filter.',
      href: '#partner-operator-notes',
      latestAt: latestStaffRecord?.at,
      tone: latestStaffRecord ? 'pill-info' : 'pill-neutral',
      evidence: [`${provider.verificationLogs?.length ?? 0} verification log(s)`, `${provider.reports?.length ?? 0} report row(s)`, `${provider.sanctions?.length ?? 0} account control row(s)`],
    },
  ];
}

function latestPartnerAccessAt(provider: PartnerOperationsDigestProvider) {
  return [...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]), ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt])].filter(Boolean).sort((left, right) => dateValue(right) - dateValue(left))[0];
}

function optionalDate(value?: string | null) {
  return value ?? undefined;
}

function readPartnerChatMessages(booking: PartnerBookingArchiveBooking) {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt));
}

function missingApprovedRequiredKycDocuments(provider: PartnerOperationsDigestProvider) {
  const approvedDocuments = new Set((provider.documents ?? []).filter((document) => document.status === 'APPROVED').map((document) => document.type));
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

function isCashFeeDebt(earning: PartnerOperationsDigestEarning) {
  return amountValue(earning.netAmount) < 0 && earning.booking?.payment?.method === 'CASH' && earning.status !== 'PAID';
}

function cashFeeDebtAmount(provider: PartnerOperationsDigestProvider) {
  return (provider.earnings ?? []).filter(isCashFeeDebt).reduce((total, earning) => total + Math.abs(amountValue(earning.netAmount)), 0);
}

function bookingServiceLabel(booking: PartnerBookingArchiveBooking) {
  const labels = (booking.services ?? []).map((item) => `${item.service?.name ?? 'Service'}${item.service?.durationMin ? ` ${item.service.durationMin}m` : ''}`).filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service';
}
