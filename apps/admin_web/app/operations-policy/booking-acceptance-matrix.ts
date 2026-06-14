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
  adminWalletGateBlocksMarketplaceParticipation,
  normalizeAdminMarketplaceOpenMode,
  readPolicyNumber,
  readPolicyString,
  readPolicyStringFromKeys,
} from '../../lib/operations-policy';
import { formatDistance } from './policy-simulation';

export function buildBookingAcceptanceMatrix(
  settings: readonly AdminOperationalPolicySetting[],
  providers: readonly AdminProvider[],
) {
  const policySettings = [...settings];
  const providerRows = [...providers];
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

  const customerFinalChoice = preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const immediateBackup = marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const pushReady = adminPartnerAlertChannelRoutesToFcm(alertChannel);
  const hardWalletBlock = adminWalletGateBlocksMarketplaceParticipation(walletGate);
  const baselineRadius = backupRadiusMeters === 10000;
  const baselineTimer = responseWindowMinutes === 10;
  const baselineLocationFreshness = backupLocationFreshnessMinutes === 30;

  const cards = [
    {
      title: 'First-pick response window',
      status: baselineTimer ? 'HANDS baseline' : 'Owner override',
      detail: `The first selected partner has ${responseWindowMinutes} minute(s) before the request needs operator attention.`,
      operatorAction: baselineTimer
        ? 'Keep this at 10 minutes until live response-rate data says otherwise.'
        : 'Monitor customer wait complaints and first-pick acceptance rate before keeping this override.',
      className: baselineTimer ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineTimer ? 'pill-success' : 'pill-warn',
      blocking: !baselineTimer,
    },
    {
      title: 'Marketplace Partner pool',
      status: baselineRadius ? 'Default policy' : 'Custom policy',
      detail: `Marketplace participation currently uses ${formatDistance(backupRadiusMeters)} as an operating alert and distance-ordering policy.`,
      operatorAction: baselineRadius
        ? 'This matches the current operating baseline for partner participation alerts.'
        : 'Review city supply, arrival time, and ignored marketplace alerts before changing policy.',
      className: baselineRadius ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineRadius ? 'pill-success' : 'pill-warn',
      blocking: !baselineRadius,
    },
    {
      title: 'Marketplace location freshness',
      status: baselineLocationFreshness ? '30m default' : 'Custom freshness',
      detail: `Marketplace Partner location freshness is checked at ${backupLocationFreshnessMinutes} minute(s) for operator confidence.`,
      operatorAction: baselineLocationFreshness
        ? 'This matches the partner app rule that refreshes location every 10 minutes while open.'
        : 'If this is loosened, monitor stale-location participation and partner no-response rates.',
      className: baselineLocationFreshness ? 'ops-task-done' : 'ops-task-pending',
      pillClass: baselineLocationFreshness ? 'pill-success' : 'pill-warn',
      blocking: !baselineLocationFreshness,
    },
    {
      title: 'Marketplace visibility timing',
      status: immediateBackup ? 'Visible during wait' : 'Legacy value review',
      detail: immediateBackup
        ? 'Nearby Partners can participate while the first-pick Partner is still deciding.'
        : 'Custom marketplace timing values need API review before rollout.',
      operatorAction: immediateBackup
        ? 'This best matches the customer waiting screen where available marketplace Partners appear early.'
        : 'Keep immediate marketplace participation unless a new approved policy is added.',
      className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      blocking: !immediateBackup,
    },
    {
      title: 'Customer final selection',
      status: customerFinalChoice ? 'Customer controls' : 'Customer-choice conflict',
      detail: customerFinalChoice
        ? 'Customer fallback selection applies when first-pick does not validly match first.'
        : 'This setting would remove the customer fallback choice step.',
      operatorAction: customerFinalChoice
        ? 'Keep first-pick priority with customer fallback before production rollout.'
        : 'Return this policy to customer-confirm mode before production use.',
      className: customerFinalChoice ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: customerFinalChoice ? 'pill-success' : 'pill-danger',
      blocking: !customerFinalChoice,
    },
    {
      title: 'Partner alert delivery',
      status: pushReady ? 'Push enabled' : 'In-app first',
      detail: pushReady
        ? 'Partner booking and marketplace participation alerts are ready to route through FCM.'
        : 'Booking notifications are recorded in-app until FCM production setup is fully ready.',
      operatorAction: pushReady
        ? 'Monitor delivery failures and disabled devices on the Notifications board.'
        : 'Keep this until FCM and production SMS credentials/monitoring are complete.',
      className: pushReady ? 'ops-task-done' : 'ops-task-pending',
      pillClass: pushReady ? 'pill-success' : 'pill-info',
      blocking: false,
    },
    {
      title: 'Negative wallet gate',
      status: hardWalletBlock ? 'Marketplace hold' : 'Historical setting review',
      detail: hardWalletBlock
        ? 'Partners with unpaid cash-service fee debt can stay visible, but final acceptance, service start, and payout release wait for settlement.'
        : 'Historical exception mode is retained for audit only. Final acceptance, service start, and payout release should remain blocked until settlement.',
      operatorAction: hardWalletBlock
        ? 'This protects HANDS cash-fee collection without removing marketplace visibility.'
        : 'Reset to the marketplace hold policy after reviewing the saved setting.',
      className: hardWalletBlock ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: hardWalletBlock ? 'pill-success' : 'pill-danger',
      blocking: !hardWalletBlock,
    },
  ];
  const impact = buildPartnerAcceptancePolicyImpact(providerRows, {
    backupLocationFreshnessMinutes,
    hardWalletBlock,
  });

  return {
    blockingCount: cards.filter((card) => card.blocking).length,
    summary: [
      {
        label: 'First-pick timer',
        value: `${responseWindowMinutes} min`,
        helper: 'Partner accepts or the request needs operator attention.',
      },
      {
        label: 'Marketplace policy',
        value: formatDistance(backupRadiusMeters),
        helper: 'Nearby partners who can participate.',
      },
      {
        label: 'Location freshness',
        value: `${backupLocationFreshnessMinutes} min`,
        helper: 'Marketplace alerts flag older partner locations.',
      },
      {
        label: 'Marketplace timing',
        value: immediateBackup ? 'Immediate' : 'Delayed',
        helper: 'Visibility during first-pick wait.',
      },
      {
        label: 'Final match',
        value: customerFinalChoice ? 'Customer chooses' : 'Policy conflict',
        helper: 'Customer fallback selection remains available unless first-pick validly matches first.',
      },
    ],
    cards,
    impact,
  };
}

function buildPartnerAcceptancePolicyImpact(
  providers: readonly AdminProvider[],
  policy: { readonly backupLocationFreshnessMinutes: number; readonly hardWalletBlock: boolean },
) {
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE'));
  const finalGateReadyPartners = providers.filter((provider) =>
    adminPartnerCanCompleteFinalGate(provider, {
      freshnessMinutes: policy.backupLocationFreshnessMinutes,
      hardWalletBlock: policy.hardWalletBlock,
    }),
  );
  const walletGateHeld = providers.filter((provider) => adminPartnerWalletBalance(provider) < 0);
  const identityBlocked = providers.filter((provider) => !adminPartnerIdentityReady(provider));
  const bankBlocked = providers.filter((provider) => !adminPartnerBankReady(provider));
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
      }) &&
      !adminPartnerFinalGateHeld(provider, { hardWalletBlock: policy.hardWalletBlock }),
  );

  return [
    {
      label: 'Marketplace ready',
      value: finalGateReadyPartners.length.toString(),
      helper: `${onlinePartners.length} online partner(s), filtered by marketplace, location, push, and control readiness.`,
    },
    {
      label: 'Marketplace held',
      value: providers
        .filter((provider) => adminPartnerMarketplaceBlocked(provider, { hardWalletBlock: policy.hardWalletBlock }))
        .length.toString(),
      helper:
        'Account controls, identity failure, missing approved bank, or negative wallet can hold marketplace alerts and participation.',
    },
    {
      label: 'Cash debt gate',
      value: walletGateHeld.length.toString(),
      helper: policy.hardWalletBlock
        ? 'Negative wallet gates final acceptance, service start, and payout release.'
        : 'Negative wallet still needs settlement before final acceptance, service start, and payout release.',
    },
    {
      label: 'Identity block',
      value: identityBlocked.length.toString(),
      helper: 'Partner approval, KYC, and required CCCD/selfie documents are not all approved.',
    },
    {
      label: 'Bank block',
      value: bankBlocked.length.toString(),
      helper: 'No approved bank account is available, so paid work acceptance should stay blocked.',
    },
    {
      label: 'Location block',
      value: locationBlocked.length.toString(),
      helper: `Missing or older than ${policy.backupLocationFreshnessMinutes} minute(s), so marketplace matching should request a fresh location.`,
    },
    {
      label: 'Push gap',
      value: pushGaps.length.toString(),
      helper: 'Partner may not receive first-pick or marketplace participation alerts.',
    },
    {
      label: 'Account follow-up',
      value: accountFollowUps.length.toString(),
      helper:
        'Blocked account, active admin hold, blocked device, session follow-up, or shared device record.',
    },
    {
      label: 'Readiness follow-up',
      value: softRecovery.length.toString(),
      helper: 'Not ready now, but can be made ready through app open, push refresh, or manual follow-up.',
    },
  ];
}
