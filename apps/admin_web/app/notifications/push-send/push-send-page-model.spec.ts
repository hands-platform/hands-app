import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignSummaryApiHref,
  pushCampaignDateRangeLabel,
  pushCampaignDateRangeLinks,
} from './push-send-page-model';

describe('push send page model', () => {
  it('loads recent manual push campaigns from the bounded Today API window by default', () => {
    const href = buildPushCampaignApiHref({});
    const url = new URL(href, 'http://admin.local');

    expect(url.pathname).toBe('/admin/notifications/push-campaigns');
    expect(url.searchParams.get('take')).toBe('20');
    expect(Number.isFinite(Date.parse(url.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(url.searchParams.get('to') ?? ''))).toBe(true);
  });

  it('builds a matching summary API href so totals do not require loading every campaign', () => {
    const summaryHref = buildPushCampaignSummaryApiHref({ campaignRange: '7d' });
    const listHref = buildPushCampaignApiHref({ campaignRange: '7d' });
    const summaryUrl = new URL(summaryHref, 'http://admin.local');
    const listUrl = new URL(listHref, 'http://admin.local');

    expect(summaryUrl.pathname).toBe('/admin/notifications/push-campaigns/summary');
    expect(summaryUrl.searchParams.get('from')).toBe(listUrl.searchParams.get('from'));
    expect(summaryUrl.searchParams.get('to')).toBe(listUrl.searchParams.get('to'));
    expect(summaryUrl.searchParams.has('take')).toBe(false);
    expect(buildPushCampaignSummaryApiHref({ campaignRange: 'all' })).toBe(
      '/admin/notifications/push-campaigns/summary',
    );
  });

  it('builds explicit date range API and page links without changing the send form filters', () => {
    expect(buildPushCampaignApiHref({ campaignRange: 'all' })).toBe(
      '/admin/notifications/push-campaigns?take=20',
    );
    expect(buildPushCampaignListHref('today')).toBe('/notifications/push-send');
    expect(
      buildPushCampaignListHref('7d', {
        campaignRange: 'today',
        targetRole: 'CUSTOMER',
        title: 'Weekend blast',
      }),
    ).toBe('/notifications/push-send?targetRole=CUSTOMER&title=Weekend+blast&campaignRange=7d');
    expect(pushCampaignDateRangeLinks.map((item) => item.range)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'all',
    ]);
    expect(pushCampaignDateRangeLabel('yesterday')).toBe('Previous day');
  });
});
