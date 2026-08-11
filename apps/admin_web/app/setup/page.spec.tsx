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
    expect(source).toContain('contentClassName="setup-page"');
    expect(source).not.toContain('<div className="setup-page">');
  });

  it('renders operator-facing system health without developer setup material', async () => {
    const page = await SetupPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('class="admin-page-header admin-page-header-toolbar"');
    expect(markup).toContain('<h1>Setup Readiness</h1>');
    expect(markup).toContain('System health');
    expect(markup).toContain('Affected work');
    expect(markup).toContain('Owning team');
    expect(markup).toContain('Next action');
    expect(markup).toContain('class="setup-page"');
    expect(markup).not.toContain('Developer readiness');
    expect(markup).not.toContain('Production E2E');
    expect(markup).not.toContain('Setup group details');
    expect(markup).not.toContain('npm.cmd');
  });

  it('keeps team ownership primary and contact addresses secondary', () => {
    const source = readFileSync(join(process.cwd(), 'app/setup/setup-overview-section.tsx'), 'utf8');

    expect(source).toContain('className="setup-health-owner"');
    expect(source).toContain("contacts.length ? 'Operations team' : 'Owner unavailable'");
    expect(source).toContain("<small>{contacts.join(', ')}</small>");
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
