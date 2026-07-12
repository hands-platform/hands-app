import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { apiGet } from '../../lib/admin-api';
import SetupPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    apiGet: vi.fn(),
  };
});

const mockedApiGet = vi.mocked(apiGet);
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('SetupPage', () => {
  beforeEach(() => {
    mockedApiGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('uses the shared Vuexy page template surface instead of a raw setup wrapper', () => {
    const source = readFileSync(join(process.cwd(), 'app/setup/page.tsx'), 'utf8');

    expect(source).toContain('AdminPageTemplate');
    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('contentClassName="setup-page"');
    expect(source).not.toContain('<div className="setup-page">');
    expect(source).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('renders setup readiness content inside the shared page header rhythm', async () => {
    const page = await SetupPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('class="admin-page-header admin-page-header-toolbar"');
    expect(markup).toContain('<h1>Developer Setup</h1>');
    expect(markup).toContain('External setup');
    expect(markup).toContain('Setup group details');
    expect(markup).toContain('class="setup-page"');
  });

  it('scopes setup header rules to root, direct cards, detail-grid cards, and stack cards', () => {
    expect(globalCss).toContain('.setup-page > .ops-section-header > div,');
    expect(globalCss).toContain('.setup-page > .card > .ops-section-header > div,');
    expect(globalCss).toContain('.setup-page > .detail-grid > .card > .ops-section-header > div,');
    expect(globalCss).toContain('.setup-page > .stack > .card > .ops-section-header > div {');
    expect(globalCss).toContain('.setup-page > .ops-section-header,');
    expect(globalCss).toContain('.setup-page > .stack > .card > .ops-section-header {');
    expect(globalCss).not.toContain('.setup-page .ops-section-header > div');
    expect(globalCss).not.toContain('.setup-page .toolbar .actions');
    expect(globalCss).not.toContain('.setup-page .ops-section-header {');
  });
});
