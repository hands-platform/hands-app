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
const editorSource = readFileSync('app/notifications/templates/notification-template-editor.tsx', 'utf8');
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

  it('relies on the Messaging workspace navigation instead of duplicate page actions', async () => {
    const page = await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('>Delivery board<');
    expect(markup).not.toContain('>Push send<');
  });

  it('scopes template KPI cards as records, live availability, and audience coverage', async () => {
    const page = await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Template records');
    expect(markup).toContain('Live');
    expect(markup).toContain('Audience coverage');
    expect(markup).toContain('Notification event records in the bounded catalog.');
    expect(markup).toContain('Templates currently available to operating flows.');
    expect(markup).not.toContain('Managed notification events');
    expect(markup).not.toContain('Available to operating flows');
  });

  it('uses the shared Vuexy notice card atom for template results', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('AdminSectionHeader');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<div className="ops-section-header">');
    expect(pageSource).not.toContain('className={`card admin-notice-card');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
    expect(pageSource).not.toContain('<section\n              className="notification-template-card"');
    expect(pageSource).not.toContain('<div className="notification-template-card-header">');
  });

  it('uses one atomic multilingual editor instead of repeated language forms', () => {
    expect(pageSource).toContain('NotificationTemplateEditor');
    expect(pageSource).toContain('AdminSection');
    expect(pageSource).not.toContain('AdminFilterPanel');
    expect(pageSource).not.toContain('templates.map((template) =>');
    expect(editorSource).toContain('Technical details');
    expect(editorSource).toContain('role="tablist"');
    expect(editorSource).toContain("'Changed' : complete ? 'Complete' : 'Incomplete'");
    expect(editorSource).toContain('Message preview');
    expect(editorSource).toContain('Changes in this editing session');
    expect(editorSource).toContain('Save all changed languages');
    expect(editorSource).toContain("window.addEventListener('beforeunload'");
    expect(editorSource).toContain('window.confirm(');
    expect(editorSource).toContain('JSON.stringify(translationPayload)');
  });

  it('keeps the language and save summary layout in shared page CSS', () => {
    expect(globalCss).toContain('.notification-template-language-tabs');
    expect(globalCss).toContain('.notification-template-language-tabs > button.is-active');
    expect(globalCss).toContain('.notification-template-change-summary');
  });

  it('renders a selected template with five language states and one save action', async () => {
    mockedAdminGet.mockResolvedValue([
      {
        audience: 'PROVIDER',
        channel: 'PUSH',
        createdAt: '2026-08-02T00:00:00.000Z',
        description: 'Partner registration event.',
        enabled: true,
        id: 'template-1',
        key: 'provider.joined',
        requiredVariables: ['partnerName'],
        translations: [
          {
            body: '{partnerName} joined.',
            createdAt: '2026-08-02T00:00:00.000Z',
            id: 'translation-1',
            locale: 'en',
            templateId: 'template-1',
            title: 'Partner joined',
            updatedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
        updatedAt: '2026-08-02T00:00:00.000Z',
        variables: ['partnerName'],
      },
    ]);

    const page = await NotificationTemplatesPage({
      searchParams: Promise.resolve({ locale: 'en', template: 'provider.joined' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner joined');
    expect(markup).toContain('Technical details');
    expect(markup).toContain('provider.joined');
    expect(markup.match(/role="tab"/g)).toHaveLength(5);
    expect(markup.match(/Save all changed languages/g)).toHaveLength(1);
    expect(markup.match(/<form/g)).toHaveLength(1);
  });
});
