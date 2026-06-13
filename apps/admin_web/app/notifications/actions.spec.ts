import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { enablePushDevice, retryNotification } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPost: jest.fn(),
}));

const mockedAdminPost = jest.mocked(adminPost);
const mockedRevalidatePath = jest.mocked(revalidatePath);

describe('notification server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
  });

  it('retries a notification and refreshes notification-dependent admin views', async () => {
    const formData = new FormData();
    formData.set('notificationId', 'notification-1');

    await retryNotification(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/notifications/notification-1/retry',
      {},
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/notifications',
      '/partner-controls',
      '/partners',
      '/audit-log',
    ]);
  });

  it('re-enables a push device and refreshes push health views', async () => {
    const formData = new FormData();
    formData.set('pushDeviceId', 'push-device-1');

    await enablePushDevice(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/push-devices/push-device-1/enable', {}, null);
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/notifications',
      '/partners',
      '/partner-controls',
      '/audit-log',
    ]);
  });

  it('requires form identifiers before calling admin APIs', async () => {
    await expect(retryNotification(new FormData())).rejects.toThrow('notificationId is required');
    await expect(enablePushDevice(new FormData())).rejects.toThrow('pushDeviceId is required');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('trims form identifiers before posting admin actions', async () => {
    const retryFormData = new FormData();
    retryFormData.set('notificationId', ' notification-1 ');
    const enableFormData = new FormData();
    enableFormData.set('pushDeviceId', ' push-device-1 ');

    await retryNotification(retryFormData);
    await enablePushDevice(enableFormData);

    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      1,
      '/admin/notifications/notification-1/retry',
      {},
      null,
    );
    expect(mockedAdminPost).toHaveBeenNthCalledWith(
      2,
      '/admin/push-devices/push-device-1/enable',
      {},
      null,
    );
  });
});
