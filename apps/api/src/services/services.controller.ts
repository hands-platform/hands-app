import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateServiceDto } from './services.dto';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list() {
    return this.services.listActive();
  }

  @Get('groups')
  listGroups() {
    return this.services.listActiveGroups();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
  @Roles(Role.ADMIN)
  create(
    @Body() body: CreateServiceDto,
  ) {
    return this.services.create(body);
  }
}
