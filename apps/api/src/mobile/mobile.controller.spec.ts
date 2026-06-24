import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MobileController } from './mobile.controller';
import type { MobileService } from './mobile.service';

describe('MobileController', () => {
  const mobile = {
    getAppVersion: jest.fn(),
    registerDevice: jest.fn(),
    unregisterDevice: jest.fn(),
  };
  const controller = new MobileController(mobile as unknown as MobileService);
  const user = { id: 'user-1', roles: [Role.CUSTOMER] } as AuthenticatedUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes app-version as a public platform read endpoint', async () => {
    const query = { appType: 'CUSTOMER', platform: 'IOS' } as const;
    mobile.getAppVersion.mockResolvedValue({ forceUpdate: false });

    await expect(controller.getAppVersion(query)).resolves.toEqual({ forceUpdate: false });

    expect(routeMetadata('getAppVersion')).toEqual({
      method: RequestMethod.GET,
      path: 'app-version',
    });
    expect(rolesMetadata('getAppVersion')).toBeUndefined();
    expect(guardNames('getAppVersion')).toEqual([]);
    expect(mobile.getAppVersion).toHaveBeenCalledWith(query);
  });

  it('protects device registration for customer and Partner JWTs', async () => {
    const body = { token: 'fcm-token-ios', platform: 'IOS', pushProvider: 'FCM' } as const;
    mobile.registerDevice.mockResolvedValue({ id: 'device-1' });

    await expect(controller.registerDevice(user, body)).resolves.toEqual({ id: 'device-1' });

    expect(routeMetadata('registerDevice')).toEqual({
      method: RequestMethod.POST,
      path: 'devices/register',
    });
    expect(rolesMetadata('registerDevice')).toEqual([Role.CUSTOMER, Role.PROVIDER]);
    expect(guardNames('registerDevice')).toEqual([JwtAuthGuard.name, RolesGuard.name]);
    expect(mobile.registerDevice).toHaveBeenCalledWith(user, body);
  });

  it('protects device unregister for customer and Partner JWTs', async () => {
    const body = { token: 'fcm-token-ios' } as const;
    mobile.unregisterDevice.mockResolvedValue({ ok: true, disabled: 1 });

    await expect(controller.unregisterDevice(user, body)).resolves.toEqual({ ok: true, disabled: 1 });

    expect(routeMetadata('unregisterDevice')).toEqual({
      method: RequestMethod.DELETE,
      path: 'devices',
    });
    expect(rolesMetadata('unregisterDevice')).toEqual([Role.CUSTOMER, Role.PROVIDER]);
    expect(guardNames('unregisterDevice')).toEqual([JwtAuthGuard.name, RolesGuard.name]);
    expect(mobile.unregisterDevice).toHaveBeenCalledWith(user, body);
  });
});

function routeMetadata(methodName: keyof MobileController) {
  const handler = MobileController.prototype[methodName];

  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}

function rolesMetadata(methodName: keyof MobileController) {
  const handler = MobileController.prototype[methodName];

  return Reflect.getMetadata(ROLES_KEY, handler);
}

function guardNames(methodName: keyof MobileController) {
  const handler = MobileController.prototype[methodName];
  const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

  return guards.map((guard: { name?: string }) => guard.name);
}
