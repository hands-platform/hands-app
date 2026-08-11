import { readSearchParam } from '../../../lib/date-range';

export type PushCampaignDateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d';

const PUSH_CAMPAIGN_API_TAKE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export const pushCampaignDateRangeLinks = [
  { label: 'Today', range: 'today' },
  { label: 'Previous day', range: 'yesterday' },
  { label: 'Last 7 days', range: '7d' },
  { label: 'Last 30 days', range: '30d' },
  { label: 'All loaded', range: 'all' },
] as const satisfies readonly { label: string; range: PushCampaignDateRange }[];

export function buildPushCampaignApiHref(params: Record<string, string | string[] | undefined>) {
  const range = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  const page = normalizePushCampaignPage(readSearchParam(params.campaignPage));
  const query = new URLSearchParams({ take: String(PUSH_CAMPAIGN_API_TAKE) });
  const skip = (page - 1) * PUSH_CAMPAIGN_API_TAKE;
  if (skip > 0) {
    query.set('skip', String(skip));
  }
  const window = pushCampaignDateRangeWindow(range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  return `/admin/notifications/push-campaigns?${query.toString()}`;
}

export function buildPushCampaignSummaryApiHref(params: Record<string, string | string[] | undefined>) {
  const range = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  const query = new URLSearchParams();
  const window = pushCampaignDateRangeWindow(range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  const value = query.toString();
  return value ? `/admin/notifications/push-campaigns/summary?${value}` : '/admin/notifications/push-campaigns/summary';
}

export function buildPushCampaignListHref(
  range: PushCampaignDateRange,
  params: Record<string, string | string[] | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'campaignRange' || key === 'campaignPage' || key === 'preview') {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === 'string' && item.trim()) {
        query.append(key, item);
      }
    }
  }
  if (range !== 'today') {
    query.set('campaignRange', range);
  }
  const value = query.toString();
  return value ? `/notifications/push-send?${value}` : '/notifications/push-send';
}

export function buildPushCampaignPageHref(
  page: number,
  params: Record<string, string | string[] | undefined> = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'campaignPage' || key === 'preview') {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === 'string' && item.trim()) {
        query.append(key, item);
      }
    }
  }
  const normalizedPage = Math.max(1, Math.trunc(page));
  if (normalizedPage > 1) {
    query.set('campaignPage', String(normalizedPage));
  }
  const value = query.toString();
  return value ? `/notifications/push-send?${value}` : '/notifications/push-send';
}

export function pushCampaignDateRangeLabel(range: PushCampaignDateRange) {
  if (range === 'today') {
    return 'Today';
  }
  if (range === 'yesterday') {
    return 'Previous day';
  }
  if (range === '7d') {
    return 'Last 7 days';
  }
  if (range === '30d') {
    return 'Last 30 days';
  }
  return 'All loaded';
}

export function normalizePushCampaignDateRange(value: string): PushCampaignDateRange {
  if (value === 'all' || value === 'today' || value === 'yesterday' || value === '7d' || value === '30d') {
    return value;
  }
  return 'today';
}

export function normalizePushCampaignPage(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(parsed, 500);
}

export function shouldRequestPushCampaignPreview(params: Record<string, string | string[] | undefined>) {
  return (
    readSearchParam(params.preview) === '1' &&
    Boolean(readSearchParam(params.title).trim()) &&
    Boolean(readSearchParam(params.body).trim())
  );
}

export function buildPushRecipientSearchApiHref(role: 'CUSTOMER' | 'PROVIDER', query: string) {
  const search = new URLSearchParams({ q: query.trim(), take: '8' });
  if (role === 'CUSTOMER') {
    search.set('skip', '0');
    return `/admin/customers?${search.toString()}`;
  }
  return `/admin/partners/list-providers?${search.toString()}`;
}

export function buildPushRecipientSelectionHref(
  params: Record<string, string | string[] | undefined>,
  update: {
    readonly recipientSearch?: string;
    readonly targetRole?: 'CUSTOMER' | 'PROVIDER';
    readonly targetUserId?: string | null;
  },
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (['campaignId', 'notice', 'preview', 'recipientSearch', 'targetRole', 'targetUserId'].includes(key)) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === 'string' && item.trim()) {
        query.append(key, item);
      }
    }
  }

  const targetRole = update.targetRole ?? (readSearchParam(params.targetRole) === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER');
  query.set('targetRole', targetRole);
  const recipientSearch = update.recipientSearch ?? readSearchParam(params.recipientSearch);
  if (recipientSearch.trim()) {
    query.set('recipientSearch', recipientSearch.trim());
  }
  if (update.targetUserId) {
    query.set('targetUserId', update.targetUserId);
  }

  return `/notifications/push-send?${query.toString()}`;
}

function pushCampaignDateRangeWindow(range: PushCampaignDateRange, now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  if (range === 'today') {
    return { from: todayStart, to: tomorrowStart };
  }
  if (range === 'yesterday') {
    return { from: new Date(todayStart.getTime() - DAY_MS), to: todayStart };
  }
  if (range === '7d') {
    return { from: new Date(todayStart.getTime() - 6 * DAY_MS), to: tomorrowStart };
  }
  if (range === '30d') {
    return { from: new Date(todayStart.getTime() - 29 * DAY_MS), to: tomorrowStart };
  }
  return {};
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
