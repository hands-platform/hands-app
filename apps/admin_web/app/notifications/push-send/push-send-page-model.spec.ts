import {
  buildPushCampaignApiHref,
  buildPushCampaignListHref,
  buildPushCampaignPageHref,
  buildPushCampaignSummaryApiHref,
  buildPushRecipientSearchApiHref,
  buildPushRecipientSelectionHref,
  normalizePushCampaignPage,
  pushCampaignDateRangeLabel,
  pushCampaignDateRangeLinks,
  shouldRequestPushCampaignPreview,
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

  it('builds server pagination params for manual push campaign history', () => {
    const href = buildPushCampaignApiHref({ campaignPage: '3', campaignRange: '30d' });
    const url = new URL(href, 'http://admin.local');

    expect(url.searchParams.get('take')).toBe('20');
    expect(url.searchParams.get('skip')).toBe('40');
    expect(normalizePushCampaignPage('0')).toBe(1);
    expect(normalizePushCampaignPage('3.9')).toBe(3);
    expect(buildPushCampaignPageHref(4, { campaignPage: '2', campaignRange: '7d', title: 'Blast' })).toBe(
      '/notifications/push-send?campaignRange=7d&title=Blast&campaignPage=4',
    );
    expect(buildPushCampaignListHref('today', { campaignPage: '4', campaignRange: '7d' })).toBe(
      '/notifications/push-send',
    );
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

  it('keeps campaign history navigation from rerunning recipient preview counts', () => {
    expect(
      buildPushCampaignListHref('7d', {
        campaignRange: 'today',
        campaignPage: '3',
        preview: '1',
        title: 'Weekend blast',
        body: 'Slots are open',
      }),
    ).toBe('/notifications/push-send?title=Weekend+blast&body=Slots+are+open&campaignRange=7d');
    expect(
      buildPushCampaignPageHref(2, {
        campaignRange: '7d',
        preview: '1',
        title: 'Weekend blast',
        body: 'Slots are open',
      }),
    ).toBe('/notifications/push-send?campaignRange=7d&title=Weekend+blast&body=Slots+are+open&campaignPage=2');
  });

  it('requires explicit preview intent before counting manual push recipients', () => {
    expect(shouldRequestPushCampaignPreview({ title: 'Weekend blast', body: 'Slots are open' })).toBe(false);
    expect(
      shouldRequestPushCampaignPreview({ preview: '1', title: 'Weekend blast', body: 'Slots are open' }),
    ).toBe(true);
    expect(shouldRequestPushCampaignPreview({ preview: '1', title: ' ', body: 'Slots are open' })).toBe(false);
    expect(shouldRequestPushCampaignPreview({ preview: '0', title: 'Weekend blast', body: 'Slots are open' })).toBe(
      false,
    );
  });

  it('uses existing customer and Partner directory search APIs', () => {
    expect(buildPushRecipientSearchApiHref('CUSTOMER', ' Mai ')).toBe(
      '/admin/customers?q=Mai&take=8&skip=0',
    );
    expect(buildPushRecipientSearchApiHref('PROVIDER', 'Linh')).toBe(
      '/admin/partners/list-providers?q=Linh&take=8',
    );
  });

  it('preserves campaign copy while selecting or clearing an account', () => {
    const selected = buildPushRecipientSelectionHref(
      { body: 'Open slots', preview: '1', title: 'Today', targetRole: 'CUSTOMER' },
      { recipientSearch: 'Mai', targetRole: 'CUSTOMER', targetUserId: 'user-1' },
    );
    const selectedUrl = new URL(selected, 'http://admin.local');

    expect(selectedUrl.searchParams.get('title')).toBe('Today');
    expect(selectedUrl.searchParams.get('body')).toBe('Open slots');
    expect(selectedUrl.searchParams.get('recipientSearch')).toBe('Mai');
    expect(selectedUrl.searchParams.get('targetUserId')).toBe('user-1');
    expect(selectedUrl.searchParams.has('preview')).toBe(false);

    const cleared = new URL(
      buildPushRecipientSelectionHref(
        { recipientSearch: 'Mai', targetRole: 'CUSTOMER', targetUserId: 'user-1' },
        { recipientSearch: '', targetRole: 'CUSTOMER', targetUserId: null },
      ),
      'http://admin.local',
    );
    expect(cleared.searchParams.has('recipientSearch')).toBe(false);
    expect(cleared.searchParams.has('targetUserId')).toBe(false);
  });
});
