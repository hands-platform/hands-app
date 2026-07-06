import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import OperationsPolicyPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('OperationsPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders default policy page sections on shared Vuexy section surfaces', async () => {
    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('Live matching policy');
    expect(markup).toContain('Diagnostics loaded on demand');
    expect(markup).toContain('Operator decisions');
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Live matching policy',
    );
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Diagnostics loaded on demand',
    );
    expect(markup).not.toContain(
      '<section class="card admin-mb-16"><div class="ops-section-header"><div><h2>Operator decisions',
    );
  });

  it('uses shared Vuexy badge atoms for page header counters', () => {
    expect(pageSource).toContain('AdminNoticeCard');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('tone={notice.tone === \'success\' ? \'success\' : \'danger\'}');
    expect(pageSource).not.toContain('<span className="pill pill-success">{matchingSettings.length} enforced policy</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{decisionSettings.length} decision item(s)</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{savedCount} saved override(s)</span>');
    expect(pageSource).not.toContain("notice.tone === 'success' ? 'admin-notice-success' : 'admin-notice-danger'");
  });

  it('uses the shared AdminFormControlLink atom for page-level actions', () => {
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('<Link className="button button-secondary"');
  });

  it('uses the shared Vuexy detail grid for policy form groups', () => {
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<div className="grid">');
  });

  it('uses the shared empty-state atom for missing policy setup copy', () => {
    expect(pageSource).toContain('AdminNotePanel');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).not.toContain('<div className="ops-task-note admin-m-0">');
    expect(pageSource).not.toContain('<h3>No matching policies loaded</h3>');
    expect(pageSource).not.toContain('<p className="muted">\n                Seed operational policies');
  });
});
