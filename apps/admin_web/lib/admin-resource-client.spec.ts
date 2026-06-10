import { createAdminResourceClient } from './admin-resource-client';

describe('createAdminResourceClient', () => {
  it('keeps the endpoint and mock data together for admin page loaders', async () => {
    const mockData = [{ id: 'notification-1', title: 'Retry requested' }];
    const calls: Array<{ fallback: typeof mockData; path: string }> = [];
    const client = createAdminResourceClient({
      load: async (path, fallback) => {
        calls.push({ fallback, path });
        return fallback;
      },
      mockData,
      path: '/admin/notifications',
    });

    await expect(client.list()).resolves.toEqual(mockData);
    expect(calls).toEqual([{ fallback: mockData, path: '/admin/notifications' }]);
  });

  it('exposes mock data for screens that need local rendering before the API is ready', () => {
    const mockData = [{ id: 'coupon-1', code: 'WELCOME10' }];
    const client = createAdminResourceClient({
      load: async (_path, fallback) => fallback,
      mockData,
      path: '/admin/coupons',
    });

    expect(client.mockData).toBe(mockData);
    expect(client.path).toBe('/admin/coupons');
  });
});
