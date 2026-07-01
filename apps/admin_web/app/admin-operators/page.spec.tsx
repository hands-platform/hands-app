import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import AdminOperatorsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

vi.mock('./actions', () => ({
  createAdminOperator: vi.fn(),
  revokeAdminOperatorAccess: vi.fn(),
  updateAdminOperatorAccess: vi.fn(),
}));

describe('AdminOperatorsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockResolvedValue([
      {
        id: 'master-admin-1',
        roles: ['ADMIN', 'FINANCE_APPROVER'],
        adminOperatorPermission: {
          id: 'permission-1',
          categories: ['BOOKINGS', 'FINANCE', 'SYSTEM'],
          updatedAt: '2026-06-30T09:00:00.000Z',
        },
        fullName: 'Master Admin',
        email: 'master@hands.vn',
        phone: '+84900000001',
        appSessions: [
          {
            id: 'session-1',
            role: 'ADMIN',
            deviceId: 'web-session',
            active: true,
            platform: 'WEB',
            lastSeenAt: '2026-06-30T09:00:00.000Z',
          },
        ],
        pushDevices: [],
      },
      {
        id: 'ops-admin-1',
        roles: ['ADMIN'],
        adminOperatorPermission: {
          id: 'permission-2',
          categories: ['BOOKINGS', 'CUSTOMERS', 'PARTNERS'],
          updatedAt: '2026-06-30T09:00:00.000Z',
        },
        fullName: 'Booking Operator',
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

  it('renders a master admin workspace from the bounded admin users API', async () => {
    const page = await AdminOperatorsPage();
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/users?take=100', []);
    expect(markup).toContain('Admin Operators');
    expect(markup).toContain('Master admin control');
    expect(markup).toContain('Add operator');
    expect(markup).toContain('Delete operator');
    expect(markup).toContain('Category permissions');
    expect(markup).toContain('Bookings');
    expect(markup).toContain('Finance');
    expect(markup).toContain('Notifications');
    expect(markup).toContain('Master Admin');
    expect(markup).toContain('Booking Operator');
    expect(markup).not.toContain('Customer User');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('Save permissions');
    expect(markup).not.toContain('API required');
  });
});
