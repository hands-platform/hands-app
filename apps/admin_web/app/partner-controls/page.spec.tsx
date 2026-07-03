import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import PartnerControlsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('PartnerControlsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders top partner control boards with the shared Vuexy section surface', async () => {
    const page = await PartnerControlsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="partner-control-command-center"');
    expect(markup).toContain('id="partner-control-next-actions"');
    expect(markup).toContain('id="partner-control-board"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-command-center"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-next-actions"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-board"');
  });
});
