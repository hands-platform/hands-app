import type { AdminEarning, AdminProviderTaxLog } from '../../lib/admin-api';
import { formatMoney, readPlainRecord, shortRecordId } from '../../lib/admin-format';

export type TaxPolicySnapshotConsistency = {
  readonly sampleCount: number;
  readonly consistentCount: number;
  readonly warningCount: number;
  readonly missingTaxLogCount: number;
  readonly missingRuleSnapshotCount: number;
  readonly rows: readonly TaxPolicySnapshotConsistencyRow[];
};

export type TaxPolicySnapshotConsistencyRow = {
  readonly id: string;
  readonly bookingHref: string;
  readonly earningHref: string;
  readonly financeTraceHref: string;
  readonly bookingLabel: string;
  readonly providerLabel: string;
  readonly grossAmountLabel: string;
  readonly earningTaxLabel: string;
  readonly taxLogLabel: string;
  readonly deltaLabel: string;
  readonly snapshotLabel: string;
  readonly statusLabel: string;
  readonly toneClassName: 'pill-danger' | 'pill-success' | 'pill-warn';
  readonly recordIntegrityLabel: string;
  readonly recordIntegrityTone: 'success' | 'warning' | 'danger';
  readonly taxApplicabilityLabel: string;
  readonly taxApplicabilityTone: 'success' | 'warning' | 'danger';
};

const TAX_POLICY_SNAPSHOT_SAMPLE_LIMIT = 25;

export function buildTaxPolicySnapshotConsistency(
  earnings: readonly AdminEarning[],
): TaxPolicySnapshotConsistency {
  const rows = earnings.slice(0, TAX_POLICY_SNAPSHOT_SAMPLE_LIMIT).map(taxPolicySnapshotConsistencyRow);

  return {
    consistentCount: rows.filter((row) => row.statusLabel === 'Aligned').length,
    missingRuleSnapshotCount: rows.filter((row) => row.statusLabel === 'Missing snapshot').length,
    missingTaxLogCount: rows.filter((row) => row.statusLabel === 'Missing tax log').length,
    rows,
    sampleCount: rows.length,
    warningCount: rows.filter((row) => row.statusLabel !== 'Aligned').length,
  };
}

function taxPolicySnapshotConsistencyRow(earning: AdminEarning): TaxPolicySnapshotConsistencyRow {
  const latestTaxLog = earning.taxLogs?.[0] ?? null;
  const latestSnapshot = readPlainRecord(latestTaxLog?.ruleSnapshot);
  const earningTax = earning.withholdingAmount ?? 0;
  const taxLogAmount = latestTaxLog?.withholdingAmount ?? null;
  const delta = taxLogAmount === null ? earningTax : earningTax - taxLogAmount;
  const statusLabel = taxSnapshotStatusLabel({
    delta,
    hasRuleSnapshot: Boolean(latestSnapshot),
    hasTaxLog: Boolean(latestTaxLog),
  });
  const applicability = taxApplicability(latestSnapshot, latestTaxLog);

  return {
    bookingHref: `/bookings/${earning.bookingId}`,
    bookingLabel: shortRecordId(earning.bookingId),
    deltaLabel: formatMoney(Math.abs(delta), earning.currency, '0 VND'),
    earningHref: `/earnings?earningId=${encodeURIComponent(earning.id)}#earning-${encodeURIComponent(earning.id)}`,
    earningTaxLabel: formatMoney(earningTax, earning.currency, '0 VND'),
    financeTraceHref: `/bookings/${earning.bookingId}#finance`,
    grossAmountLabel: formatMoney(earning.grossAmount, earning.currency, '0 VND'),
    id: earning.id,
    providerLabel: providerLabel(earning),
    recordIntegrityLabel: recordIntegrityLabel(statusLabel),
    recordIntegrityTone: recordIntegrityTone(statusLabel),
    snapshotLabel: snapshotLabel(latestSnapshot, latestTaxLog),
    statusLabel,
    taxApplicabilityLabel: applicability.label,
    taxApplicabilityTone: applicability.tone,
    taxLogLabel: taxLogAmount === null ? 'No tax log' : formatMoney(taxLogAmount, earning.currency, '0 VND'),
    toneClassName: taxSnapshotToneClassName(statusLabel),
  };
}

function recordIntegrityLabel(statusLabel: string) {
  if (statusLabel === 'Aligned') return 'Amounts match';
  if (statusLabel === 'Check amount') return 'Amount mismatch';
  return statusLabel;
}

function recordIntegrityTone(statusLabel: string): TaxPolicySnapshotConsistencyRow['recordIntegrityTone'] {
  if (statusLabel === 'Aligned') return 'success';
  if (statusLabel === 'Check amount') return 'danger';
  return 'warning';
}

function taxApplicability(
  snapshot: Record<string, unknown> | null,
  taxLog: AdminProviderTaxLog | null,
): {
  label: string;
  tone: TaxPolicySnapshotConsistencyRow['taxApplicabilityTone'];
} {
  if (!taxLog || !snapshot) return { label: 'Needs review', tone: 'warning' };
  const reason = readString(snapshot.reason);
  if (reason === 'NO_ACTIVE_POLICY') {
    return { label: 'No active policy at earning time', tone: 'danger' };
  }
  if (reason === 'NO_APPROVED_TAX_PROFILE') {
    return { label: 'No approved tax profile', tone: 'warning' };
  }
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  if (lines.length > 0 && lines.every((line) => readPlainRecord(line)?.ruleId == null)) {
    return { label: 'No matching rule', tone: 'warning' };
  }
  return { label: 'Applicable evidence present', tone: 'success' };
}

function taxSnapshotStatusLabel(input: {
  readonly delta: number;
  readonly hasRuleSnapshot: boolean;
  readonly hasTaxLog: boolean;
}) {
  if (!input.hasTaxLog) {
    return 'Missing tax log';
  }
  if (!input.hasRuleSnapshot) {
    return 'Missing snapshot';
  }
  if (input.delta !== 0) {
    return 'Check amount';
  }
  return 'Aligned';
}

function taxSnapshotToneClassName(
  statusLabel: TaxPolicySnapshotConsistencyRow['statusLabel'],
): TaxPolicySnapshotConsistencyRow['toneClassName'] {
  if (statusLabel === 'Aligned') {
    return 'pill-success';
  }
  if (statusLabel === 'Check amount') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function snapshotLabel(snapshot: Record<string, unknown> | null, latestTaxLog: AdminProviderTaxLog | null) {
  if (!latestTaxLog) {
    return 'No tax log';
  }
  if (!snapshot) {
    return 'No rule snapshot';
  }
  const reason = readString(snapshot.reason);
  if (reason) {
    return reason;
  }
  const policyName = readString(snapshot.policyName);
  return policyName ?? 'Snapshot captured';
}

function providerLabel(earning: AdminEarning) {
  return (
    earning.providerProfile?.displayName ??
    earning.providerProfile?.user?.fullName ??
    earning.providerProfile?.user?.phone ??
    shortRecordId(earning.providerProfileId)
  );
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
