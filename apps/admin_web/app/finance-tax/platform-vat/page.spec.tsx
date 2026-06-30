import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import PlatformVatPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('PlatformVatPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps the period filter on shared AdminForm atoms', async () => {
    const page = await PlatformVatPage({
      searchParams: Promise.resolve({ period: '2026-06' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Platform VAT period');
    expect(markup).toContain('VAT rate breakdown');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });
});
