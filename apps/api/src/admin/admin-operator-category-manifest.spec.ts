import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PaymentsController } from '../payments/payments.controller';
import { ProviderOnboardingController } from '../provider-onboarding/provider-onboarding.controller';
import { ServicesController } from '../services/services.controller';
import { AdminController } from './admin.controller';
import {
  AdminOperatorCategoryGuard,
  adminOperatorCategoryForPath,
  isAllowlistedAdminRoute,
} from './admin-operator-category.guard';
import { AdminSystemController } from './admin-system.controller';

type RouteHandler = (...args: unknown[]) => unknown;
type ControllerConstructor = {
  prototype: object;
};

const CONTROLLERS = [
  AdminController,
  AdminSystemController,
  ProviderOnboardingController,
  PaymentsController,
  ServicesController,
] satisfies ControllerConstructor[];

describe('Admin route category manifest', () => {
  it('keeps every Admin route categorized or explicitly allowlisted', () => {
    const routes = listProtectedAdminRoutes();

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const categorized = Boolean(adminOperatorCategoryForPath(route.path));
      const allowlisted = isAllowlistedAdminRoute(route.method, route.path);

      expect.soft(
        categorized || allowlisted,
        `${route.method} ${route.path} must have an Admin operator permission category or documented allowlist`,
      ).toBe(true);
    }
  });

  it('keeps every categorized Admin route behind AdminOperatorCategoryGuard', () => {
    for (const route of listProtectedAdminRoutes()) {
      const guards = [
        ...(Reflect.getMetadata(GUARDS_METADATA, route.controller) ?? []),
        ...(Reflect.getMetadata(GUARDS_METADATA, route.handler) ?? []),
      ];

      expect.soft(
        guards,
        `${route.method} ${route.path} is missing AdminOperatorCategoryGuard`,
      ).toContain(AdminOperatorCategoryGuard);
    }
  });
});

function listProtectedAdminRoutes() {
  return CONTROLLERS.flatMap(listRoutes).filter(
    (route) => route.path.startsWith('/admin/') || (route.method === 'POST' && route.path === '/services'),
  );
}

function listRoutes(controller: ControllerConstructor) {
  const controllerPath = normalizePath(Reflect.getMetadata(PATH_METADATA, controller));
  const routes: Array<{
    controller: ControllerConstructor;
    handler: RouteHandler;
    method: string;
    path: string;
  }> = [];
  const methodNames = new Set<string>();
  let prototype: object | null = controller.prototype;

  while (prototype && prototype !== Object.prototype) {
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === 'constructor' || methodNames.has(methodName)) {
        continue;
      }
      methodNames.add(methodName);

      const handler = (prototype as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') {
        continue;
      }
      const routeHandler = handler as RouteHandler;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, routeHandler) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined) {
        continue;
      }

      for (const routePath of toRouteParts(Reflect.getMetadata(PATH_METADATA, routeHandler))) {
        routes.push({
          controller,
          handler: routeHandler,
          method: RequestMethod[requestMethod],
          path: joinRouteParts(controllerPath, routePath),
        });
      }
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  return routes;
}

function toRouteParts(value: unknown) {
  return Array.isArray(value) ? value.map(normalizePath) : [normalizePath(value)];
}

function normalizePath(value: unknown) {
  return String(value ?? '').replace(/^\/+|\/+$/gu, '');
}

function joinRouteParts(...parts: string[]) {
  return `/${parts.filter(Boolean).join('/')}`;
}
