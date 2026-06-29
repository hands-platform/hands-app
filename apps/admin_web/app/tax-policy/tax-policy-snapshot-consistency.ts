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
};

const TAX_POLICY_SNAPSHOT_SAMPLE_LIMIT = 8;

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
    snapshotLabel: snapshotLabel(latestSnapshot, latestTaxLog),
    statusLabel,
    taxLogLabel: taxLogAmount === null ? 'No tax log' : formatMoney(taxLogAmount, earning.currency, '0 VND'),
    toneClassName: taxSnapshotToneClassName(statusLabel),
  };
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
