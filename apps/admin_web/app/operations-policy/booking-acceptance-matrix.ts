import type { AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerAccountNeedsFollowUp,
  adminPartnerAlertChannelRoutesToFcm,
  adminPartnerBankReady,
  adminPartnerCanCompleteFinalGate,
  adminPartnerFinalGateHeld,
  adminPartnerHasEnabledPush,
  adminPartnerIdentityReady,
  adminPartnerLocationFresh,
  adminPartnerMarketplaceBlocked,
  adminPartnerWalletBalance,
  adminPreferredAcceptModeUsesFirstPickPriority,
  adminWalletGateBlocksFinalGate,
  normalizeAdminMarketplaceOpenMode,
  readPolicyNumber,
  readPolicyString,
  readPolicyStringFromKeys,
} from '../../lib/operations-policy';
import { formatDistance } from './policy-distance-format';
import { policyCountLabel } from './policy-copy';
import type { MetricCardKind } from '../../components/metric-card';

type BookingAcceptancePolicy = {
  readonly backupLocationFreshnessMinutes: number;
  readonly backupRadiusMeters: number;
  readonly customerFinalChoice: boolean;
  readonly hardWalletBlock: boolean;
  readonly immediateBackup: boolean;
  readonly pushReady: boolean;
  readonly responseWindowMinutes: number;
};

type BookingAcceptanceBaseline = {
  readonly locationFreshness: boolean;
  readonly radius: boolean;
  readonly timer: boolean;
};

export function buildBookingAcceptanceMatrix(
  settings: readonly AdminOperationalPolicySetting[],
  providers: readonly AdminProvider[],
) {
  const providerRows = [...providers];
  const policy = readBookingAcceptancePolicy(settings);
  const cards = buildBookingAcceptanceCards(policy, baselineForPolicy(policy));
  const impact = buildPartnerAcceptancePolicyImpact(providerRows, {
    backupLocationFreshnessMinutes: policy.backupLocationFreshnessMinutes,
    hardWalletBlock: policy.hardWalletBlock,
  });

  return {
    blockingCount: cards.filter((card) => card.blocking).length,
    sampledPartnerCount: providerRows.length,
    summary: buildBookingAcceptanceSummary(policy),
    cards,
    impact,
  };
}

function readBookingAcceptancePolicy(
  settings: readonly AdminOperationalPolicySetting[],
): BookingAcceptancePolicy {
  const policySettings = [...settings];
  const responseWindowMinutes =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes;
  const backupRadiusMeters =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const backupLocationFreshnessMinutes =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const preferredAcceptMode =
    readPolicyString(policySettings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode;
  const marketplaceOpenMode = normalizeAdminMarketplaceOpenMode(
    readPolicyStringFromKeys(policySettings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode,
  );
  const alertChannel =
    readPolicyString(policySettings, OPERATIONAL_POLICY_KEYS.partnerAlertChannel) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.partnerAlertChannel;
  const walletGate =
    readPolicyString(policySettings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate;

  return {
    backupLocationFreshnessMinutes,
    backupRadiusMeters,
    customerFinalChoice: adminPreferredAcceptModeUsesFirstPickPriority(preferredAcceptMode),
    hardWalletBlock: adminWalletGateBlocksFinalGate(walletGate),
    immediateBackup: marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW',
    pushReady: adminPartnerAlertChannelRoutesToFcm(alertChannel),
    responseWindowMinutes,
  };
}

function baselineForPolicy(policy: BookingAcceptancePolicy): BookingAcceptanceBaseline {
  return {
    locationFreshness:
      policy.backupLocationFreshnessMinutes ===
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes,
    radius: policy.backupRadiusMeters === 10000,
    timer: policy.responseWindowMinutes === 10,
  };
}

function buildBookingAcceptanceCards(policy: BookingAcceptancePolicy, baseline: BookingAcceptanceBaseline) {
  return [
    {
      title: 'First-pick response window',
      status: baseline.timer ? 'HANDS baseline' : 'Owner override',
      detail: `The first selected Partner has ${policyCountLabel(policy.responseWindowMinutes, 'minute')} before the request needs operator attention.`,
      operatorAction: baseline.timer
        ? 'Keep this at 10 minutes until live response-rate data says otherwise.'
        : 'Monitor customer wait complaints and first-pick acceptance rate before keeping this override.',
      className: baseline.timer ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baseline.timer ? 'pill-success' : 'pill-warn',
      blocking: !baseline.timer,
    },
    {
      title: 'Marketplace Partner pool',
      status: baseline.radius ? 'Default policy' : 'Custom policy',
      detail: `Marketplace participation currently uses ${formatDistance(policy.backupRadiusMeters)} as an operating alert and distance-ordering policy.`,
      operatorAction: baseline.radius
        ? 'This matches the current operating baseline for partner participation alerts.'
        : 'Review city supply, arrival time, and ignored marketplace alerts before changing policy.',
      className: baseline.radius ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baseline.radius ? 'pill-success' : 'pill-warn',
      blocking: !baseline.radius,
    },
    {
      title: 'Marketplace location freshness',
      status: baseline.locationFreshness
        ? `${ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes}m default`
        : 'Custom freshness',
      detail: `Marketplace Partner location freshness is checked at ${policyCountLabel(policy.backupLocationFreshnessMinutes, 'minute')} for operator confidence.`,
      operatorAction: baseline.locationFreshness
        ? 'This matches the low-cost stale threshold. Idle partners refresh at 60 minutes or 3000m movement; active bookings refresh every 30 minutes.'
        : 'If this is loosened, monitor stale-location participation and partner no-response rates.',
      className: baseline.locationFreshness ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baseline.locationFreshness ? 'pill-success' : 'pill-warn',
      blocking: !baseline.locationFreshness,
    },
    {
      title: 'Marketplace visibility timing',
      status: policy.immediateBackup ? 'Visible during wait' : 'Legacy value review',
      detail: policy.immediateBackup
        ? 'Nearby Partners can participate while the first-pick Partner is still deciding.'
        : 'Custom marketplace timing values need API review before rollout.',
      operatorAction: policy.immediateBackup
        ? 'This best matches the customer waiting screen where available marketplace Partners appear early.'
        : 'Keep immediate marketplace participation unless a new approved policy is added.',
      className: policy.immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: policy.immediateBackup ? 'pill-success' : 'pill-warn',
      blocking: !policy.immediateBackup,
    },
    {
      title: 'Customer final selection',
      status: policy.customerFinalChoice ? 'Customer controls' : 'Customer-choice conflict',
      detail: policy.customerFinalChoice
        ? 'Customer fallback selection applies when first-pick does not validly match first.'
        : 'This setting would remove the customer fallback choice step.',
      operatorAction: policy.customerFinalChoice
        ? 'Keep first-pick priority with customer fallback before production rollout.'
        : 'Return this policy to customer-confirm mode before production use.',
      className: policy.customerFinalChoice ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: policy.customerFinalChoice ? 'pill-success' : 'pill-danger',
      blocking: !policy.customerFinalChoice,
    },
    {
      title: 'Partner alert delivery',
      status: policy.pushReady ? 'Push enabled' : 'In-app first',
      detail: policy.pushReady
        ? 'Partner booking and marketplace participation alerts are ready to route through FCM.'
        : 'FCM readiness is not verified in this workspace; Partner booking and marketplace alerts stay in-app until monitoring evidence is available and the owner enables push routing.',
      operatorAction: policy.pushReady
        ? 'Monitor delivery failures, disabled devices, stale tokens, and retry audit evidence on the Notifications board.'
        : 'Keep this on in-app-first while operators watch notification monitoring and retry audit evidence; SMS stays under the deferred Phone Auth step.',
      className: policy.pushReady ? 'ops-task-done' : 'ops-task-pending',
      pillClass: policy.pushReady ? 'pill-success' : 'pill-info',
      blocking: false,
    },
    {
      title: 'Negative wallet gate',
      status: policy.hardWalletBlock ? 'Final gate hold' : 'Historical setting review',
      detail: policy.hardWalletBlock
        ? 'Partners with unpaid cash-service fee debt can stay visible, but final acceptance, service start, and payout release wait for settlement.'
        : 'Historical exception mode is retained for audit only. Final acceptance, service start, and payout release should remain blocked until settlement.',
      operatorAction: policy.hardWalletBlock
        ? 'This protects HANDS cash-fee collection without removing marketplace visibility.'
        : 'Reset to the final gate hold policy after reviewing the saved setting.',
      className: policy.hardWalletBlock ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: policy.hardWalletBlock ? 'pill-success' : 'pill-danger',
      blocking: !policy.hardWalletBlock,
    },
  ];
}

function buildBookingAcceptanceSummary(policy: BookingAcceptancePolicy) {
  return [
    {
      label: 'First-pick timer',
      value: `${policy.responseWindowMinutes} min`,
      helper: 'Partner accepts or the request needs operator attention.',
    },
    {
      label: 'Marketplace policy',
      value: formatDistance(policy.backupRadiusMeters),
      helper: 'Nearby partners who can participate.',
    },
    {
      label: 'Location freshness',
      value: `${policy.backupLocationFreshnessMinutes} min`,
      helper: 'Marketplace alerts flag older partner locations.',
    },
    {
      label: 'Marketplace timing',
      value: policy.immediateBackup ? 'Immediate' : 'Delayed',
      helper: 'Visibility during first-pick wait.',
    },
    {
      label: 'Final match',
      value: policy.customerFinalChoice ? 'Customer chooses' : 'Policy conflict',
      helper: 'Customer fallback selection remains available unless first-pick validly matches first.',
    },
  ];
}

function buildPartnerAcceptancePolicyImpact(
  providers: readonly AdminProvider[],
  policy: { readonly backupLocationFreshnessMinutes: number; readonly hardWalletBlock: boolean },
): Array<{
  helper: string;
  kind: MetricCardKind;
  label: string;
  scope: string;
  value: string;
}> {
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE'));
  const finalGateReadyPartners = providers.filter((provider) =>
    adminPartnerCanCompleteFinalGate(provider, {
      freshnessMinutes: policy.backupLocationFreshnessMinutes,
      hardWalletBlock: policy.hardWalletBlock,
    }),
  );
  const walletGateHeld = providers.filter((provider) => adminPartnerWalletBalance(provider) < 0);
  const identityBlocked = providers.filter((provider) => !adminPartnerIdentityReady(provider));
  const bankReview = providers.filter((provider) => !adminPartnerBankReady(provider));
  const locationBlocked = providers.filter(
    (provider) => !adminPartnerLocationFresh(provider, policy.backupLocationFreshnessMinutes, Date.now()),
  );
  const pushGaps = providers.filter((provider) => !adminPartnerHasEnabledPush(provider));
  const accountFollowUps = providers.filter((provider) => adminPartnerAccountNeedsFollowUp(provider));
  const softRecovery = providers.filter(
    (provider) =>
      !adminPartnerCanCompleteFinalGate(provider, {
        freshnessMinutes: policy.backupLocationFreshnessMinutes,
        hardWalletBlock: policy.hardWalletBlock,
      }) && !adminPartnerFinalGateHeld(provider, { hardWalletBlock: policy.hardWalletBlock }),
  );

  return [
    {
      label: 'Marketplace ready',
      value: finalGateReadyPartners.length.toString(),
      scope: finalGateReadyPartners.length ? 'Sample result' : 'Blocked',
      kind: finalGateReadyPartners.length ? 'record' : 'risk',
      helper: `${policyCountLabel(onlinePartners.length, 'online Partner')}, filtered by marketplace, location, push, and control readiness.`,
    },
    {
      label: 'Final gate held',
      value: providers
        .filter((provider) =>
          adminPartnerMarketplaceBlocked(provider, { hardWalletBlock: policy.hardWalletBlock }),
        )
        .length.toString(),
      scope: 'Needs action',
      kind: 'risk',
      helper: 'Account controls, identity failure, or negative wallet can hold final matching controls.',
    },
    {
      label: 'Cash debt gate',
      value: walletGateHeld.length.toString(),
      scope: walletGateHeld.length ? 'Needs action' : 'No follow-up',
      kind: walletGateHeld.length ? 'risk' : 'record',
      helper: policy.hardWalletBlock
        ? 'Negative wallet gates final acceptance, service start, and payout release.'
        : 'Negative wallet still needs settlement before final acceptance, service start, and payout release.',
    },
    {
      label: 'Identity block',
      value: identityBlocked.length.toString(),
      scope: identityBlocked.length ? 'Needs action' : 'No follow-up',
      kind: identityBlocked.length ? 'risk' : 'record',
      helper: 'Partner approval, KYC, and required CCCD/selfie documents are not all approved.',
    },
    {
      label: 'Bank review',
      value: bankReview.length.toString(),
      scope: 'Sample review',
      kind: bankReview.length ? 'action' : 'record',
      helper: 'Bank details are reviewed when the Partner requests wallet withdrawal or deposit support.',
    },
    {
      label: 'Location block',
      value: locationBlocked.length.toString(),
      scope: locationBlocked.length ? 'Needs action' : 'No follow-up',
      kind: locationBlocked.length ? 'risk' : 'record',
      helper: `Missing or older than ${policyCountLabel(policy.backupLocationFreshnessMinutes, 'minute')}, so marketplace matching should request a fresh location.`,
    },
    {
      label: 'Push gap',
      value: pushGaps.length.toString(),
      scope: pushGaps.length ? 'Needs action' : 'No follow-up',
      kind: pushGaps.length ? 'action' : 'record',
      helper: 'Partner may not receive first-pick or marketplace participation alerts.',
    },
    {
      label: 'Account follow-up',
      value: accountFollowUps.length.toString(),
      scope: accountFollowUps.length ? 'Needs action' : 'No follow-up',
      kind: accountFollowUps.length ? 'risk' : 'record',
      helper:
        'Blocked account, active admin hold, blocked device, session follow-up, or shared device record.',
    },
    {
      label: 'Readiness follow-up',
      value: softRecovery.length.toString(),
      scope: softRecovery.length ? 'Needs action' : 'No follow-up',
      kind: softRecovery.length ? 'action' : 'record',
      helper: 'Not ready now, but can be made ready through app open, push refresh, or manual follow-up.',
    },
  ];
}
