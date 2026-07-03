import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet, adminPost } from '../../../lib/admin-api';
import PushSendPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>(
    '../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGet: vi.fn(),
    adminPost: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminPost = vi.mocked(adminPost);

describe('PushSendPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminPost.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedAdminPost.mockImplementation(async (_href, _body, fallback) => fallback);
  });

  it('renders recent push campaigns on the shared Vuexy table-card surface', async () => {
    const page = await PushSendPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Recent push campaigns / Today');
    expect(markup).toContain(
      'card admin-filter-panel vuexy-booking-table-card vuexy-booking-table-group',
    );
    expect(markup).toContain('No manual push campaigns yet.');
  });
});
