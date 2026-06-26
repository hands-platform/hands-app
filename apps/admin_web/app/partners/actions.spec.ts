import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { enablePushDevice } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPost: vi.fn(),
}));

const mockedAdminPost = vi.mocked(adminPost);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('partner server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
    mockedAdminPost.mockClear();
    mockedRevalidatePath.mockClear();
  });

  it('re-enables a push device through the shared admin endpoint', async () => {
    const formData = new FormData();
    formData.set('pushDeviceId', ' push-device-1 ');

    await enablePushDevice(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/push-devices/push-device-1/enable', {}, null);
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/partners',
      '/partner-controls',
      '/notifications',
      '/audit-log',
    ]);
  });

  it('requires a push device id before calling the admin API', async () => {
    await expect(enablePushDevice(new FormData())).rejects.toThrow('pushDeviceId is required');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
