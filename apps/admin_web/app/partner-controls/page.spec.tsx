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
    expect(markup).toContain('id="partner-control-unblock-board"');
    expect(markup).toContain('id="partner-control-unblock-playbook"');
    expect(markup).toContain('id="partner-control-block-matrix"');
    expect(markup).toContain('id="partner-control-filters"');
    expect(markup).toContain('id="partner-control-checklist"');
    expect(markup).toContain('id="partner-control-create-report"');
    expect(markup).toContain('id="partner-control-reports"');
    expect(markup).toContain('id="partner-control-account-controls"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-command-center"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-next-actions"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-board"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-unblock-board"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-unblock-playbook"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-block-matrix"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-filters"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-checklist"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-create-report"');
    expect(markup).toContain('class="card admin-section admin-mb-16" id="partner-control-reports"');
    expect(markup).toContain('class="card admin-section" id="partner-control-account-controls"');
  });
});
