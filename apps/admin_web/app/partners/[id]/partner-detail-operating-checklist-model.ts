import { buildProviderBookingAcceptance } from './partner-detail-acceptance-model';
import { buildProviderServicePricing } from './partner-detail-command-model';
import {
  locationAgeLabel,
  locationAgeMinutes,
} from './partner-detail-format';
import { missingApprovedRequiredKycDocuments } from './partner-detail-kyc-evidence-model';
import type {
  PartnerDispatchPolicy,
  ProviderDetail,
} from './partner-detail-types';
import { partnerDetailWorkspaceHref } from './partner-detail-workspace-model';

type PartnerChecklistTone = 'blocked' | 'done' | 'pending';

export type PartnerOperatingChecklistRow = {
  readonly area: string;
  readonly detail: string;
  readonly href: string;
  readonly nextAction: string;
  readonly status: string;
  readonly tone: PartnerChecklistTone;
};

export function buildPartnerOperatingChecklist(
  provider: ProviderDetail,
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>,
  providerServicePricing: ReturnType<typeof buildProviderServicePricing>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerOperatingChecklistRow[] {
  const missingKycDocs = missingApprovedRequiredKycDocuments(provider);
  const locationMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  const locationFresh = locationMinutes <= dispatchPolicy.locationFreshnessMinutes;
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const deviceCount = provider.devices?.length ?? 0;
  const sessionCount = provider.sessions?.length ?? 0;

  return [
    {
      area: 'Account',
      status: provider.blockedAt ? 'Account hold' : 'Account open',
      detail: provider.blockedAt
        ? (provider.blockedReason ?? 'Account is held by admin.')
        : 'No account hold is currently recorded.',
      nextAction: provider.blockedAt ? 'Review account hold' : 'No account action',
      href: partnerDetailWorkspaceHref(provider.id, 'control', '#admin'),
      tone: provider.blockedAt ? 'blocked' : 'done',
    },
    {
      area: 'Level 2 approval',
      status:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'KYC and documents ready'
          : 'KYC or document review',
      detail:
        missingKycDocs.length > 0
          ? `Missing approved document(s): ${missingKycDocs.join(', ')}.`
          : `KYC ${provider.kyc?.status ?? 'DRAFT'} / profile ${provider.verification?.status ?? 'DRAFT'}.`,
      nextAction: missingKycDocs.length > 0 ? 'Review documents' : 'Check verification',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#kyc'),
      tone:
        provider.kyc?.status === 'APPROVED' && missingKycDocs.length === 0
          ? 'done'
          : provider.kyc?.status === 'REJECTED'
            ? 'blocked'
            : 'pending',
    },
    {
      area: 'Booking participation',
      status: bookingAcceptance.canJoinMarketplace
        ? 'Marketplace participation clear'
        : 'Marketplace participation on hold',
      detail: bookingAcceptance.primaryReason,
      nextAction: bookingAcceptance.canJoinMarketplace
        ? 'Ready for customer choice'
        : 'Resolve participation gate',
      href: partnerDetailWorkspaceHref(provider.id, 'bookings', '#booking-chat-records'),
      tone: bookingAcceptance.canJoinMarketplace ? 'done' : 'blocked',
    },
    {
      area: 'Services',
      status:
        providerServicePricing.readyCount > 0
          ? `${providerServicePricing.readyCount} bookable option(s)`
          : 'No bookable service price',
      detail: `${providerServicePricing.rows.length} service row(s) loaded. Prices must respect admin minimum and step policy.`,
      nextAction:
        providerServicePricing.readyCount > 0 ? 'Ready for service selection' : 'Fix service pricing',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#service-pricing'),
      tone: providerServicePricing.readyCount > 0 ? 'done' : 'blocked',
    },
    {
      area: 'App connection',
      status:
        locationFresh && enabledPushCount > 0
          ? 'Location and push ready'
          : locationFresh
            ? 'Push device missing'
            : 'Location refresh needed',
      detail: `Last location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}; ${enabledPushCount} enabled push device(s), ${deviceCount} device row(s), ${sessionCount} session row(s).`,
      nextAction:
        locationFresh && enabledPushCount > 0
          ? 'Can receive alerts'
          : !locationFresh
            ? 'Ask app reopen/location update'
            : 'Register device token',
      href: partnerDetailWorkspaceHref(provider.id, 'access', '#app-activity'),
      tone: locationFresh && enabledPushCount > 0 ? 'done' : 'pending',
    },
  ];
}
