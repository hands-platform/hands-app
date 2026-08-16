import { readSearchParam } from '../../../lib/date-range';

export type PushCampaignDateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d';

const PUSH_CAMPAIGN_API_TAKE = 20;
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const pushCampaignDateRangeLinks = [
  { label: 'Today', range: 'today' },
  { label: 'Yesterday', range: 'yesterday' },
  { label: '7 days', range: '7d' },
  { label: '30 days', range: '30d' },
  { label: 'All history', range: 'all' },
] as const satisfies readonly { label: string; range: PushCampaignDateRange }[];

export function buildPushCampaignApiHref(params: Record<string, string | string[] | undefined>) {
  const range = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  const page = normalizePushCampaignPage(readSearchParam(params.campaignPage));
  const query = new URLSearchParams({ take: String(PUSH_CAMPAIGN_API_TAKE) });
  const skip = (page - 1) * PUSH_CAMPAIGN_API_TAKE;
  if (skip) query.set('skip', String(skip));
  appendRange(query, range);
  return `/admin/notifications/push-campaigns?${query.toString()}`;
}

export function buildPushCampaignSummaryApiHref(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  appendRange(query, normalizePushCampaignDateRange(readSearchParam(params.campaignRange)));
  return query.size
    ? `/admin/notifications/push-campaigns/summary?${query.toString()}`
    : '/admin/notifications/push-campaigns/summary';
}

export function buildPushCampaignListHref(range: PushCampaignDateRange) {
  return range === 'today'
    ? '/notifications/push-send'
    : `/notifications/push-send?campaignRange=${range}`;
}

export function buildPushCampaignPageHref(
  page: number,
  params: Record<string, string | string[] | undefined> = {},
) {
  const query = new URLSearchParams();
  const range = normalizePushCampaignDateRange(readSearchParam(params.campaignRange));
  if (range !== 'today') query.set('campaignRange', range);
  const normalizedPage = Math.max(1, Math.trunc(page));
  if (normalizedPage > 1) query.set('campaignPage', String(normalizedPage));
  return query.size ? `/notifications/push-send?${query.toString()}` : '/notifications/push-send';
}

export function pushCampaignDateRangeLabel(range: PushCampaignDateRange) {
  return pushCampaignDateRangeLinks.find((item) => item.range === range)?.label ?? 'Today';
}

export function normalizePushCampaignDateRange(value: string): PushCampaignDateRange {
  return value === 'all' || value === 'yesterday' || value === '7d' || value === '30d'
    ? value
    : 'today';
}

export function normalizePushCampaignPage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 1;
}

export function pushCampaignStatusView(status: string) {
  const views: Record<string, { label: string; tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning' }> = {
    COMPLETED: { label: 'Completed', tone: 'success' },
    FAILED: { label: 'Failed', tone: 'danger' },
    PARTIAL_FAILED: { label: 'Partial failure', tone: 'warning' },
    PROCESSING: { label: 'Processing', tone: 'info' },
    QUEUED: { label: 'Queued', tone: 'neutral' },
  };
  return views[status] ?? { label: status, tone: 'neutral' as const };
}

function appendRange(query: URLSearchParams, range: PushCampaignDateRange) {
  const window = pushCampaignDateRangeWindow(range);
  if (window.from) query.set('from', window.from.toISOString());
  if (window.to) query.set('to', window.to.toISOString());
}

function pushCampaignDateRangeWindow(range: PushCampaignDateRange, now = new Date()) {
  if (range === 'all') return {};
  const todayStart = vietnamDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  if (range === 'today') return { from: todayStart, to: tomorrowStart };
  if (range === 'yesterday') return { from: new Date(todayStart.getTime() - DAY_MS), to: todayStart };
  const days = range === '7d' ? 7 : 30;
  return { from: new Date(todayStart.getTime() - (days - 1) * DAY_MS), to: tomorrowStart };
}

function vietnamDayStart(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - ICT_OFFSET_MS);
}
