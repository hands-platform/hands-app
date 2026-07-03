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

describe('OperationsPolicyPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders default policy page sections on shared Vuexy section surfaces', async () => {
    const page = await OperationsPolicyPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

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
});
