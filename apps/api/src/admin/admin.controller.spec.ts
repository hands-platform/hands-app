import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController notification and push actions', () => {
  const admin = {
    enablePushDevice: jest.fn(),
    listFileReviewProviders: jest.fn(),
    getUsageOverview: jest.fn(),
    getVietnamOverview: jest.fn(),
    listOperationsHandoffProviders: jest.fn(),
    listOperationsPolicyProviders: jest.fn(),
    listPartnerControlProviders: jest.fn(),
    listPartnerDirectoryProviders: jest.fn(),
    retryNotification: jest.fn(),
  };
  const controller = new AdminController(admin as unknown as AdminService);
  const user = { id: 'admin-1' } as AuthenticatedUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes push device enablement as a POST action and delegates with actor id', async () => {
    admin.enablePushDevice.mockResolvedValue({ ok: true, pushDeviceId: 'push-device-1' });

    await expect(controller.enablePushDevice(user, 'push-device-1')).resolves.toEqual({
      ok: true,
      pushDeviceId: 'push-device-1',
    });

    expect(routeMetadata('enablePushDevice')).toEqual({
      method: RequestMethod.POST,
      path: 'push-devices/:id/enable',
    });
    expect(admin.enablePushDevice).toHaveBeenCalledWith('admin-1', 'push-device-1');
  });

  it('exposes notification retry as a POST action and delegates with actor id', async () => {
    admin.retryNotification.mockResolvedValue({ ok: true, notificationId: 'notification-1' });

    await expect(controller.retryNotification(user, 'notification-1')).resolves.toEqual({
      ok: true,
      notificationId: 'notification-1',
    });

    expect(routeMetadata('retryNotification')).toEqual({
      method: RequestMethod.POST,
      path: 'notifications/:id/retry',
    });
    expect(admin.retryNotification).toHaveBeenCalledWith('admin-1', 'notification-1');
  });

  it('exposes file review providers as a lightweight GET list', async () => {
    admin.listFileReviewProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.fileReviewProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('fileReviewProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'files/review-providers',
    });
    expect(admin.listFileReviewProviders).toHaveBeenCalledWith();
  });

  it('exposes operations policy providers as a lightweight GET list', async () => {
    admin.listOperationsPolicyProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsPolicyProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsPolicyProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-policy/providers',
    });
    expect(admin.listOperationsPolicyProviders).toHaveBeenCalledWith();
  });

  it('exposes Vietnam region overview as an aggregate GET list', async () => {
    admin.getVietnamOverview.mockResolvedValue({ regions: [] });

    await expect(controller.vietnamOverview()).resolves.toEqual({ regions: [] });

    expect(routeMetadata('vietnamOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'vietnam-overview',
    });
    expect(admin.getVietnamOverview).toHaveBeenCalledWith();
  });

  it('exposes usage overview as a bounded aggregate GET list', async () => {
    admin.getUsageOverview.mockResolvedValue({ range: 'month', customerUsage: [], partnerUsage: [] });

    await expect(controller.usageOverview('month')).resolves.toEqual({
      range: 'month',
      customerUsage: [],
      partnerUsage: [],
    });

    expect(routeMetadata('usageOverview')).toEqual({
      method: RequestMethod.GET,
      path: 'usage-overview',
    });
    expect(admin.getUsageOverview).toHaveBeenCalledWith('month');
  });

  it('exposes operations handoff providers as a lightweight GET list', async () => {
    admin.listOperationsHandoffProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.operationsHandoffProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('operationsHandoffProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'operations-handoff/providers',
    });
    expect(admin.listOperationsHandoffProviders).toHaveBeenCalledWith();
  });

  it('exposes partner control providers as a lightweight GET list', async () => {
    admin.listPartnerControlProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.partnerControlProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerControlProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partner-controls/providers',
    });
    expect(admin.listPartnerControlProviders).toHaveBeenCalledWith();
  });

  it('exposes partner directory providers as a lightweight GET list', async () => {
    admin.listPartnerDirectoryProviders.mockResolvedValue([{ id: 'partner-1' }]);

    await expect(controller.partnerDirectoryProviders()).resolves.toEqual([{ id: 'partner-1' }]);

    expect(routeMetadata('partnerDirectoryProviders')).toEqual({
      method: RequestMethod.GET,
      path: 'partners/list-providers',
    });
    expect(admin.listPartnerDirectoryProviders).toHaveBeenCalledWith();
  });
});

function routeMetadata(methodName: keyof AdminController) {
  const handler = AdminController.prototype[methodName] as unknown as Function;
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}
