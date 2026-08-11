import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminController } from './admin.controller';

const WRITE_METHODS = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

type RouteHandler = (...args: unknown[]) => unknown;
type AdminControllerConstructor = typeof AdminController;

describe('AdminController route guard manifest', () => {
  it('keeps every admin write route protected by JWT, RolesGuard, and Role.ADMIN', () => {
    const writeRoutes = listAdminWriteRoutes();

    expect(writeRoutes.length).toBeGreaterThan(0);

    for (const route of writeRoutes) {
      const guards = effectiveMetadata<unknown>(GUARDS_METADATA, route.handler, AdminController);
      const roles = effectiveMetadata<Role>(ROLES_KEY, route.handler, AdminController);

      expect.soft(guards, `${route.methodName} ${route.path} is missing JwtAuthGuard`).toContain(JwtAuthGuard);
      expect.soft(guards, `${route.methodName} ${route.path} is missing RolesGuard`).toContain(RolesGuard);
      expect.soft(roles, `${route.methodName} ${route.path} is missing Role.ADMIN`).toContain(Role.ADMIN);
    }
  });
});

function listAdminWriteRoutes() {
  const controllerPath = normalizePath(Reflect.getMetadata(PATH_METADATA, AdminController));
  const routes: Array<{ handler: RouteHandler; methodName: string; path: string }> = [];
  const methodNames = new Set<string>();
  let prototype: object | null = AdminController.prototype;

  while (prototype && prototype !== Object.prototype) {
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === 'constructor' || methodNames.has(methodName)) continue;
      methodNames.add(methodName);

      const handler = (prototype as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;
      const routeHandler = handler as RouteHandler;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, routeHandler) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined || !WRITE_METHODS.has(requestMethod)) continue;

      routes.push(
        ...toRouteParts(Reflect.getMetadata(PATH_METADATA, routeHandler)).map((routePath) => ({
          handler: routeHandler,
          methodName: RequestMethod[requestMethod],
          path: joinRouteParts(controllerPath, routePath),
        })),
      );
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  return routes;
}

function effectiveMetadata<T>(
  metadataKey: string,
  handler: RouteHandler,
  controller: AdminControllerConstructor,
) {
  return [
    ...(Reflect.getMetadata(metadataKey, controller) ?? []),
    ...(Reflect.getMetadata(metadataKey, handler) ?? []),
  ] as T[];
}

function toRouteParts(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normalizePath);
  }
  return [normalizePath(value)];
}

function normalizePath(value: unknown) {
  return String(value ?? '').replace(/^\/+|\/+$/g, '');
}

function joinRouteParts(...parts: string[]) {
  return `/${parts.filter(Boolean).join('/')}`;
}
