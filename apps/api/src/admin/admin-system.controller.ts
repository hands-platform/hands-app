import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminOperatorCategoryGuard } from './admin-operator-category.guard';
import {
  BackgroundJobHealthQueryDto,
  BackgroundJobIncidentDetailQueryDto,
  ResolveBackgroundJobFailureDto,
} from './admin-system.dto';

@Controller('admin/system')
@UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
@Roles(Role.ADMIN)
export class AdminSystemController {
  constructor(private readonly backgroundJobs: AdminBackgroundJobsService) {}

  @Get('background-jobs')
  backgroundJobHealth(@Query() query: BackgroundJobHealthQueryDto) {
    return this.backgroundJobs.health(query);
  }

  @Get('background-jobs/incidents/:incidentId')
  backgroundJobIncident(
    @Param('incidentId') incidentId: string,
    @Query() query: BackgroundJobIncidentDetailQueryDto,
  ) {
    return this.backgroundJobs.recurringIncidentDetail(incidentId, query);
  }

  @Post('background-jobs/:queueName/:jobId/acknowledge')
  acknowledgeBackgroundJobFailure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.backgroundJobs.acknowledgeFailure(
      user.id,
      queueName,
      jobId,
      operatorIdentity,
    );
  }

  @Post('background-jobs/:queueName/:jobId/resolve')
  resolveBackgroundJobFailure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body() body: ResolveBackgroundJobFailureDto,
    @Headers('x-hands-admin-operator-identity') operatorIdentity?: string,
  ) {
    return this.backgroundJobs.resolveFailure(
      user.id,
      queueName,
      jobId,
      body.reason,
      operatorIdentity,
    );
  }
}
