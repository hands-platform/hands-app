import type { AdminAuditLog } from './admin-api';
import { formatMoney } from './admin-format';

export type ServicePricingAuditRow = {
  readonly id: string;
  readonly action: string;
  readonly target: string;
  readonly targetShort: string;
  readonly createdAt: string;
  readonly actorName: string;
  readonly changedFields: readonly string[];
  readonly serviceLabel: string;
  readonly priceLabel: string;
  readonly payoutLabel: string;
};

export function servicePricingAuditRows(logs: readonly AdminAuditLog[]): readonly ServicePricingAuditRow[] {
  return logs
    .filter((log) => isServicePricingAuditAction(log.action))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8)
    .map((log) => {
      const metadata = readMetadataObject(log.metadata);
      const before = readMetadataObject(metadata.before);
      const after = readMetadataObject(metadata.after);
      const service = readMetadataObject(metadata.service);
      const changedFields = readChangedFields(metadata.changedFields);
      const targetShort = shortTarget(log.target);
      const serviceLabel =
        typeof service.name === 'string'
          ? `${service.name}${typeof service.durationMin === 'number' ? ` / ${service.durationMin} min` : ''}`
          : typeof after.name === 'string'
            ? `${after.name}${typeof after.durationMin === 'number' ? ` / ${after.durationMin} min` : ''}`
            : targetShort;
      const priceLabel =
        typeof after.customerPrice === 'number'
          ? `Customer ${formatMoney(after.customerPrice, String(after.currency ?? 'VND'))}`
          : typeof after.basePrice === 'number'
            ? `Base ${formatMoney(after.basePrice, 'VND')}`
            : 'No customer price snapshot';
      const payoutLabel =
        typeof after.providerPayoutAmount === 'number'
          ? `Partner ${formatMoney(after.providerPayoutAmount, String(after.currency ?? 'VND'))}`
          : typeof before.providerPayoutAmount === 'number'
            ? `Previous partner ${formatMoney(before.providerPayoutAmount, String(before.currency ?? 'VND'))}`
            : 'No partner payout snapshot';

      return {
        action: log.action,
        actorName: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        changedFields: changedFields.length ? changedFields : ['created'],
        createdAt: log.createdAt,
        id: log.id,
        payoutLabel,
        priceLabel,
        serviceLabel,
        target: log.target,
        targetShort,
      };
    });
}

export function humanizeAuditAction(action: string) {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function isServicePricingAuditAction(action: string) {
  return action.startsWith('service.') || action.startsWith('service_payout_rule.');
}

function readMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function readChangedFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((field): field is string => typeof field === 'string');
}

function shortTarget(target: string) {
  const [scope, id] = target.split(':');
  return id ? `${scope}:${id.slice(0, 8)}` : target;
}
