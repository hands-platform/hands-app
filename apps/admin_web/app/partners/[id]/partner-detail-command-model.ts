import {
  buildPartnerDetailOpsBadges,
  buildProviderBookingAcceptance,
} from './partner-detail-acceptance-model';
import { amountValue, formatDistance } from './partner-detail-format';
import { missingApprovedRequiredKycDocuments } from './partner-detail-kyc-evidence-model';
import type { PartnerOperatorCommand } from './partner-detail-operator-command-queue-section';
import type { PartnerReadinessSnapshotView } from './partner-detail-readiness-command-section';
import type {
  PartnerDispatchPolicy,
  ProviderDetail,
  ProviderOpsCard,
} from './partner-detail-types';
import { buildPartnerDetailTargetHref } from './partner-detail-workspace-model';

export type ProviderServicePricingRow = {
  id: string;
  name: string;
  durationMin?: number | null;
  basePrice: number;
  customerPrice: number;
  providerPayoutAmount: number | null;
  payoutRuleCount: number;
  bookable: boolean;
  issue: string;
};

export function buildProviderServicePricing(provider: ProviderDetail): {
  readyCount: number;
  rows: ProviderServicePricingRow[];
} {
  const rows = (provider.services ?? []).map((connection, index) => {
    const service = connection.service;
    const basePrice = amountValue(service?.basePrice);
    const customerPrice = amountValue(connection.price) || basePrice;
    const payoutRules = service?.payoutRules ?? [];
    const matchingRule = payoutRules.find((rule) => amountValue(rule.customerPrice) === customerPrice);
    const active = connection.active !== false && service?.active !== false;
    const bookable = active && Boolean(matchingRule);
    const issue = !active
      ? 'Partner or service option is inactive.'
      : matchingRule
        ? 'Ready for customer booking. Partner price has an exact payout rule.'
        : 'Hidden from customer app until admin creates a payout rule for this exact customer price.';

    return {
      id: connection.id ?? `${service?.id ?? 'service'}-${index}`,
      name: service?.name ?? 'Service',
      durationMin: service?.durationMin,
      basePrice,
      customerPrice,
      providerPayoutAmount: matchingRule ? amountValue(matchingRule.providerPayoutAmount) : null,
      payoutRuleCount: payoutRules.length,
      bookable,
      issue,
    };
  });

  return {
    readyCount: rows.filter((row) => row.bookable).length,
    rows,
  };
}

export function buildPartnerReadinessSnapshotView({
  provider,
  bookingAcceptance,
  dispatchPolicy,
}: {
  provider: ProviderDetail;
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>;
  dispatchPolicy: PartnerDispatchPolicy;
}): PartnerReadinessSnapshotView {
  const canJoinMarketplace = bookingAcceptance.canJoinMarketplace;

  return {
    badges: buildPartnerDetailOpsBadges(provider, bookingAcceptance, dispatchPolicy),
    gate: {
      detail: bookingAcceptance.primaryReason,
      helper: canJoinMarketplace
        ? `Marketplace radius ${formatDistance(dispatchPolicy.backupRadiusMeters)}`
        : 'Resolve join gate',
      label: canJoinMarketplace ? 'GO' : 'HOLD',
      title: canJoinMarketplace ? 'Marketplace participation ready' : 'Marketplace participation blocker',
    },
    status: bookingAcceptance.status,
    tone: bookingAcceptance.tone,
  };
}

export function buildPartnerOperatorCommandQueue({
  provider,
  bookingAcceptance,
  providerServicePricing,
  canApproveKyc,
}: {
  provider: ProviderDetail;
  bookingAcceptance: ReturnType<typeof buildProviderBookingAcceptance>;
  providerServicePricing: ReturnType<typeof buildProviderServicePricing>;
  canApproveKyc: boolean;
}) {
  const commands: PartnerOperatorCommand[] = [];
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const profileApproved = provider.verification?.status === 'APPROVED';
  const profileRejected = provider.verification?.status === 'REJECTED';
  const kycApproved = provider.kyc?.status === 'APPROVED';
  const kycRejected = provider.kyc?.status === 'REJECTED';

  const add = (command: PartnerOperatorCommand) => commands.push(command);

  if (provider.blockedAt) {
    add({
      id: 'account-block',
      label: 'ACCOUNT',
      title: 'Partner is on hold',
      detail: provider.blockedReason ?? 'Partner account is on hold. Review before restoring app access.',
      owner: 'Account control',
      tone: 'blocked',
      action: { type: 'unblock-account', label: 'Release hold' },
    });
  } else if (!profileApproved || !kycApproved) {
    add({
      id: 'account-hold',
      label: 'HOLD',
      title: 'Approval hold can be recorded',
      detail:
        'If this Partner needs corrections before approval, place the account on hold with a clear reason for Partner app follow-up.',
      owner: 'Account control',
      tone: 'pending',
      action: { type: 'hold-account', label: 'Hold Partner' },
    });
  }

  if (canApproveKyc && !kycApproved) {
    add({
      id: 'kyc-approve',
      label: 'KYC',
      title: 'KYC evidence is ready for approval',
      detail: 'Required CCCD front/back and selfie evidence are approved. Operator can approve KYC.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'approve-kyc', label: 'Approve KYC' },
    });
  } else if (missingDocuments.length > 0) {
    add({
      id: 'kyc-documents',
      label: 'KYC',
      title: 'KYC documents need review',
      detail: `Missing or not approved: ${missingDocuments.join(', ')}.`,
      owner: 'Verification',
      tone: 'pending',
      action: {
        type: 'link',
        href: buildPartnerDetailTargetHref(provider.id, 'documents'),
        label: 'Open docs',
      },
    });
  }

  if (provider.kyc && !kycApproved && !kycRejected) {
    add({
      id: 'kyc-reject',
      label: 'KYC',
      title: 'KYC can be sent back',
      detail: 'Use rejection only when the issue is clear enough for the Partner to correct and resubmit.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'reject-kyc', label: 'Reject KYC' },
    });
  }

  if (kycApproved && !profileApproved) {
    add({
      id: 'profile-approve',
      label: 'PROFILE',
      title: 'Public partner profile can be approved',
      detail:
        'KYC is approved. Review profile, photos, service area, and public-facing text before approval.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'approve-profile', label: 'Approve profile' },
    });
  }

  if (!profileApproved && !profileRejected) {
    add({
      id: 'profile-reject',
      label: 'PROFILE',
      title: 'Profile can be sent back',
      detail:
        'Reject the Partner profile only when the reason is specific enough for the Partner to correct.',
      owner: 'Verification',
      tone: 'pending',
      action: { type: 'reject-profile', label: 'Reject profile' },
    });
  }

  if (providerServicePricing.readyCount === 0) {
    add({
      id: 'service-pricing',
      label: 'SERVICE',
      title: 'No bookable service option',
      detail:
        'Partner needs at least one service duration priced at or above the admin minimum before customers can book.',
      owner: 'Catalog',
      tone: 'blocked',
      action: {
        type: 'link',
        href: buildPartnerDetailTargetHref(provider.id, 'service-pricing'),
        label: 'Open services',
      },
    });
  }

  if (commands.length === 0) {
    add({
      id: 'normal-monitoring',
      label: 'OK',
      title: 'Normal partner monitoring',
      detail:
        'No immediate operator action is visible. Continue monitoring bookings, app activity, and payout records.',
      owner: 'Operations',
      tone: 'done',
      action: {
        type: 'link',
        href: buildPartnerDetailTargetHref(provider.id, 'booking-evidence'),
        label: 'Open records',
      },
    });
  }

  const urgentCount = commands.filter((command) => command.tone === 'blocked').length;
  const pendingCount = commands.filter((command) => command.tone === 'pending').length;
  const queueTone: ProviderOpsCard['tone'] = urgentCount ? 'blocked' : pendingCount ? 'pending' : 'done';

  return {
    status: urgentCount ? `${urgentCount} blocker(s)` : pendingCount ? `${pendingCount} check(s)` : 'Clear',
    tone: queueTone,
    metrics: [
      {
        label: 'Booking gate',
        value: bookingAcceptance.canJoinMarketplace ? 'Ready' : 'Hold',
        helper: bookingAcceptance.primaryReason,
      },
      {
        label: 'KYC',
        value: kycApproved
          ? 'Approved'
          : missingDocuments.length
            ? `${missingDocuments.length} missing`
            : 'Review',
        helper: kycApproved ? 'Identity approval is complete.' : 'Resolve required identity evidence.',
      },
      {
        label: 'Profile',
        value: profileApproved ? 'Approved' : profileRejected ? 'Rejected' : 'Review',
        helper: 'Public Partner profile approval state.',
      },
      {
        label: 'Services',
        value: `${providerServicePricing.readyCount} ready`,
        helper:
          providerServicePricing.readyCount > 0
            ? 'Bookable service option is ready.'
            : 'Add one bookable service option.',
      },
    ],
    commands: commands.slice(0, 10),
  };
}
