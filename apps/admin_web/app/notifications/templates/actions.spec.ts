import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPatchOrThrow } from '../../../lib/admin-api';
import { updateNotificationTemplate } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({ adminPatchOrThrow: vi.fn() }));

describe('notification template actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminPatchOrThrow).mockResolvedValue({ key: 'provider.joined' });
  });

  it('sends every language in one atomic template request', async () => {
    const formData = new FormData();
    formData.set('activeLocale', 'vi');
    formData.set('enabled', 'true');
    formData.set('key', 'provider.joined');
    formData.set(
      'translations',
      JSON.stringify([
        { body: '{partnerName} joined.', locale: 'en', title: 'Partner joined' },
        { body: '{partnerName} da tham gia.', locale: 'vi', title: 'Doi tac da tham gia' },
      ]),
    );

    await updateNotificationTemplate(formData);

    expect(adminPatchOrThrow).toHaveBeenCalledWith('/admin/notifications/templates/provider.joined', {
      enabled: true,
      translations: [
        { body: '{partnerName} joined.', locale: 'en', title: 'Partner joined' },
        { body: '{partnerName} da tham gia.', locale: 'vi', title: 'Doi tac da tham gia' },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/notifications/templates');
    expect(redirect).toHaveBeenCalledWith(
      '/notifications/templates?notice=saved&template=provider.joined&locale=vi',
    );
  });

  it('does not report success when the atomic request fails', async () => {
    vi.mocked(adminPatchOrThrow).mockRejectedValue(new Error('Placeholder validation failed'));
    const formData = new FormData();
    formData.set('activeLocale', 'en');
    formData.set('enabled', 'true');
    formData.set('key', 'provider.joined');
    formData.set(
      'translations',
      JSON.stringify([{ body: 'Partner joined.', locale: 'en', title: 'Partner joined' }]),
    );

    await updateNotificationTemplate(formData);

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/notifications/templates?notice=failed&template=provider.joined&locale=en',
    );
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('can change availability without rewriting language copy', async () => {
    const formData = new FormData();
    formData.set('activeLocale', 'en');
    formData.set('enabled', 'false');
    formData.set('key', 'provider.joined');
    formData.set('translations', '[]');

    await updateNotificationTemplate(formData);

    expect(adminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/notifications/templates/provider.joined',
      { enabled: false },
    );
  });
});
