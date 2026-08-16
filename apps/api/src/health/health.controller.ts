import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  healthcheck() {
    return this.health.healthcheck();
  }

  @Get('health/ready')
  readiness() {
    return this.health.readiness();
  }

  @Get('health/external')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  externalReadiness() {
    return this.health.externalServicesOverview();
  }
}
