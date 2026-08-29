import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import NotificationTemplatesPage from './page';
import {
  isSourceCopiedIdentical,
  nextIncompleteTemplate,
  shouldApplySavedTemplateResponse,
  templateMatchesFilters,
  type TranslationDraft,
} from './notification-template-editor';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync('app/notifications/templates/page.tsx', 'utf8');
const editorSource = readFileSync('app/notifications/templates/notification-template-editor.tsx', 'utf8');
const fixtureSource = readFileSync('app/notifications/templates/notification-template-browser-fixtures.ts', 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

const template = {
  audience: 'CUSTOMER', channel: 'BOTH', createdAt: '2026-08-02T00:00:00.000Z',
  description: 'Customer notice when a Partner joins.', enabled: true, id: 'template-1', key: 'provider.joined',
  requiredVariables: ['partnerName'], updatedAt: '2026-08-12T10:00:00.000Z', variables: ['partnerName'],
  runtimeRoutes: [{ targetRole: 'CUSTOMER' as const, type: 'provider.joined' }],
  translations: [
    { body: '{partnerName} joined.', createdAt: '2026-08-02T00:00:00.000Z', id: 'translation-1', locale: 'en', status: 'READY' as const, templateId: 'template-1', title: 'Partner joined', updatedAt: '2026-08-02T00:00:00.000Z' },
    { body: '{partnerName} joined.', createdAt: '2026-08-02T00:00:00.000Z', id: 'translation-2', locale: 'vi', status: 'SOURCE_COPIED' as const, templateId: 'template-1', title: 'Partner joined', updatedAt: '2026-08-02T00:00:00.000Z' },
  ],
};

const catalog = {
  health: { complete: true, contractIssues: [], missingKeys: [], unexpectedKeys: [] },
  lastChange: { actorId: 'admin-1', changedAt: '2026-08-12T10:00:00.000Z', templateKey: 'provider.joined' },
  statusCounts: { READY: 1, SOURCE_COPIED: 1 }, templates: [template],
};

describe('NotificationTemplatesPage', () => {
  beforeEach(() => mockedAdminGetResult.mockResolvedValue({ data: catalog, ok: true, status: 200 }));

  it('loads the bounded catalog through an error-aware result', async () => {
    await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/notifications/templates?take=50',
      expect.objectContaining({ templates: [] }),
      {
        freshness: 'stable',
        revalidateSeconds: 300,
        tags: ['notification-template-catalog'],
      },
    );
  });

  it('separates API failure from an empty catalog', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: { health: { complete: false, contractIssues: [], missingKeys: [], unexpectedKeys: [] }, lastChange: null, statusCounts: {}, templates: [] }, ok: false, requestId: 'req-1', status: 500 });
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Notification copy is unavailable');
    expect(markup).toContain('Request req-1');
    expect(markup).toContain('Retry loading templates');
    expect(markup).not.toContain('Managed copy catalog');
    expect(markup).not.toContain('No notification templates are available');
  });

  it('distinguishes operator permission failure from a service outage', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: { health: { complete: false, contractIssues: [], missingKeys: [], unexpectedKeys: [] }, lastChange: null, statusCounts: {}, templates: [] }, ok: false, status: 403 });
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Notification copy access denied');
    expect(markup).toContain('cannot read or update managed notification copy');
  });

  it('blocks editing when the catalog contract is incomplete', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { ...catalog, health: { complete: false, contractIssues: ['Missing catalog key: chat.message.partner'], missingKeys: ['chat.message.partner'], unexpectedKeys: [] } },
      ok: true,
      status: 200,
    });
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Notification contract issues');
    expect(markup).toContain('chat.message.partner');
    expect(markup).toContain('Managed copy catalog');
  });

  it('renders compact readiness, searchable catalog, and managed-copy semantics', async () => {
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({ locale: 'vi', template: 'provider.joined' }) }));
    expect(markup).toContain('Language versions needing translation');
    expect(markup).toContain('Needs review');
    expect(markup).toContain('Contract issues');
    expect(markup).toContain('Managed copy off');
    expect(markup).toContain('Search copy or event key');
    expect(markup).toContain('All channels');
    expect(markup).toContain('All managed states');
    expect(markup).toContain('Push + in-app');
    expect(markup).toContain('provider.joined → Customer');
    expect(markup).toContain('When off, notifications still send using the code fallback copy.');
    expect(markup).not.toContain('Paused');
  });

  it('keeps five accessible language tabs and runtime previews in one atomic form', async () => {
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({ locale: 'en', template: 'provider.joined' }) }));
    expect(markup.match(/role="tab"/g)).toHaveLength(5);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup).toContain('aria-controls="notification-copy-panel-en"');
    expect(markup).toContain('Push');
    expect(markup).toContain('In-app');
    expect(markup).toContain('Change reason');
    expect(markup.match(/<form/g)).toHaveLength(1);
    expect(markup).not.toContain('Not saved');
    expect(markup).not.toContain('role="status"');
  });

  it('renders the separate identical-copy exception before readiness can be selected', async () => {
    const markup = renderToStaticMarkup(await NotificationTemplatesPage({ searchParams: Promise.resolve({ locale: 'vi', template: 'provider.joined' }) }));
    expect(markup).toContain('This copy still matches the English source.');
    expect(markup).toContain('Confirm this language intentionally matches English');
    expect(markup).toContain('Reviewed and ready');
    expect(markup).toContain('disabled=""');
  });

  it('keeps draft recovery, keyboard tabs, URL context, and variable validation in the client contract', () => {
    expect(editorSource).toContain("useActionState(");
    expect(editorSource).toContain("event.key === 'ArrowRight'");
    expect(editorSource).toContain("event.key === 'Home'");
    expect(editorSource).toContain('window.history.pushState');
    expect(editorSource).toContain("window.addEventListener('popstate'");
    expect(editorSource).toContain('Copy my draft');
    expect(editorSource).toContain('textarea?.selectionStart');
    expect(editorSource).toContain('notificationTemplateValidationErrors');
    expect(editorSource).toContain("window.addEventListener('beforeunload'");
    expect(pageSource).toContain('adminGetResult');
  });

  it('keeps delayed save responses scoped to the template that started the save', () => {
    expect(shouldApplySavedTemplateResponse('booking.opened', 'booking.opened')).toBe(true);
    expect(shouldApplySavedTemplateResponse('provider.joined', 'booking.opened')).toBe(false);
  });

  it('detects unchanged source-copied copy and selects the next incomplete language item', () => {
    const draft = {
      en: { body: '{partnerName} joined.', confirmIdenticalTranslation: false, reviewedAndReady: true, title: 'Partner joined' },
      vi: { body: '{partnerName} joined.\r\n', confirmIdenticalTranslation: false, reviewedAndReady: false, title: ' Partner joined ' },
      ko: { body: '', confirmIdenticalTranslation: false, reviewedAndReady: false, title: '' },
      ja: { body: '', confirmIdenticalTranslation: false, reviewedAndReady: false, title: '' },
      zh: { body: '', confirmIdenticalTranslation: false, reviewedAndReady: false, title: '' },
    } satisfies TranslationDraft;
    expect(isSourceCopiedIdentical(template, draft, 'vi')).toBe(true);

    const readyTemplate = {
      ...template,
      key: 'booking.opened',
      translations: template.translations.map((translation) => translation.locale === 'vi'
        ? { ...translation, status: 'READY' as const }
        : translation),
    };
    expect(nextIncompleteTemplate([readyTemplate, template], readyTemplate.key, 'vi')?.key).toBe('provider.joined');
  });

  it('filters by the selected language status instead of template-wide readiness', () => {
    expect(templateMatchesFilters(template, {
      audience: 'all', channel: 'all', language: 'vi', managed: 'all', readiness: 'SOURCE_COPIED', search: '',
    })).toBe(true);
    expect(templateMatchesFilters(template, {
      audience: 'all', channel: 'all', language: 'vi', managed: 'all', readiness: 'READY', search: '',
    })).toBe(false);
  });

  it('uses high-contrast selected tabs and a 340px desktop catalog', () => {
    expect(globalCss).toContain('grid-template-columns: 340px minmax(0, 1fr)');
    expect(globalCss).toContain('.notification-template-language-tabs > button.is-active');
    expect(globalCss).toContain('background: var(--admin-accent)');
    expect(globalCss).toContain('color: #fff');
  });

  it('keeps the 1440px catalog filters inside the fixed desktop column', () => {
    expect(globalCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(globalCss).toContain('.notification-template-catalog-filters > *');
    expect(globalCss).toMatch(/\.notification-template-catalog\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;/s);
    expect(globalCss).toMatch(/\.notification-template-search\s*\{[^}]*max-width: 100%;[^}]*min-width: 0;/s);
  });

  it('gates browser-only error and conflict fixtures outside production', () => {
    expect(fixtureSource).toContain("process.env.NODE_ENV === 'production'");
    expect(fixtureSource).toContain("process.env.NOTIFICATION_TEMPLATE_BROWSER_FIXTURES_ENABLED !== '1'");
    expect(fixtureSource).toContain("'permission-denied'");
    expect(fixtureSource).toContain("'load-error'");
    expect(fixtureSource).toContain("'catalog-incomplete'");
    expect(fixtureSource).toContain("'conflict'");
    expect(fixtureSource).toContain("'save-success'");
    expect(fixtureSource).toContain("'slow-save'");
    expect(fixtureSource).toContain("'session-expired'");
    expect(fixtureSource).toContain("'source-unavailable'");
    expect(fixtureSource).toContain("'server-error'");
    expect(pageSource).toContain('initialActionState={browserActionState(browserFixture');
  });
});
