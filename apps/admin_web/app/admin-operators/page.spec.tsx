import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import AdminOperatorsPage from './page';

vi.mock('../../lib/admin-api', async () => ({
  ...(await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api')),
  adminGetResult: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);

const operator = {
  allowedActions: {
    initializeAccess: { allowed: false, blockedReasons: [{ code: 'PERMISSION_POLICY_EXISTS', message: 'The permission policy is already initialized.' }] },
    reactivate: { allowed: false, blockedReasons: [{ code: 'NOT_SUSPENDED', message: 'Only suspended operators can be reactivated.' }] },
    revokeOperatorAccess: { allowed: false, blockedReasons: [{ code: 'SELF_ACTION_FORBIDDEN', message: 'Another active Master Admin must perform this action.' }] },
    revokeSession: { allowed: false, blockedReasons: [{ code: 'SELF_ACTION_FORBIDDEN', message: 'Another active Master Admin must perform this action.' }] },
    suspend: { allowed: false, blockedReasons: [{ code: 'SELF_ACTION_FORBIDDEN', message: 'Another active Master Admin must perform this action.' }] },
    updateAccess: { allowed: false, blockedReasons: [{ code: 'SELF_ACTION_FORBIDDEN', message: 'Another active Master Admin must perform this action.' }] },
  },
  activeSessionCount: 1,
  createdAt: '2026-08-01T01:00:00.000Z',
  credential: {
    disabledAt: null,
    disabledReason: null,
    failedLoginCount: 0,
    lastLoginAt: '2026-08-11T03:00:00.000Z',
    lockedUntil: null,
    mfaState: 'NOT_CONFIGURED',
    passwordUpdatedAt: '2026-08-01T01:00:00.000Z',
    setupCompletedAt: '2026-08-01T01:00:00.000Z',
  },
  email: 'master@hands.vn',
  fullName: 'Master Operator',
  id: 'master-1',
  lastSession: {
    expiresAt: '2026-08-12T12:00:00.000Z',
    id: 'session-1',
    lastSeenAt: '2026-08-11T03:00:00.000Z',
    platformSummary: 'Admin Web · Windows',
    revokedAt: null,
  },
  lifecycleStatus: 'ACTIVE',
  permission: {
    categories: ['BOOKINGS_REALTIME', 'CUSTOMERS_VIEW'],
    effectiveCategories: ['BOOKINGS_REALTIME'],
    effectiveLeafPermissionCount: 1,
    id: 'permission-1',
    storedPermissionCount: 2,
    updatedAt: '2026-08-10T01:00:00.000Z',
    version: 3,
  },
  phone: '+84900000001',
  roles: ['ADMIN', 'MASTER_ADMIN'],
  updatedAt: '2026-08-10T01:00:00.000Z',
} as const;

function ok<T>(data: T) {
  return { data, ok: true, status: 200 } as const;
}

describe('AdminOperatorsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (path, fallback) => {
      const value = String(path);
      if (value === '/admin/users/admin-operator-access') {
        return ok({ categories: ['SYSTEM_ADMIN_OPERATORS'], id: 'master-1', permissionState: 'CONFIGURED', roles: ['ADMIN', 'MASTER_ADMIN'] }) as never;
      }
      if (value.startsWith('/admin/users/admin-operators?')) {
        return ok({
          items: [operator],
          page: { filteredTotal: 1, hasNextPage: false, nextCursor: null, returned: 1 },
          summary: {
            finance: 0,
            locked: 0,
            master: 1,
            missingCredential: 0,
            missingPermission: 0,
            mfaNotConfigured: 1,
            securityIncompleteDistinct: 1,
            suspended: 0,
            total: 1,
          },
        }) as never;
      }
      if (value === '/admin/admin-operator-invitations') {
        return ok({ expiredCount: 0, items: [], pendingCount: 0, totalCount: 0 }) as never;
      }
      return ok(fallback) as never;
    });
  });

  it('renders the exact server-backed operator directory and secure invitation workflow', async () => {
    const markup = renderToStaticMarkup(await AdminOperatorsPage({}));

    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/users/admin-operator-access', null);
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/users/admin-operators?take=25',
      expect.objectContaining({ items: [], summary: expect.objectContaining({ total: 0 }) }),
    );
    expect(markup).toContain('Admin operators');
    expect(markup).toContain('Master Operator');
    expect(markup).toContain('MFA required');
    expect(markup).toContain('Invite operator');
    expect(markup).toContain('Operator Access directory');
    expect(markup).not.toContain('Temporary password');
    expect(markup).not.toContain('Delete operator');
    expect(markup).not.toContain('Remove operator');
  });

  it('passes search, status, role, and leaf permission filters to the server directory', async () => {
    await AdminOperatorsPage({
      searchParams: Promise.resolve({
        category: 'BOOKINGS_REALTIME',
        q: 'ops@hands.vn',
        role: 'ADMIN',
        status: 'active',
      }),
    });

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/users/admin-operators?q=ops%40hands.vn&status=active&role=ADMIN&category=BOOKINGS_REALTIME&take=25',
      expect.any(Object),
    );
  });

  it('keeps missing permission records deny-by-default and visible to operators', async () => {
    mockedAdminGetResult.mockImplementation(async (path, fallback) => {
      const value = String(path);
      if (value === '/admin/users/admin-operator-access') {
        return ok({ categories: [], id: 'master-1', permissionState: 'CONFIGURED', roles: ['ADMIN', 'MASTER_ADMIN'] }) as never;
      }
      if (value.startsWith('/admin/users/admin-operators?')) {
        return ok({
          items: [{ ...operator, lifecycleStatus: 'MIGRATION_REQUIRED', permission: null }],
          page: { filteredTotal: 1, hasNextPage: false, nextCursor: null, returned: 1 },
          summary: {
            finance: 0,
            locked: 0,
            master: 1,
            missingCredential: 0,
            missingPermission: 1,
            mfaNotConfigured: 1,
            securityIncompleteDistinct: 1,
            suspended: 0,
            total: 1,
          },
        }) as never;
      }
      if (value === '/admin/admin-operator-invitations') return ok({ expiredCount: 0, items: [], pendingCount: 0, totalCount: 0 }) as never;
      return ok(fallback) as never;
    });

    const markup = renderToStaticMarkup(await AdminOperatorsPage({}));

    expect(markup).toContain('Permission setup required');
    expect(markup).toContain('deny-by-default');
    expect(markup).toContain('Migration required');
    expect(markup).toContain('Needs action');
    expect(markup).not.toContain('All access through Master Admin role</strong>');
  });

  it('uses scoped desktop table, drawer, and permission-group contracts', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/admin-operators/page.tsx'), 'utf8');
    const formSource = readFileSync(join(process.cwd(), 'app/admin-operators/operator-access-forms.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(pageSource).toContain('AdminTableScroll ariaLabel="Operator Access directory"');
    expect(pageSource).toContain('operator-access-command-strip');
    expect(pageSource).toContain("headers={['Operator', 'Status', 'Roles', 'Effective access', 'Security', 'Last sign-in', 'Action']}");
    expect(pageSource).toContain('Finance Approver is read-only here.');
    expect(formSource).toContain('<details key={group}');
    expect(formSource).toContain('<dialog');
    expect(formSource).toContain('Confirm access change for {operatorName}');
    expect(formSource).toContain('active session(s) remain active');
    expect(formSource).toContain('This setup token is shown only in this receipt.');
    expect(pageSource).toContain('previousPageHref(params)');
    expect(css).toContain('.operator-access-table :is(th, td):first-child');
    expect(css).toContain('.operator-access-drawer');
    expect(css).toContain('.operator-access-permission-groups');
  });
});
