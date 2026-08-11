import type { AdminAuditLog } from '../../lib/admin-api';
import { readPlainRecord, shortDisplayId } from '../../lib/admin-format';

export type TaxPolicyAuditSummary = {
  readonly totalChangeCount: number;
  readonly policyChangeCount: number;
  readonly ruleChangeCount: number;
  readonly latestChangeAt: string | null;
  readonly rows: readonly TaxPolicyAuditSummaryRow[];
};

export type TaxPolicyAuditSummaryRow = {
  readonly id: string;
  readonly actionLabel: string;
  readonly targetLabel: string;
  readonly actorLabel: string;
  readonly createdAt: string;
  readonly detail: string;
  readonly toneClassName: 'pill-info' | 'pill-neutral' | 'pill-success' | 'pill-warn';
};

const TAX_POLICY_AUDIT_ROW_LIMIT = 8;

export function buildTaxPolicyAuditSummary(logs: readonly AdminAuditLog[]): TaxPolicyAuditSummary {
  const taxLogs = logs
    .filter((log) => isTaxPolicyAuditAction(log.action))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return {
    latestChangeAt: taxLogs[0]?.createdAt ?? null,
    policyChangeCount: taxLogs.filter((log) => log.action.startsWith('tax_policy.')).length,
    rows: taxLogs.slice(0, TAX_POLICY_AUDIT_ROW_LIMIT).map(taxPolicyAuditSummaryRow),
    ruleChangeCount: taxLogs.filter((log) => log.action.startsWith('tax_rule.')).length,
    totalChangeCount: taxLogs.length,
  };
}

function taxPolicyAuditSummaryRow(log: AdminAuditLog): TaxPolicyAuditSummaryRow {
  return {
    actionLabel: taxPolicyActionLabel(log.action),
    actorLabel: log.actor?.fullName ?? log.actor?.phone ?? 'System',
    createdAt: log.createdAt,
    detail: taxPolicyAuditDetail(log),
    id: log.id,
    targetLabel: shortAuditTarget(log.target),
    toneClassName: taxPolicyAuditTone(log),
  };
}

function isTaxPolicyAuditAction(action: string) {
  return action.startsWith('tax_policy.') || action.startsWith('tax_rule.');
}

function taxPolicyActionLabel(action: string) {
  const labels: Record<string, string> = {
    'tax_policy.create': 'Policy created',
    'tax_policy.update': 'Policy updated',
    'tax_rule.create': 'Rule created',
    'tax_rule.update': 'Rule updated',
  };
  return labels[action] ?? humanizeAuditAction(action);
}

function taxPolicyAuditDetail(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata) ?? {};
  const parts: string[] = [];
  const status = readString(metadata.status);
  const scope = readString(metadata.scope);
  const rateBps = readNumber(metadata.rateBps);
  const active = readBoolean(metadata.active);
  const deactivatedOtherActivePolicies = readNumber(metadata.deactivatedOtherActivePolicies);
  const approvalAdminId = readString(metadata.approvalAdminId);
  const operatorReason = readString(metadata.operatorReason);

  if (status) {
    parts.push(`Status ${status}`);
  }
  if (scope) {
    parts.push(scope);
  }
  if (rateBps !== null) {
    parts.push(formatBps(rateBps));
  }
  if (active !== null) {
    parts.push(active ? 'Rule active' : 'Rule inactive');
  }
  if (deactivatedOtherActivePolicies !== null && deactivatedOtherActivePolicies > 0) {
    parts.push(
      `${deactivatedOtherActivePolicies} other active ${deactivatedOtherActivePolicies === 1 ? 'policy' : 'policies'} deactivated`,
    );
  }
  if (approvalAdminId) {
    parts.push(`Finance approval ${shortDisplayId(approvalAdminId)}`);
  }
  if (operatorReason) {
    parts.push(`Evidence: ${operatorReason}`);
  }

  return parts.length ? parts.join(' / ') : 'No metadata snapshot recorded';
}

function taxPolicyAuditTone(log: AdminAuditLog): TaxPolicyAuditSummaryRow['toneClassName'] {
  const metadata = readPlainRecord(log.metadata) ?? {};
  const status = readString(metadata.status);
  const active = readBoolean(metadata.active);
  if (status === 'ACTIVE' || active === true) {
    return 'pill-success';
  }
  if (status === 'ARCHIVED' || active === false) {
    return 'pill-warn';
  }
  if (log.action.startsWith('tax_rule.')) {
    return 'pill-info';
  }
  return 'pill-neutral';
}

function humanizeAuditAction(action: string) {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function shortAuditTarget(target: string) {
  const [scope, id] = target.split(':');
  return id ? `${scope}:${shortDisplayId(id)}` : shortDisplayId(target);
}

function formatBps(value: number) {
  return `${(value / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}
