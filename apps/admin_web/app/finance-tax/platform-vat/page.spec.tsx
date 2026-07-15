import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

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
    expect(markup).toContain('Active platform VAT filters');
    expect(markup).toContain('Period: 2026-06');
    expect(markup).toContain('Currency: VND');
    expect(markup).toContain('VAT command board');
    expect(markup).toContain('Output VAT');
    expect(markup).toContain('Net revenue');
    expect(markup).toContain('VAT rate breakdown');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('keeps the platform VAT period compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="VAT command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps platform VAT CSV download off the page payload', () => {
    expect(source).toContain('buildPlatformVatExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildPlatformVatSummaryCsvHref');
  });
});
