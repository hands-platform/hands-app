import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet, adminPost } from '../../../lib/admin-api';
import PushSendPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>(
    '../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGet: vi.fn(),
    adminPost: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminPost = vi.mocked(adminPost);
const pageSource = readFileSync('app/notifications/push-send/page.tsx', 'utf8');

describe('PushSendPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminPost.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
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

  it('renders the partner language lock through the shared static-value form atom', async () => {
    const page = await PushSendPage({
      searchParams: Promise.resolve({
        targetRole: 'PROVIDER',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('class="admin-form-static-value admin-form-control-labeled"');
    expect(markup).toContain('Vietnamese');
    expect(markup).not.toContain('<div class="admin-form-input"><span>Language</span>');
  });

  it('renders page actions through the shared Vuexy link atom', async () => {
    const page = await PushSendPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('href="/notifications"');
    expect(markup).toContain('href="/notifications/templates"');
  });

  it('uses the shared Vuexy notice card atom for send results', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('AdminSectionHeader');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<div className="ops-section-header">');
    expect(pageSource).not.toContain('className={`card admin-notice-card');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
  });

  it('uses the shared Vuexy card atom for push preview results', () => {
    expect(pageSource).toContain('AdminCard');
    expect(pageSource).not.toContain('<section className="notification-push-preview-card">');
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
});
