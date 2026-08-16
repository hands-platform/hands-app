import { Prisma } from '@prisma/client';

const CUSTOMER_MARKETING_SOURCES = new Set([
  'meta',
  'google',
  'tiktok',
  'organic',
  'direct',
]);

type CustomerMarketingAttribution = {
  source: string;
  campaignId?: string;
  medium?: string;
  capturedAt: string;
};

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function marketingSource(value: unknown) {
  const normalized = boundedText(value, 40)?.toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('facebook') || normalized.includes('instagram')) return 'meta';
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('organic')) return 'organic';
  if (normalized.includes('direct')) return 'direct';
  return CUSTOMER_MARKETING_SOURCES.has(normalized) ? normalized : null;
}

export function normalizeCustomerMarketingAttribution(
  value: unknown,
): CustomerMarketingAttribution | null {
  const record = recordFromUnknown(value);
  const source = marketingSource(record?.source);
  const capturedAt = boundedText(record?.capturedAt, 40);
  if (!source || !capturedAt || Number.isNaN(Date.parse(capturedAt))) {
    return null;
  }
  const campaignId = boundedText(record?.campaignId, 120);
  const medium = boundedText(record?.medium, 80);
  return {
    source,
    ...(campaignId ? { campaignId } : {}),
    ...(medium ? { medium } : {}),
    capturedAt: new Date(capturedAt).toISOString(),
  };
}

export function customerAppSessionMetadata(
  existingValue: unknown,
  incomingValue: Record<string, unknown> | undefined,
): Prisma.InputJsonObject | undefined {
  const existing = recordFromUnknown(existingValue) ?? {};
  const incoming = recordFromUnknown(incomingValue) ?? {};
  const attribution =
    normalizeCustomerMarketingAttribution(existing.marketingAttribution) ??
    normalizeCustomerMarketingAttribution(incoming.marketingAttribution);
  return attribution
    ? ({ marketingAttribution: attribution } as Prisma.InputJsonObject)
    : undefined;
}
