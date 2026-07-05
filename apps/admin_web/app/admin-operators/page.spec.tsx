import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    mockedAdminGet.mockImplementation(async (path) => {
      if (String(path).startsWith('/admin/audit-logs')) {
        return [
          {
            id: 'audit-1',
            action: 'admin_web.page_view',
            target: '/bookings',
            metadata: { category: 'BOOKINGS' },
            createdAt: '2026-06-30T09:30:00.000Z',
            actor: {
              id: 'ops-admin-1',
              email: 'ops@hands.vn',
              phone: '+84900000002',
              fullName: 'Booking Operator',
            },
          },
          {
            id: 'audit-2',
            action: 'admin_web.action_denied',
            target: 'POST /admin/manual-wallet-adjustments',
            metadata: { category: 'FINANCE', status: 403 },
            createdAt: '2026-06-30T09:35:00.000Z',
            actor: {
              id: 'ops-admin-1',
              email: 'ops@hands.vn',
              phone: '+84900000002',
              fullName: 'Booking Operator',
            },
          },
        ] as never;
      }

      return [
        {
          id: 'master-admin-1',
          roles: ['ADMIN', 'FINANCE_APPROVER', 'MASTER_ADMIN'],
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
      ] as never;
    });
  });

  it('renders a master admin workspace from the bounded admin users API', async () => {
    const page = await AdminOperatorsPage({});
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/users?take=100', []);
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/audit-logs?bucket=Admin%20Web&take=30', []);
    expect(markup).toContain('Admin Operators');
    expect(markup).toContain('Master admin control');
    expect(markup).toContain('Add operator');
    expect(markup).toContain('Delete operator');
    expect(markup).not.toContain('Delete operator access');
    expect(markup).not.toContain('Admin user ID');
    expect(markup).not.toContain('Operator phone');
    expect(markup).toContain('Operator email');
    expect(markup).toContain('Temporary password');
    expect(markup).not.toContain('Master Admin has full access automatically.');
    expect(markup).not.toContain('No category setup is required while this role is active.');
    expect(markup).toContain('Category permissions');
    expect(markup).toContain('card admin-card admin-operator-control-card');
    expect(markup).toContain('card admin-card admin-operator-permission-item');
    expect(markup).not.toContain('<article class="admin-operator-permission-item');
    expect(markup).toContain('Bookings');
    expect(markup).toContain('Realtime bookings');
    expect(markup).toContain('Booking cancellations');
    expect(markup).toContain('Finance');
    expect(markup).toContain('Tax &amp; Accounting');
    expect(markup).toContain('Wallet adjustments');
    expect(markup).toContain('Communications');
    expect(markup).toContain('Policies &amp; Setup');
    expect(markup).toContain('Admin Control');
    expect(markup).toContain('Admin operators');
    expect(markup).toContain('Master Admin');
    expect(markup).toContain('Booking Operator');
    expect(markup).not.toContain('Customer User');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('Save permissions');
    expect(markup).toContain('Operator activity log');
    expect(markup).toContain('page view');
    expect(markup).toContain('action denied');
    expect(markup).toContain('/bookings');
    expect(markup).toContain('POST /admin/manual-wallet-adjustments');
    expect(markup).not.toContain('API required');
  });

  it('uses shared badge atoms for operator role and category chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/admin-operators/page.tsx'), 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminFormCard');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<form action={createAdminOperator} className="admin-operator-control-card"');
    expect(source).not.toContain('<span className="pill pill-neutral">{category.group}</span>');
    expect(source).not.toContain('<span className="pill pill-primary">All categories</span>');
    expect(source).not.toContain('<span className="pill pill-info" key={`${user.id}:${label}`}>');
    expect(source).not.toContain('<span className={operatorRolePillClassName(role)} key={role}>');
  });

  it('uses the shared DateTimeText atom for visible operator timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'app/admin-operators/page.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<td>{formatDateTime(log.createdAt)}</td>');
    expect(source).not.toContain('return latest?.lastSeenAt ? formatDateTime(latest.lastSeenAt) :');
  });

  it('uses shared inline fallback atoms for missing operator session fields', () => {
    const source = readFileSync(join(process.cwd(), 'app/admin-operators/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain("'No recent session'");
    expect(source).not.toContain("<div className=\"muted\">{user.appSessions?.[0]?.platform ?? 'No platform'}</div>");
  });
});
