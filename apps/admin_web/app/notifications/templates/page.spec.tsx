import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import NotificationTemplatesPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync('app/notifications/templates/page.tsx', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('NotificationTemplatesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('loads the template catalog with a bounded default list size', async () => {
    await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/notifications/templates?take=50', []);
  });

  it('renders page actions through the shared Vuexy link atom', async () => {
    const page = await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('href="/notifications"');
    expect(markup).toContain('href="/notifications/push-send"');
  });

  it('uses the shared Vuexy notice card atom for template results', () => {
    expect(pageSource).toContain('AdminCard');
    expect(pageSource).toContain('AdminCardHeader');
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('AdminSectionHeader');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<div className="ops-section-header">');
    expect(pageSource).not.toContain('className={`card admin-notice-card');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
    expect(pageSource).not.toContain('<section\n              className="notification-template-card"');
    expect(pageSource).not.toContain('<div className="notification-template-card-header">');
  });

  it('uses the shared Vuexy card grid atom for template cards', () => {
    expect(pageSource).toContain('AdminCardGrid');
    expect(pageSource).not.toContain('<div className="notification-template-grid">');
  });

  it('scopes template header typography to direct Vuexy card slots', () => {
    expect(globalCss).toContain('.notification-template-card > .admin-card-header,');
    expect(globalCss).toContain('.notification-template-card > .admin-card-header > div > h3,');
    expect(globalCss).toContain('.notification-template-copy-form-header > h4');

    expect(globalCss).not.toContain('.notification-template-card .admin-card-header,');
    expect(globalCss).not.toContain('.notification-template-card .admin-card-header h3,');
    expect(globalCss).not.toContain('.notification-template-copy-form-header h4');
  });
});
