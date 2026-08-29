import { vi } from 'vitest';

import { AdminApiRequestError, adminPostOrThrow } from '../../../lib/admin-api';
import { confirmPushCampaign, INITIAL_PUSH_CONFIRM_STATE } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminPostOrThrow: vi.fn() };
});

describe('confirmPushCampaign', () => {
  it('distinguishes recent reauthentication from missing Push Send permission', async () => {
    vi.mocked(adminPostOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/notifications/push-campaigns', 403, {
        code: 'RECENT_REAUTH_REQUIRED',
      }),
    );

    await expect(confirmPushCampaign(INITIAL_PUSH_CONFIRM_STATE, validConfirmation())).resolves.toEqual({
      status: 'error',
      error: 'Confirm your password and MFA below, then retry with this same preview and draft.',
      requiresReauthentication: true,
    });

    vi.mocked(adminPostOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/notifications/push-campaigns', 403, {
        code: 'ADMIN_OPERATOR_ACCESS_DENIED',
      }),
    );
    await expect(confirmPushCampaign(INITIAL_PUSH_CONFIRM_STATE, validConfirmation())).resolves.toEqual({
      status: 'error',
      error: 'You do not have Push Send permission.',
      requiresReauthentication: false,
    });

    vi.mocked(adminPostOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/notifications/push-campaigns', 403, {
        code: 'MFA_ENROLLMENT_REQUIRED',
      }),
    );
    await expect(confirmPushCampaign(INITIAL_PUSH_CONFIRM_STATE, validConfirmation())).resolves.toEqual({
      status: 'error',
      error: 'Complete Admin MFA enrollment before using Push Send. Draft preserved.',
      requiresReauthentication: false,
    });
  });

  it('keeps the same confirmation recoverable when its preview expires after reauthentication', async () => {
    vi.mocked(adminPostOrThrow)
      .mockRejectedValueOnce(new AdminApiRequestError('POST', '/admin/notifications/push-campaigns', 403, {
        code: 'RECENT_REAUTH_REQUIRED',
      }))
      .mockRejectedValueOnce(new AdminApiRequestError('POST', '/admin/notifications/push-campaigns', 409, {
        message: 'Push campaign preview has expired',
      }));
    const confirmation = validConfirmation();
    const reauthState = await confirmPushCampaign(INITIAL_PUSH_CONFIRM_STATE, confirmation);

    await expect(confirmPushCampaign(reauthState, confirmation)).resolves.toEqual({
      status: 'error',
      error: 'Preview expired. Create and review a new preview before queueing.',
      requiresReauthentication: false,
    });
  });
});

function validConfirmation() {
  const formData = new FormData();
  formData.set('confirmationPhrase', 'SEND 10');
  formData.set('idempotencyKey', 'push-request-1');
  formData.set('previewId', 'preview-1');
  formData.set('reason', 'Operational service notice');
  return formData;
}
