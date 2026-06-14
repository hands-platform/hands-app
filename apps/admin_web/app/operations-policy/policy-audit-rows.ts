import type { AdminAuditLog } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { readPlainRecord } from '../../lib/admin-format';
import { policyImpactDetails } from './policy-impact-details';

export type PolicyAuditRow = {
  readonly id: string;
  readonly createdAt: string;
  readonly key: string;
  readonly label: string;
  readonly policyContext: string;
  readonly actorName: string;
  readonly previousValue: string;
  readonly value: string;
  readonly reason: string;
  readonly enforced: boolean;
  readonly effect: string;
};

export function operationalPolicyAuditRows(logs: AdminAuditLog[]): PolicyAuditRow[] {
  return logs
    .filter((log) => log.action === 'operational_policy.update')
    .map((log) => {
      const metadata = readPlainRecord(log.metadata);
      const key = readOptionalString(metadata?.key) ?? targetPolicyKey(log.target);
      const details = policyImpactDetails(key);
      const enforced = Boolean(metadata?.enforced);
      return {
        id: log.id,
        createdAt: log.createdAt,
        key,
        label: policyKeyLabel(key),
        policyContext: details.title,
        actorName: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        previousValue: compactAuditValue(metadata?.previousValue),
        value: compactAuditValue(metadata?.value),
        reason: policyAuditReasonText(readOptionalString(metadata?.reason) ?? 'No reason recorded'),
        enforced,
        effect: enforced
          ? details.detail
          : `${details.title}. This is stored as an owner decision until enforced.`,
      };
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
}

function targetPolicyKey(target: string) {
  return target.startsWith('operational_policy:') ? target.slice('operational_policy:'.length) : target;
}

function policyKeyLabel(key: string) {
  const label = key
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .join(' / ');
  const titled = label.charAt(0).toUpperCase() + label.slice(1);
  return displayOperationalWording(titled);
}

function policyAuditReasonText(reason: string) {
  return reason.replace(
    /\b(?:booking|matching|notification|wallet|cancellation|no_show|decision|cash|payout)\.[a-z0-9_.-]+/g,
    (key) => policyKeyLabel(key),
  );
}

function compactAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    return displayOperationalWording(JSON.stringify(value));
  }
  return displayOperationalWording(policyAuditValueText(String(value)));
}

function policyAuditValueText(value: string) {
  if (!/^[A-Z0-9_]+$/.test(value) || !value.includes('_')) {
    return value;
  }
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(policyAuditValueWord)
    .join(' ');
}

function policyAuditValueWord(part: string) {
  const acronyms: Record<string, string> = {
    api: 'API',
    fcm: 'FCM',
    mvp: 'MVP',
    sms: 'SMS',
  };
  return acronyms[part] ?? part.charAt(0).toUpperCase() + part.slice(1);
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
