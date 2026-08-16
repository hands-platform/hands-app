import 'reflect-metadata';

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HealthController } from './health.controller';

describe('HealthController security', () => {
  it('keeps detailed external readiness restricted to admins', () => {
    const handler = HealthController.prototype.externalReadiness;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const roles = Reflect.getMetadata(ROLES_KEY, handler) ?? [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard]));
    expect(roles).toContain(Role.ADMIN);
  });

  it('keeps the load-balancer readiness route free of auth guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, HealthController.prototype.readiness)).toBeUndefined();
  });

  it('uses the typed external services overview without weakening the admin guard', async () => {
    const externalServicesOverview = vi.fn().mockResolvedValue({ services: [] });
    const controller = new HealthController({ externalServicesOverview } as never);

    await expect(controller.externalReadiness()).resolves.toEqual({ services: [] });
    expect(externalServicesOverview).toHaveBeenCalledTimes(1);
  });
});
