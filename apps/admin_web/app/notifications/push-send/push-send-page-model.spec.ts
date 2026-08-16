import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignPageHref,
  buildPushCampaignSummaryApiHref,
  normalizePushCampaignPage,
  pushCampaignDateRangeLabel,
  pushCampaignDateRangeLinks,
  pushCampaignStatusView,
} from './push-send-page-model';

describe('push send page model', () => {
  it('uses a Vietnam-local bounded Today window for list and summary', () => {
    const list = new URL(buildPushCampaignApiHref({}), 'http://admin.local');
    const summary = new URL(buildPushCampaignSummaryApiHref({}), 'http://admin.local');
    expect(list.pathname).toBe('/admin/notifications/push-campaigns');
    expect(list.searchParams.get('take')).toBe('20');
    expect(list.searchParams.get('from')).toBe(summary.searchParams.get('from'));
    expect(list.searchParams.get('to')).toBe(summary.searchParams.get('to'));
    expect(Date.parse(list.searchParams.get('to')!) - Date.parse(list.searchParams.get('from')!)).toBe(86_400_000);
  });

  it('keeps only history range and page in browser URLs', () => {
    expect(buildPushCampaignListHref('7d')).toBe('/notifications/push-send?campaignRange=7d');
    expect(buildPushCampaignPageHref(3, {
      campaignRange: '7d',
      title: 'Private copy',
      body: 'Private body',
      reason: 'Private reason',
      targetUserId: 'secret-user',
    })).toBe('/notifications/push-send?campaignRange=7d&campaignPage=3');
    expect(normalizePushCampaignPage('3.9')).toBe(3);
  });

  it('uses honest history and lifecycle labels', () => {
    expect(pushCampaignDateRangeLinks.at(-1)?.label).toBe('All history');
    expect(pushCampaignDateRangeLabel('yesterday')).toBe('Yesterday');
    expect(pushCampaignStatusView('PARTIAL_FAILED')).toEqual({ label: 'Partial failure', tone: 'warning' });
    expect(pushCampaignStatusView('QUEUED')).toEqual({ label: 'Queued', tone: 'neutral' });
  });
});
