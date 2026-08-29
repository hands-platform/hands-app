import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { adminDeleteWithBodyOrThrow, adminPatchOrThrow, adminPostOrThrow } from '../../lib/admin-api';
import {
  inviteAdminOperator,
  initializeAdminOperatorPermission,
  manageAdminOperatorInvitation,
  offboardAdminOperator,
  revokeAdminOperatorSession,
  updateAdminOperatorAccess,
} from './actions';
import { INITIAL_ADMIN_OPERATOR_ACTION_STATE } from './action-state';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/admin-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-api')>()),
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
  adminDeleteWithBodyOrThrow: vi.fn(),
}));

const mockedAdminDeleteWithBodyOrThrow = vi.mocked(adminDeleteWithBodyOrThrow);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('admin operator server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a one-time invitation without accepting an operator password', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      auditLogId: 'audit-1',
      invitation: { expiresAt: '2026-08-15T12:00:00.000Z', id: 'invite-1' },
      setupToken: 'copy-once-token',
    });
    const formData = new FormData();
    formData.set('email', ' Operator@Hands.vn ');
    formData.set('fullName', ' Ops Admin ');
    formData.set('reason', ' Initial booking operator coverage ');
    formData.append('permissionCategories', 'BOOKINGS_REALTIME');
    formData.append('permissionCategories', 'CONTENT_VIEW');
    formData.append('permissionCategories', 'UNKNOWN');

    const state = await inviteAdminOperator(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/admin-operator-invitations', {
      email: 'operator@hands.vn',
      expiresInHours: 72,
      fullName: 'Ops Admin',
      masterAdminEnabled: false,
      permissionCategories: ['BOOKINGS_REALTIME', 'CONTENT_VIEW'],
      reason: 'Initial booking operator coverage',
      targetUserId: null,
    });
    expect(state).toMatchObject({ status: 'success', receipt: { auditId: 'audit-1' } });
    expect(state.receipt?.setupPath).toContain('copy-once-token');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin-operators');
  });

  it('binds a linked invitation to the server-verified existing User ID', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      auditLogId: 'audit-linked-1',
      invitation: { expiresAt: '2026-08-15T12:00:00.000Z', id: 'invite-linked-1' },
      setupToken: 'copy-once-linked-token',
    });
    const formData = new FormData();
    formData.set('targetUserId', 'existing-user-1');
    formData.set('email', 'person@example.com');
    formData.set('fullName', 'Existing Person');
    formData.set('reason', 'Grant reviewed Admin access to an existing employee identity');

    await inviteAdminOperator(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/admin-operator-invitations',
      expect.objectContaining({
        email: 'person@example.com',
        targetUserId: 'existing-user-1',
      }),
    );
  });

  it('keeps an explicit empty permission selection empty and submits the version', async () => {
    mockedAdminPatchOrThrow.mockResolvedValue({ auditLog: { id: 'audit-2' } });
    const formData = new FormData();
    formData.set('userId', 'admin-2');
    formData.set('expectedVersion', '7');
    formData.set('reason', 'Remove access after queue ownership changed');

    const state = await updateAdminOperatorAccess(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith('/admin/users/admin-2/admin-operator-access', {
      expectedVersion: 7,
      permissionCategories: [],
      reason: 'Remove access after queue ownership changed',
      roles: ['ADMIN'],
    });
    expect(state).toMatchObject({ status: 'success', receipt: { auditId: 'audit-2' } });
  });

  it('does not submit a reason shorter than twelve characters', async () => {
    const formData = new FormData();
    formData.set('email', 'operator@hands.vn');
    formData.set('reason', 'too short');

    await expect(inviteAdminOperator(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData)).resolves.toMatchObject({
      status: 'error',
      fieldErrors: { reason: expect.any(String) },
    });
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('revokes only the selected Admin Web session with a required audit reason', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ auditLogId: 'audit-3' });
    const formData = new FormData();
    formData.set('userId', 'admin-2');
    formData.set('sessionId', 'session-2');
    formData.set('reason', 'Master revoked operator Admin Web session');
    formData.set('confirmation', 'confirmed');

    await revokeAdminOperatorSession(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/users/admin-2/admin-web-sessions/session-2/revoke',
      { reason: 'Master revoked operator Admin Web session' },
    );
  });

  it('initializes an explicit empty permission policy without changing roles', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({ auditLogId: 'audit-init-1' });
    const formData = new FormData();
    formData.set('userId', 'admin-legacy-1');
    formData.set('reason', 'Initialize explicit deny by default access policy');
    formData.set('confirmation', 'confirmed');

    await initializeAdminOperatorPermission(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/users/admin-legacy-1/admin-operator-access/initialize',
      { permissionCategories: [], reason: 'Initialize explicit deny by default access policy' },
    );
  });

  it('resends an invitation by invalidating the previous token and returning a copy-once setup path', async () => {
    mockedAdminPostOrThrow.mockResolvedValue({
      auditLogId: 'audit-resend-1',
      invitation: { expiresAt: '2026-08-18T12:00:00.000Z', id: 'invite-2' },
      setupToken: 'replacement-token',
    });
    const formData = new FormData();
    formData.set('invitationId', 'invite-1');
    formData.set('mode', 'resend');
    formData.set('expiresInHours', '72');
    formData.set('reason', 'Original setup link was not received securely');
    formData.set('confirmation', 'confirmed');

    const state = await manageAdminOperatorInvitation(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/admin-operator-invitations/invite-1/resend',
      { expiresInHours: 72, reason: 'Original setup link was not received securely' },
    );
    expect(state.receipt?.setupPath).toContain('replacement-token');
  });

  it('permanently removes only Admin Web access after exact-name confirmation', async () => {
    mockedAdminDeleteWithBodyOrThrow.mockResolvedValue({ auditLog: { id: 'audit-offboard-1' } });
    const formData = new FormData();
    formData.set('userId', 'admin-legacy-1');
    formData.set('operatorName', 'Legacy Operator');
    formData.set('confirmationName', 'Legacy Operator');
    formData.set('reason', 'Operator left the company after access handoff');
    formData.set('confirmation', 'confirmed');

    const state = await offboardAdminOperator(INITIAL_ADMIN_OPERATOR_ACTION_STATE, formData);

    expect(mockedAdminDeleteWithBodyOrThrow).toHaveBeenCalledWith(
      '/admin/users/admin-legacy-1/admin-operator',
      { reason: 'Operator left the company after access handoff' },
    );
    expect(state).toMatchObject({ status: 'success', receipt: { auditId: 'audit-offboard-1' } });
  });
});
