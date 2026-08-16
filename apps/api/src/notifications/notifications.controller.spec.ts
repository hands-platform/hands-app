import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

describe('NotificationsController provider chat routes', () => {
  const notifications = {
    listForUser: vi.fn(),
    markRead: vi.fn(),
    providerChatSummary: vi.fn(),
    markProviderChatRead: vi.fn(),
  };
  const controller = new NotificationsController(
    notifications as unknown as NotificationsService,
  );
  const user = {
    id: 'provider-user-1',
    roles: [Role.PROVIDER],
  } as AuthenticatedUser;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes a provider-only persisted unread summary', async () => {
    notifications.providerChatSummary.mockResolvedValue({
      unreadCount: 2,
      rooms: [{ chatRoomId: 'chat-room-1', unreadCount: 2 }],
    });

    await expect(controller.providerChatSummary(user)).resolves.toEqual({
      unreadCount: 2,
      rooms: [{ chatRoomId: 'chat-room-1', unreadCount: 2 }],
    });
    expect(routeMetadata('providerChatSummary')).toEqual({
      method: RequestMethod.GET,
      path: 'provider-chat/summary',
    });
    expect(rolesMetadata('providerChatSummary')).toEqual([Role.PROVIDER]);
    expect(controllerGuardNames()).toEqual([
      JwtAuthGuard.name,
      RolesGuard.name,
    ]);
    expect(notifications.providerChatSummary).toHaveBeenCalledWith(
      'provider-user-1',
    );
  });

  it('marks one provider chat room without using the broad notification route', async () => {
    notifications.markProviderChatRead.mockResolvedValue({
      updated: 1,
      unreadCount: 0,
      rooms: [],
    });

    await expect(
      controller.markProviderChatRead(user, { chatRoomId: 'chat-room-1' }),
    ).resolves.toEqual({
      updated: 1,
      unreadCount: 0,
      rooms: [],
    });
    expect(routeMetadata('markProviderChatRead')).toEqual({
      method: RequestMethod.PATCH,
      path: 'provider-chat/read',
    });
    expect(rolesMetadata('markProviderChatRead')).toEqual([Role.PROVIDER]);
    expect(notifications.markProviderChatRead).toHaveBeenCalledWith(
      'provider-user-1',
      'chat-room-1',
    );
  });

  it('passes the active role to broad notification list and read operations', async () => {
    notifications.listForUser.mockResolvedValue([]);
    notifications.markRead.mockResolvedValue({ id: 'notification-1' });

    await controller.list(user);
    await controller.markRead(user, 'notification-1');

    expect(notifications.listForUser).toHaveBeenCalledWith('provider-user-1', Role.PROVIDER);
    expect(notifications.markRead).toHaveBeenCalledWith(
      'provider-user-1',
      'notification-1',
      Role.PROVIDER,
    );
  });
});

function routeMetadata(methodName: keyof NotificationsController) {
  const handler = NotificationsController.prototype[methodName];

  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    path: Reflect.getMetadata(PATH_METADATA, handler),
  };
}

function rolesMetadata(methodName: keyof NotificationsController) {
  const handler = NotificationsController.prototype[methodName];
  return Reflect.getMetadata(ROLES_KEY, handler);
}

function controllerGuardNames() {
  const guards = Reflect.getMetadata(GUARDS_METADATA, NotificationsController) ?? [];
  return guards.map((guard: { name?: string }) => guard.name);
}
