import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import OperationsHandoffPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('OperationsHandoffPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['BOOKINGS_REALTIME'],
      email: 'ops@example.com',
      fullName: 'Ops',
      id: 'ops-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
  });

  it('renders the full details lazy-load prompt on a shared Vuexy surface', async () => {
    const page = await OperationsHandoffPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('Detailed handoff lists');
    expect(markup).toContain('card admin-section admin-mb-16 operations-handoff-full-details-card');
    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('/operations-handoff?details=all');
  });

  it('does not expose app session diagnostics links to ordinary operators', async () => {
    const page = await OperationsHandoffPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Customer app online');
    expect(markup).toContain('Partner app online');
    expect(markup).not.toContain('/app-sessions');
  });

  it('uses the shared Vuexy detail grid atom for brief and note panels', () => {
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<section className="detail-grid admin-mb-16"');
  });

  it('scopes handoff toolbar styling to direct page and detail grid cards', () => {
    expect(globalCss).toContain('.operations-handoff-page > .card > .toolbar,');
    expect(globalCss).toContain('.operations-handoff-page > .detail-grid > .card > .toolbar {');
    expect(globalCss).toContain('.operations-handoff-page > .card > .toolbar h2,');
    expect(globalCss).toContain('.operations-handoff-page > .detail-grid > .card > .toolbar h2 {');
    expect(globalCss).not.toContain('.operations-handoff-page .card .toolbar');
  });
});
