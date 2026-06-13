import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { enablePushDevice } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPost: jest.fn(),
}));

const mockedAdminPost = jest.mocked(adminPost);
const mockedRevalidatePath = jest.mocked(revalidatePath);

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
