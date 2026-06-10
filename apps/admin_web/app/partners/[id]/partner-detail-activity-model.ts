import type { DetailActivityOrder } from './partner-detail-filters';
import { orderPartnerActivityRecords } from './partner-detail-filters';
import { formatDate } from './partner-detail-format';

export type PartnerActivityRecord = {
  readonly id: string;
  readonly type: string;
  readonly at: string;
  readonly title: string;
  readonly detail: string;
};

export type PartnerDailyActivityDigest = {
  readonly key: string;
  readonly label: string;
  readonly total: number;
  readonly latestAt?: string;
  readonly typeCounts: readonly { readonly type: string; readonly count: number }[];
  readonly highlights: readonly PartnerActivityRecord[];
};

export function partnerActivityRecordHref(record: PartnerActivityRecord) {
  if (['BOOKING', 'CHAT'].includes(record.type)) return '#booking-chat-records';
  if (['EARNING', 'PAYOUT'].includes(record.type)) return '#payout';
  if (['LOCATION', 'SESSION', 'DEVICE', 'ACCOUNT'].includes(record.type)) return '#app-activity';
  if (
    ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'].includes(
      record.type,
    )
  ) {
    return '#documents';
  }
  return '#app-activity';
}

export function buildPartnerActivitySummary(records: PartnerActivityRecord[]) {
  const financeTypes = new Set(['EARNING', 'PAYOUT']);
  const verificationTypes = new Set([
    'VERIFY',
    'DOCUMENT',
    'BANK',
    'TAX',
    'AGREEMENT',
    'REPORT',
    'SANCTION',
    'PROFILE',
    'OPS',
  ]);
  const count = (predicate: (record: PartnerActivityRecord) => boolean) => records.filter(predicate).length;
  const latestAt = orderPartnerActivityRecords(records, 'newest')[0]?.at;
  const oldestAt = orderPartnerActivityRecords(records, 'oldest')[0]?.at;

  return [
    {
      label: 'Range',
      value: latestAt ? formatDate(latestAt) : 'None',
      helper: oldestAt ? `Oldest loaded: ${formatDate(oldestAt)}` : 'No partner records loaded.',
    },
    {
      label: 'Bookings',
      value: count((record) => record.type === 'BOOKING').toString(),
      helper: 'Preferred, selected, and marketplace participation booking records.',
    },
    {
      label: 'Chat',
      value: count((record) => record.type === 'CHAT').toString(),
      helper: 'Booking messages visible in admin archive.',
    },
    {
      label: 'App and device',
      value: count((record) => ['ACCOUNT', 'SESSION', 'DEVICE'].includes(record.type)).toString(),
      helper: 'Account creation, login sessions, and device records.',
    },
    {
      label: 'Location',
      value: count((record) => record.type === 'LOCATION').toString(),
      helper: 'Last known location snapshots.',
    },
    {
      label: 'Finance',
      value: count((record) => financeTypes.has(record.type)).toString(),
      helper: 'Earnings and payout batches.',
    },
    {
      label: 'Verification and operations',
      value: count((record) => verificationTypes.has(record.type)).toString(),
      helper: 'KYC, documents, bank, tax, agreements, reports, account controls, media, and notes.',
    },
  ];
}

export function buildPartnerDailyActivityDigest(
  records: PartnerActivityRecord[],
  order: DetailActivityOrder = 'newest',
): PartnerDailyActivityDigest[] {
  const grouped = new Map<string, PartnerActivityRecord[]>();

  for (const record of records) {
    const key = partnerActivityDateKey(record.at);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => (order === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)))
    .slice(0, 14)
    .map(([key, dayRecords]) => {
      const typeCounts = [...countPartnerActivityTypes(dayRecords).entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([type, count]) => ({ type, count }));
      const newestRecords = orderPartnerActivityRecords(dayRecords, 'newest');
      const sortedRecords = orderPartnerActivityRecords(dayRecords, order);

      return {
        key,
        label: formatPartnerActivityDateLabel(key),
        total: dayRecords.length,
        latestAt: newestRecords[0]?.at,
        typeCounts,
        highlights: sortedRecords.slice(0, 4),
      };
    });
}

function countPartnerActivityTypes(records: readonly { readonly type: string }[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
  }
  return counts;
}

function partnerActivityDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatPartnerActivityDateLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}
