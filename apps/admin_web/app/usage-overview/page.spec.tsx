import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import UsageOverviewPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('UsageOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders usage overview from the bounded summary API with shared Vuexy section surfaces', async () => {
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/usage-overview?range=7d', expect.any(Object));
    expect(markup).toContain('Usage Overview');
    expect(markup).toContain('Customer app-to-booking funnel');
    expect(markup).toContain('Customer segments');
    expect(markup).toContain('Action priorities');
    expect(markup).toContain('card admin-section usage-overview-funnel-card');
    expect(markup).toContain('admin-section-body usage-overview-funnel-steps');
    expect(markup).toContain('card admin-section usage-overview-segment-board-card');
    expect(markup).toContain('admin-section-body usage-overview-segment-board-grid');
    expect(markup).toContain('card admin-section usage-overview-action-card');
    expect(markup).toContain('admin-section-body usage-overview-action-list');
  });
});
