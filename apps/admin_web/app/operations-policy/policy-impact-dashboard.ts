import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import {
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  normalizeAdminMarketplaceOpenMode,
} from '../../lib/operations-policy';
import { bookingWalletLedgerTotal } from './policy-booking-format';
import { formatDistance } from './policy-simulation';
import {
  bookingPolicySnapshotDrift,
  formatSnapshotPolicyValue,
  readBookingMatchingPolicySnapshot,
  summarizeSnapshotValues,
} from './policy-snapshot';
import { policyDisplayValue } from './policy-value-display';

export type PolicyChangeImpactDashboard = {
  readonly metrics: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly snapshotSummary: readonly {
    readonly scope: string;
    readonly label: string;
    readonly value: string;
    readonly helper: string;
  }[];
  readonly snapshotRows: readonly {
    readonly policy: string;
    readonly scope: string;
    readonly liveValue: string;
    readonly savedValue: string;
    readonly operatorMeaning: string;
  }[];
  readonly cards: readonly {
    readonly scope: string;
    readonly title: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
};

export function buildPolicyImpactDashboard(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
): PolicyChangeImpactDashboard {
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const activeDispatch = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const negativeCashDebtBookings = bookings.filter((booking) => bookingWalletLedgerTotal(booking) < 0);
  const withSnapshot = bookings.filter((booking) => readBookingMatchingPolicySnapshot(booking));
  const snapshotDrift = bookings.filter(
    (booking) => bookingPolicySnapshotDrift(booking, settings).length > 0,
  );
  const withoutSnapshot = bookings.filter((booking) => !readBookingMatchingPolicySnapshot(booking));
  const openMatchingWithSnapshot = openMatching.filter((booking) =>
    readBookingMatchingPolicySnapshot(booking),
  );
  const openMatchingWithoutSnapshot = openMatching.length - openMatchingWithSnapshot.length;
  const snapshotCoverage =
    bookings.length > 0 ? `${Math.round((withSnapshot.length / bookings.length) * 100)}%` : 'No sample';
  const immediateBackup =
    normalizeAdminMarketplaceOpenMode(
      policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
    ) === 'IMMEDIATE_WITHIN_WINDOW';
  const customerConfirm =
    policyRawValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ===
    'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';

  return {
    metrics: [
      {
        label: 'Open matching now',
        value: String(openMatching.length),
        helper:
          'Existing open bookings keep their saved policy snapshot; new bookings use the current live policy.',
      },
      {
        label: 'Active dispatch',
        value: String(activeDispatch.length),
        helper: 'Matched or in-service bookings should be handled by their saved booking state.',
      },
      {
        label: 'Policy drift',
        value: String(snapshotDrift.length),
        helper:
          'Expected when Admin policy changed after a booking opened; use booking detail before manual action.',
      },
      {
        label: 'Older bookings',
        value: String(withoutSnapshot.length),
        helper: 'Older bookings without metadata fall back to live policy explanations.',
      },
    ],
    snapshotSummary: [
      {
        scope: 'Forward-only',
        label: 'Live policy applies to new bookings',
        value: 'Create time snapshot',
        helper:
          'When a customer books, HANDS copies the active matching policy into booking metadata for later audit.',
      },
      {
        scope: 'Open now',
        label: 'Open bookings with saved policy',
        value: `${openMatchingWithSnapshot.length}/${openMatching.length}`,
        helper:
          openMatchingWithoutSnapshot > 0
            ? `${openMatchingWithoutSnapshot} open booking(s) without snapshots still need manual policy interpretation.`
            : 'Every open matching booking in this sample has a saved policy snapshot.',
      },
      {
        scope: 'Coverage',
        label: 'Snapshot coverage',
        value: snapshotCoverage,
        helper: `${withSnapshot.length}/${bookings.length} sampled booking(s) include metadata.matchingPolicy.`,
      },
      {
        scope: 'Review',
        label: 'Policy drift meaning',
        value: snapshotDrift.length ? `${snapshotDrift.length} changed` : 'Aligned',
        helper:
          'Drift is not an error. It tells operators that the booking was opened under an older policy value.',
      },
    ],
    snapshotRows: buildSnapshotRows(settings, bookings),
    cards: [
      {
        scope: 'New bookings',
        title: 'Response timer changes are forward-only',
        detail:
          'Changing the first-pick Partner response window affects new booking expiry and Redis TTL. Existing bookings keep their saved expiresAt value.',
        operatorAction:
          openMatching.length > 0
            ? `There are ${openMatching.length} open booking(s); do not expect their countdown to recalculate.`
            : 'No open matching bookings are waiting right now.',
        className: 'ops-task-done',
        pillClass: 'pill-success',
      },
      {
        scope: 'Live matching',
        title: immediateBackup
          ? 'Marketplace Partners can participate during the first window'
          : 'Marketplace timing needs policy review',
        detail: immediateBackup
          ? 'Eligible Partners can appear while the first-pick Partner is still deciding.'
          : 'Only immediate marketplace participation is approved for the current MVP runtime.',
        operatorAction: customerConfirm
          ? 'First-pick priority is active, with customer final choice as the fallback when first-pick does not win.'
          : 'Historical policy value is ignored; reset the policy to first-pick priority with customer fallback.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        scope: 'Partner controls',
        title: 'Negative wallet gate protects cash-fee debt',
        detail:
          'Partners with unpaid cash-fee debt can still see marketplace requests, but final acceptance, service start, and payout release wait until settlement is posted.',
        operatorAction:
          negativeCashDebtBookings.length > 0
            ? `${negativeCashDebtBookings.length} recent booking(s) have negative wallet state to review.`
            : 'No negative wallet booking state was found in the current sample.',
        className: negativeCashDebtBookings.length > 0 ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: negativeCashDebtBookings.length > 0 ? 'pill-danger' : 'pill-success',
      },
      {
        scope: 'Audit',
        title: 'Saved policy snapshots make old bookings explainable',
        detail:
          'Bookings created after this change keep response window, marketplace radius, accept mode, marketplace-open mode, and travel buffer in metadata.',
        operatorAction:
          snapshotDrift.length > 0
            ? `${snapshotDrift.length} booking(s) differ from current policy; review booking detail before manual action.`
            : 'Current booking snapshots are aligned with the live policy sample.',
        className: snapshotDrift.length > 0 ? 'ops-task-pending' : 'ops-task-done',
        pillClass: snapshotDrift.length > 0 ? 'pill-warn' : 'pill-success',
      },
    ],
  };
}

function buildSnapshotRows(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
): PolicyChangeImpactDashboard['snapshotRows'] {
  return [
    {
      policy: 'First-pick response timer',
      scope: 'Timer / expiry',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.providerResponseWindowMinutes,
        (value) => `${value} min`,
      ),
      operatorMeaning:
        'Saved at booking open. Existing countdowns and Redis matching TTL should not be recalculated after a policy edit.',
    },
    {
      policy: 'Marketplace Partner radius',
      scope: 'Partner eligibility',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.backupProviderRadiusMeters,
        (value) => formatDistance(Number(value)),
      ),
      operatorMeaning:
        'Controls which nearby partners can participate for each booking. New bookings copy the latest radius.',
    },
    {
      policy: 'Marketplace location freshness',
      scope: 'Partner eligibility',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.backupProviderLocationMaxAgeMinutes,
        (value) => `${value} min`,
      ),
      operatorMeaning:
        'Controls whether stale partner locations are excluded from marketplace alerts and participation attempts.',
    },
    {
      policy: 'Partner accept mode',
      scope: 'Final matching',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.preferredAcceptMode,
        (value) => formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode, value),
      ),
      operatorMeaning:
        'Confirms first-pick Partners can match first under API rules; otherwise customer final selection is required.',
    },
    {
      policy: 'Marketplace opening mode',
      scope: 'Marketplace visibility',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.backupOpenMode,
        (value) => formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, value),
      ),
      operatorMeaning:
        'Explains whether marketplace Partners were allowed to participate during the first-pick response window.',
    },
    {
      policy: 'Travel buffer',
      scope: 'Availability',
      liveValue: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.travelBufferMinutes),
      savedValue: summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.travelBufferMinutes,
        (value) => `${value} min`,
      ),
      operatorMeaning:
        'Used for availability explanations and partner supply planning around back-to-back bookings.',
    },
  ];
}

function policyDisplayByKey(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = adminOperationalPolicySettingByKey(settings, key);
  return setting ? policyDisplayValue(setting) : 'Not configured';
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return adminOperationalPolicySettingByKey(settings, key)?.value;
}
