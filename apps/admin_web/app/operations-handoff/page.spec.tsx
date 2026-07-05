import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import OperationsHandoffPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('OperationsHandoffPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
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

  it('uses the shared Vuexy detail grid atom for brief and note panels', () => {
    expect(pageSource).toContain('AdminDetailGrid');
    expect(pageSource).not.toContain('<section className="detail-grid admin-mb-16"');
  });
});
