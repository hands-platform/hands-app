import { renderToStaticMarkup } from 'react-dom/server';
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

  it('renders page actions through the shared Vuexy link atom', async () => {
    const page = await NotificationTemplatesPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).toContain('href="/notifications"');
    expect(markup).toContain('href="/notifications/push-send"');
  });
});
