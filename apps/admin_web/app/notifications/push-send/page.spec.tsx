import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet, adminGetResult, adminPost } from '../../../lib/admin-api';
import PushSendPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>(
    '../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGet: vi.fn(),
    adminGetResult: vi.fn(),
    adminPost: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedAdminPost = vi.mocked(adminPost);
const pageSource = readFileSync('app/notifications/push-send/page.tsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('PushSendPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGetResult.mockReset();
    mockedAdminPost.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
    mockedAdminPost.mockImplementation(async (_href, _body, fallback) => fallback);
  });

  it('renders recent push campaigns on the shared Vuexy table-card surface', async () => {
    const page = await PushSendPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Recent push campaigns / Today');
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(markup).toContain('No manual push campaigns yet.');
  });

  it('scopes push KPI cards by campaign range and delivery history', async () => {
    const page = await PushSendPage({
      searchParams: Promise.resolve({ campaignRange: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Last 7 days');
    expect(markup).toContain('Delivery history');
    expect(markup).toContain('Manual push campaigns in this period.');
    expect(markup).toContain('Most recent manual push record.');
    expect(markup).toContain('Recipient total across campaigns in this period.');
    expect(markup).not.toContain('manual sends;');
  });

  it('renders the partner language lock through the shared static-value form atom', async () => {
    const page = await PushSendPage({
      searchParams: Promise.resolve({
        appDestination: 'earnings',
        targetSegment: 'provider_inactive_last_7_days',
        targetRole: 'PROVIDER',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Active push send filters');
    expect(markup).toContain('Target: Partners');
    expect(markup).toContain('Audience: Partners inactive for 7 days');
    expect(markup).toContain('Open page: Earnings');
    expect(markup).toContain('Language: Vietnamese');
    expect(markup).toContain('class="admin-form-static-value admin-form-control-labeled"');
    expect(markup).toContain('Vietnamese');
    expect(markup).not.toContain('<div class="admin-form-input"><span>Language</span>');
  });

  it('keeps Messaging navigation in the local workspace instead of duplicating page actions', async () => {
    const page = await PushSendPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('href="/notifications/templates"');
    expect(markup).not.toContain('>Templates<');
    expect(markup).not.toContain('>Delivery board<');
  });

  it('starts with name or phone account search and no raw user id field', async () => {
    const markup = renderToStaticMarkup(await PushSendPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Find account by name or phone');
    expect(markup).toContain('Search accounts');
    expect(markup).toContain('Enter at least 2 characters to search.');
    expect(markup).not.toContain('Specific user id');
    expect(markup).not.toContain('FCM deliveries');
  });

  it('renders account search results with masked phone, status, selection, and clear action', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: [{
        id: 'customer-profile-1',
        selectedLocationCount: 0,
        user: { id: 'user-secret-1', fullName: 'Mai Nguyen', phone: '+84912345678' },
      }],
      ok: true,
      status: 200,
    });

    const markup = renderToStaticMarkup(await PushSendPage({
      searchParams: Promise.resolve({
        recipientSearch: 'Mai',
        targetRole: 'CUSTOMER',
        targetUserId: 'user-secret-1',
      }),
    }));

    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/customers?q=Mai&take=8&skip=0', []);
    expect(markup).toContain('Mai Nguyen');
    expect(markup).toContain('+84******678');
    expect(markup).toContain('Customer account');
    expect(markup).toContain('Selected account');
    expect(markup).toContain('Clear account');
    expect(markup).not.toContain('>user-secret-1<');
  });

  it('distinguishes account search empty and error states', async () => {
    const emptyMarkup = renderToStaticMarkup(await PushSendPage({
      searchParams: Promise.resolve({ recipientSearch: 'Nobody', targetRole: 'PROVIDER' }),
    }));
    expect(emptyMarkup).toContain('No Partner accounts match');

    mockedAdminGetResult.mockResolvedValue({ data: [], ok: false, status: 503 });
    const errorMarkup = renderToStaticMarkup(await PushSendPage({
      searchParams: Promise.resolve({ recipientSearch: 'Mai', targetRole: 'CUSTOMER' }),
    }));
    expect(errorMarkup).toContain('Account search unavailable');
    expect(errorMarkup).toContain('Retry account search');
  });

  it('keeps preview-first delivery and shows role, language, destination, and exclusions', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: [{
        id: 'customer-profile-1',
        selectedLocationCount: 0,
        user: { id: 'user-1', fullName: 'Mai Nguyen', phone: '+84912345678' },
      }],
      ok: true,
      status: 200,
    });
    mockedAdminPost.mockResolvedValue({
      appDestination: 'booking',
      capped: true,
      recipientCount: 12,
      sampleRecipients: [],
      sendLimit: 10,
      targetRole: 'CUSTOMER',
      targetSegment: 'all',
      targetUserId: 'user-1',
      willSendCount: 10,
    });

    const markup = renderToStaticMarkup(await PushSendPage({
      searchParams: Promise.resolve({
        appDestination: 'booking',
        body: 'Open slots',
        locale: 'ko',
        preview: '1',
        recipientSearch: 'Mai',
        targetRole: 'CUSTOMER',
        targetUserId: 'user-1',
        title: 'Today',
      }),
    }));

    expect(markup).toContain('Target role');
    expect(markup).toContain('Korean');
    expect(markup).toContain('Bookings');
    expect(markup).toContain('Excluded by send limit');
    expect(markup).toContain('>2<');
    expect(markup).toContain('Send push');
  });

  it('uses the shared Vuexy notice card atom for send results', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('AdminSectionHeader');
    expect(pageSource).toContain('AdminFilterSummary');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<div className="ops-section-header">');
    expect(pageSource).not.toContain('className={`card admin-notice-card');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
  });

  it('uses the shared Vuexy card atom for push preview results', () => {
    expect(pageSource).toContain('AdminCard');
    expect(pageSource).not.toContain('<section className="notification-push-preview-card">');
  });

  it('uses the shared inline fallback atom for preview recipients without push devices', () => {
    expect(pageSource).toContain('AdminInlineFallback');
    expect(pageSource).not.toContain(
      '<span className="muted">{recipient.pushDevices?.[0]?.platform ?? \'No device\'}</span>',
    );
  });

  it('uses the shared table pagination footer for recent campaigns', () => {
    expect(pageSource).toContain('AdminTablePanel');
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel="Push campaign pagination"');
    expect(pageSource).toContain('pageLinkClassName="vuexy-booking-page-link"');
    expect(pageSource).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
    expect(pageSource).not.toContain('className="admin-table-pagination-footer"');
    expect(pageSource).not.toContain('pageLinkClassName="vuexy-booking-pagination-link"');
  });

  it('uses the shared DateTimeText atom for visible campaign timestamps', () => {
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain(
      '<span className="muted">{formatDateTime(campaign.sentAt ?? campaign.createdAt)}</span>',
    );
    expect(pageSource).not.toContain('formatDateTime(campaigns[0].sentAt ?? campaigns[0].createdAt)');
  });

  it('scopes push preview typography to direct Vuexy preview slots', () => {
    expect(globalCss).toContain('.notification-push-preview-summary > div > strong');
    expect(globalCss).toContain('.notification-push-recipient > strong,');
    expect(globalCss).toContain('.notification-push-recipient > span');

    expect(globalCss).not.toContain('.notification-push-preview-summary strong {');
    expect(globalCss).not.toContain('.notification-push-recipient strong,');
    expect(globalCss).not.toContain('.notification-push-recipient span {');
  });
});
