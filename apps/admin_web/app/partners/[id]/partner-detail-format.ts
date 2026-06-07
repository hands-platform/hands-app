import {
  compactValue,
  formatBytes as formatAdminBytes,
  formatDateOnly as formatAdminDateOnly,
  formatDateTime,
  formatDistanceMeters,
  formatMoney as formatAdminMoney,
  readPlainRecord,
  shortId as formatAdminShortId,
} from '../../../lib/admin-format';

export function shortRecordId(value: string) {
  return value.length > 12 ? formatAdminShortId(value, { length: 8, ellipsis: true }) : value;
}

export function formatDate(value?: string | null) {
  return formatDateTime(value, 'Missing');
}

export function formatDateOnly(value?: string | null) {
  return value ? formatAdminDateOnly(value, value) : null;
}

export function dateValue(value?: string | null) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

export function newestDateValue(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value) && !Number.isNaN(dateValue(value)))
    .sort((left, right) => dateValue(right) - dateValue(left))[0];
}

export function formatJsonSummary(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${value.length} item(s)`;
  const record = readPlainRecord(value);
  if (record) {
    return Object.keys(record).length ? compactValue(record, 120) : null;
  }
  return String(value);
}

export function jsonStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function formatJsonList(value: unknown) {
  const items = jsonStringList(value);
  return items.length ? items.join(', ') : null;
}

export function providerPublicMediaLabel(purpose?: string | null) {
  if (purpose === 'PROFILE_IMAGE') return 'Profile image';
  if (purpose === 'PROVIDER_GALLERY') return 'Work gallery';
  return purpose ?? 'Public media';
}

export function formatBytes(value: number) {
  return formatAdminBytes(value, { kbFractionDigits: 0 });
}

export function formatDistance(value: number) {
  return formatDistanceMeters(value);
}

export function locationAgeMinutes(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
}

export function locationAgeLabel(value?: string | null) {
  if (!value) return 'missing';
  const minutes = locationAgeMinutes(value);
  if (!Number.isFinite(minutes)) return 'invalid';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

export function maskDeviceId(value?: string | null) {
  if (!value) return 'No device id';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function formatCurrency(value?: number | string | null, currency = 'VND') {
  const amount = amountValue(value);
  return formatAdminMoney(amount, currency, `0 ${currency}`);
}

export function amountValue(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function walletLedgerLabel(type: string) {
  return type
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function metadataPreview(metadata?: unknown) {
  const record = readPlainRecord(metadata);
  if (!record) return null;
  const reason = typeof record.reason === 'string' ? record.reason : null;
  const documentType = typeof record.documentType === 'string' ? record.documentType : null;
  const target = typeof record.target === 'string' ? record.target : null;
  const parts = [
    reason ? `Reason: ${reason}` : null,
    documentType ? `Document: ${documentType}` : null,
    target ? `Target: ${target}` : null,
  ].filter(Boolean);
  return parts.join(' / ');
}
