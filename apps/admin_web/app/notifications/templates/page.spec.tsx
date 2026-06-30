import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import NotificationTemplatesPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('NotificationTemplatesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('loads the template catalog with a bounded default list size', async () => {
    await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/notifications/templates?take=50', []);
  });
});
