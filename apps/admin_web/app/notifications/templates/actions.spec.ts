import { revalidatePath, updateTag } from 'next/cache';
import { vi } from 'vitest';

import { AdminApiRequestError, adminPatchOrThrow } from '../../../lib/admin-api';
import {
  updateNotificationTemplate,
  updateNotificationTemplateBrowserFixture,
} from './actions';
import { INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE } from './notification-template-action-state';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminPatchOrThrow: vi.fn() };
});

function templateFormData() {
  const formData = new FormData();
  formData.set('enabled', 'true');
  formData.set('expectedUpdatedAt', '2026-08-12T10:00:00.000Z');
  formData.set('key', 'provider.joined');
  formData.set('reason', 'Reviewed Vietnamese customer wording');
  formData.set('translations', JSON.stringify([
    { body: '{partnerName} joined.', locale: 'en', reviewedAndReady: true, title: 'Partner joined' },
    { body: '{partnerName} da tham gia.', locale: 'vi', reviewedAndReady: true, title: 'Doi tac da tham gia' },
  ]));
  return formData;
}

describe('notification template actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminPatchOrThrow).mockResolvedValue({ key: 'provider.joined', translations: [] });
  });

  it('sends translations, readiness, reason, and revision in one atomic request', async () => {
    const result = await updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData());

    expect(adminPatchOrThrow).toHaveBeenCalledWith('/admin/notifications/templates/provider.joined', {
      enabled: true,
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      reason: 'Reviewed Vietnamese customer wording',
      translations: [
        { body: '{partnerName} joined.', confirmIdenticalTranslation: false, locale: 'en', reviewedAndReady: true, title: 'Partner joined' },
        { body: '{partnerName} da tham gia.', confirmIdenticalTranslation: false, locale: 'vi', reviewedAndReady: true, title: 'Doi tac da tham gia' },
      ],
    });
    expect(result).toMatchObject({ status: 'saved', templateKey: 'provider.joined' });
    expect(updateTag).toHaveBeenCalledWith('notification-template-catalog');
    expect(revalidatePath).toHaveBeenCalledWith('/notifications/templates');
  });

  it('returns the latest server copy on a revision conflict without redirecting', async () => {
    const latest = { key: 'provider.joined', translations: [] };
    vi.mocked(adminPatchOrThrow).mockRejectedValue(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 409, {
        current: latest,
        message: 'Notification template changed.',
      }),
    );

    await expect(
      updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData()),
    ).resolves.toEqual({ latest, message: 'Notification template changed.', status: 'conflict', templateKey: 'provider.joined' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('distinguishes validation and permission errors while preserving the client draft', async () => {
    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 400, {
        message: 'Unknown notification placeholder',
      }),
    );
    await expect(updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData())).resolves.toEqual({
      message: 'Unknown notification placeholder',
      status: 'validation',
      templateKey: 'provider.joined',
    });

    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 403),
    );
    await expect(updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData())).resolves.toEqual({
      message: 'You do not have permission to update notification copy.',
      status: 'forbidden',
      templateKey: 'provider.joined',
    });
  });

  it('distinguishes expired sessions, missing templates, and unavailable sources', async () => {
    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 401),
    );
    await expect(updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData())).resolves.toMatchObject({ status: 'session-expired' });

    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 404),
    );
    await expect(updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData())).resolves.toMatchObject({ status: 'missing' });

    vi.mocked(adminPatchOrThrow).mockRejectedValueOnce(
      new AdminApiRequestError('PATCH', '/admin/notifications/templates/provider.joined', 503),
    );
    await expect(updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, templateFormData())).resolves.toMatchObject({ status: 'source-unavailable' });
  });

  it('omits the translation field when only managed-copy availability changes', async () => {
    const formData = templateFormData();
    formData.set('translations', '[]');

    await updateNotificationTemplate(INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE, formData);

    expect(adminPatchOrThrow).toHaveBeenCalledWith('/admin/notifications/templates/provider.joined', {
      enabled: true,
      expectedUpdatedAt: '2026-08-12T10:00:00.000Z',
      reason: 'Reviewed Vietnamese customer wording',
    });
  });

  it('keeps browser save fixtures isolated from the Admin API', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NOTIFICATION_TEMPLATE_BROWSER_FIXTURES_ENABLED', '1');
    const formData = templateFormData();
    formData.set('fixtureTemplate', JSON.stringify({
      audience: 'CUSTOMER',
      channel: 'BOTH',
      enabled: true,
      key: 'provider.joined',
      translations: [
        { body: '{partnerName} joined.', locale: 'en', status: 'READY', title: 'Partner joined' },
        { body: '{partnerName} joined.', locale: 'vi', status: 'SOURCE_COPIED', title: 'Partner joined' },
      ],
      updatedAt: '2026-08-12T10:00:00.000Z',
    }));

    try {
      await expect(updateNotificationTemplateBrowserFixture(
        'save-success',
        INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE,
        formData,
      )).resolves.toMatchObject({
        message: 'Browser fixture saved. No operating data changed.',
        status: 'saved',
        templateKey: 'provider.joined',
      });
      expect(adminPatchOrThrow).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('blocks browser save fixtures when the server gate is disabled', async () => {
    vi.stubEnv('NOTIFICATION_TEMPLATE_BROWSER_FIXTURES_ENABLED', '');
    try {
      await expect(updateNotificationTemplateBrowserFixture(
        'save-success',
        INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE,
        templateFormData(),
      )).resolves.toEqual({
        message: 'Browser save fixtures are disabled.',
        status: 'server-error',
        templateKey: 'provider.joined',
      });
      expect(adminPatchOrThrow).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
