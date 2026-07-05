const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatWholeNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrencyAmount(value: number, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatPercentLabel(value: number) {
  return `${formatWholeNumber(value)}%`;
}

export function formatMoney(amount?: number | null, currency = 'VND', fallback = 'Not set') {
  if (amount === undefined || amount === null) {
    return fallback;
  }

  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

export function formatMoneyOrZero(amount?: number | null, currency = 'VND') {
  return formatMoney(amount ?? 0, currency);
}

export function formatDistanceMeters(value?: number | null, fallback = '?') {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback;
  }

  if (Math.abs(value) >= 1000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1000)} km`;
  }

  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value))} m`;
}

export function formatBytes(
  value?: number | null,
  options: { fallback?: string; kbFractionDigits?: number; mbFractionDigits?: number } = {},
) {
  const { fallback = 'Not set', kbFractionDigits = 1, mbFractionDigits = 1 } = options;
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return fallback;
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(kbFractionDigits)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(mbFractionDigits)} MB`;
}

export function formatDateTime(value?: string | null, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);
}

export function formatPendingDateTime(value?: string | null, fallback = 'pending') {
  if (!value) {
    return fallback;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp === 0) {
    return fallback;
  }

  return formatDateTime(value, fallback);
}

export function formatDateOnly(value?: string | null, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);
}

export function shortId(
  value?: string | null,
  options: { length?: number; fallback?: string; ellipsis?: boolean } = {},
) {
  const { length = 8, fallback = '-', ellipsis = false } = options;
  if (!value) {
    return fallback;
  }

  if (value.length <= length) {
    return value;
  }

  return ellipsis ? `${value.slice(0, length)}...` : value.slice(0, length);
}

export function shortRecordId(value?: string | null) {
  return shortId(value, { length: 12 });
}

export function shortDisplayId(value?: string | null) {
  return shortId(value, { length: 8, ellipsis: true });
}

export function shortUnknownId(value?: string | null) {
  return shortId(value, { fallback: 'unknown' });
}

export function readPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function compactValue(value: unknown, maxLength = 160) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value).slice(0, maxLength);
}

export function formatRelativeTime(
  value?: string | null,
  options: {
    emptyFallback?: string;
    invalidFallback?: string;
    justNow?: string;
    includeFuture?: boolean;
    hourLabelCutoff?: number;
  } = {},
) {
  const {
    emptyFallback = 'Unknown time',
    invalidFallback = 'Unknown time',
    justNow = 'just now',
    includeFuture = false,
    hourLabelCutoff = 24,
  } = options;

  if (!value) {
    return emptyFallback;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return invalidFallback;
  }

  const diffMs = Date.now() - timestamp;
  const absoluteMinutes = Math.floor(Math.abs(diffMs) / 60_000);
  const suffix = diffMs >= 0 ? 'ago' : 'from now';

  if (absoluteMinutes < 1) {
    if (includeFuture && diffMs < 0) {
      return 'in less than 1m';
    }
    return justNow;
  }

  if (absoluteMinutes < 60) {
    return includeFuture ? `${absoluteMinutes}m ${suffix}` : `${absoluteMinutes}m ago`;
  }

  const hours = Math.floor(absoluteMinutes / 60);
  if (hours < hourLabelCutoff) {
    return includeFuture ? `${hours}h ${suffix}` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return includeFuture ? `${days}d ${suffix}` : `${days}d ago`;
}

export function formatRelativeAge(value?: string | null, fallback = 'unknown time') {
  return formatRelativeTime(value, {
    emptyFallback: fallback,
    invalidFallback: fallback,
    justNow: '0m ago',
  });
}
