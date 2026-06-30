import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../../lib/admin-api';
import { updateFinanceApproverRole } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('finance approver role actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatchOrThrow.mockResolvedValue({ user: { id: 'finance-admin-2' } });
  });

  it('updates finance approver role through the admin API and refreshes finance pages', async () => {
    const formData = new FormData();
    formData.set('userId', ' finance-admin-2 ');
    formData.set('enabled', 'true');
    formData.set('reason', ' Treasury owner ');
    formData.set('returnTo', '/finance-tax/finance-approvers?notice=ready');

    await updateFinanceApproverRole(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/users/finance-admin-2/finance-approver',
      {
        enabled: true,
        reason: 'Treasury owner',
      },
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/finance-approvers');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/finance-approvers?notice=ready&roleNotice=updated',
    );
  });

  it('keeps finance approver redirects scoped to the finance approver page', async () => {
    const formData = new FormData();
    formData.set('userId', 'finance-admin-2');
    formData.set('enabled', 'false');
    formData.set('returnTo', '/partners');

    await updateFinanceApproverRole(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/users/finance-admin-2/finance-approver',
      {
        enabled: false,
        reason: undefined,
      },
    );
    expect(mockedRedirect).toHaveBeenCalledWith('/finance-tax/finance-approvers?roleNotice=updated');
  });

  it('redirects with an invalid notice when the target user is missing', async () => {
    const formData = new FormData();
    formData.set('enabled', 'true');

    await updateFinanceApproverRole(formData);

    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/finance-tax/finance-approvers?roleNotice=invalid');
  });
});
