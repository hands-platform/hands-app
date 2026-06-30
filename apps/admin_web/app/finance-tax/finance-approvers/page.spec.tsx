import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import FinanceApproversPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('FinanceApproversPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockResolvedValue([
      {
        id: 'finance-admin-1',
        roles: ['ADMIN', 'FINANCE_APPROVER'],
        fullName: 'Finance Admin',
        phone: '+84900000001',
        appSessions: [],
        pushDevices: [],
      },
      {
        id: 'support-admin-1',
        roles: ['ADMIN'],
        fullName: 'Support Admin',
        phone: '+84900000002',
        appSessions: [],
        pushDevices: [],
      },
      {
        id: 'customer-user-1',
        roles: ['CUSTOMER'],
        fullName: 'Customer User',
        phone: '+84900000003',
        appSessions: [],
        pushDevices: [],
      },
    ]);
  });

  it('keeps the approver role form on shared AdminForm atoms and only lists admin users', async () => {
    const page = await FinanceApproversPage({ searchParams: Promise.resolve({ roleNotice: 'updated' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/users?take=100', []);
    expect(markup).toContain('Finance approver role was updated');
    expect(markup).toContain('Finance Admin');
    expect(markup).toContain('Support Admin');
    expect(markup).not.toContain('Customer User');
    expect(markup).toContain('admin-form-input');
    expect(markup).not.toContain('class="form-input"');
  });
});
