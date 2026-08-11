import { Controller, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminCatalogRoutes } from './admin-catalog.routes';
import { AdminOperatorCategoryGuard } from './admin-operator-category.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
@Roles(Role.ADMIN)
export class AdminController extends AdminCatalogRoutes {
  constructor(admin: AdminService) {
    super(admin);
  }
}
