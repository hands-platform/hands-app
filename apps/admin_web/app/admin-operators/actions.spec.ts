import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import {
  adminDeleteWithBodyOrThrow,
  adminPatchOrThrow,
  adminPostOrThrow,
} from '../../lib/admin-api';
import {
  createAdminOperator,
  revokeAdminOperatorAccess,
  updateAdminOperatorAccess,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminDeleteWithBodyOrThrow: vi.fn(),
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
  isAdminApiAuthError: vi.fn((error: unknown) => error instanceof Error && error.message === 'auth'),
}));

const mockedAdminDeleteWithBodyOrThrow = vi.mocked(adminDeleteWithBodyOrThrow);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('admin operator server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminDeleteWithBodyOrThrow.mockResolvedValue({ ok: true });
    mockedAdminPatchOrThrow.mockResolvedValue({ user: { id: 'admin-2' } });
    mockedAdminPostOrThrow.mockResolvedValue({ user: { id: 'admin-2' } });
  });

  it('creates an operator through the Admin API boundary with constrained roles and categories', async () => {
    const formData = new FormData();
    formData.set('email', ' operator@hands.vn ');
    formData.set('password', ' temp-password-123 ');
    formData.set('fullName', ' Ops Admin ');
    formData.append('roles', 'MASTER_ADMIN');
    formData.append('roles', 'CUSTOMER');
    formData.append('permissionCategories', 'BOOKINGS_REALTIME');
    formData.append('permissionCategories', 'SYSTEM_ADMIN_OPERATORS');
    formData.append('permissionCategories', 'UNKNOWN');
    formData.set('reason', ' Launch desk ');

    await createAdminOperator(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/users/admin-operators', {
      email: 'operator@hands.vn',
      fullName: 'Ops Admin',
      password: 'temp-password-123',
      permissionCategories: ['BOOKINGS_REALTIME', 'SYSTEM_ADMIN_OPERATORS'],
      reason: 'Launch desk',
      roles: ['ADMIN', 'MASTER_ADMIN'],
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin-operators');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
    expect(mockedRedirect).toHaveBeenCalledWith('/admin-operators?operatorNotice=created');
  });

  it('updates operator access without allowing product roles in the payload', async () => {
    const formData = new FormData();
    formData.set('userId', ' admin-2 ');
    formData.append('roles', 'FINANCE_APPROVER');
    formData.append('roles', 'PROVIDER');
    formData.append('permissionCategories', 'FINANCE');
    formData.set('reason', ' Finance rotation ');

    await updateAdminOperatorAccess(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith('/admin/users/admin-2/admin-operator-access', {
      permissionCategories: ['FINANCE'],
      reason: 'Finance rotation',
      roles: ['ADMIN', 'FINANCE_APPROVER'],
    });
    expect(mockedRedirect).toHaveBeenCalledWith('/admin-operators?operatorNotice=updated');
  });

  it('revokes operator access with an audit reason body', async () => {
    const formData = new FormData();
    formData.set('userId', ' admin-2 ');
    formData.set('reason', ' Left the operations team ');

    await revokeAdminOperatorAccess(formData);

    expect(mockedAdminDeleteWithBodyOrThrow).toHaveBeenCalledWith('/admin/users/admin-2/admin-operator', {
      reason: 'Left the operations team',
    });
    expect(mockedRedirect).toHaveBeenCalledWith('/admin-operators?operatorNotice=revoked');
  });

  it('redirects missing email before creating an operator', async () => {
    await createAdminOperator(new FormData());

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/admin-operators?operatorNotice=missing-email');
  });

  it('redirects missing password before creating an operator', async () => {
    const formData = new FormData();
    formData.set('email', 'operator@hands.vn');

    await createAdminOperator(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/admin-operators?operatorNotice=missing-password');
  });
});
