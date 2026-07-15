import 'reflect-metadata';

import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminSystemController } from './admin-system.controller';

describe('AdminSystemController', () => {
  it('exposes read-only background job health behind the Admin guards', async () => {
    const backgroundJobs = {
      acknowledgeFailure: vi.fn().mockResolvedValue({ ok: true, status: 'ACKNOWLEDGED' }),
      health: vi.fn().mockResolvedValue({ failedJobs: [], ok: true, queues: [] }),
      recurringIncidentDetail: vi.fn().mockResolvedValue({ failures: [], incident: { id: 'incident-1' } }),
      resolveFailure: vi.fn().mockResolvedValue({ ok: true, status: 'RESOLVED' }),
    };
    const controller = new AdminSystemController(
      backgroundJobs as unknown as AdminBackgroundJobsService,
    );

    await expect(controller.backgroundJobHealth({})).resolves.toMatchObject({ ok: true });
    expect(backgroundJobs.health).toHaveBeenCalledWith({});
    expect(Reflect.getMetadata(PATH_METADATA, AdminSystemController)).toBe('admin/system');
    expect(Reflect.getMetadata(PATH_METADATA, controller.backgroundJobHealth)).toBe('background-jobs');
    expect(Reflect.getMetadata(METHOD_METADATA, controller.backgroundJobHealth)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminSystemController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminSystemController)).toEqual([Role.ADMIN]);

    await expect(controller.backgroundJobIncident('incident-1', { page: 1 })).resolves.toMatchObject({
      incident: { id: 'incident-1' },
    });
    expect(backgroundJobs.recurringIncidentDetail).toHaveBeenCalledWith('incident-1', { page: 1 });
    expect(Reflect.getMetadata(PATH_METADATA, controller.backgroundJobIncident)).toBe(
      'background-jobs/incidents/:incidentId',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, controller.backgroundJobIncident)).toBe(RequestMethod.GET);
  });

  it('exposes guarded acknowledge and resolve actions with operator identity forwarding', async () => {
    const backgroundJobs = {
      acknowledgeFailure: vi.fn().mockResolvedValue({ ok: true, status: 'ACKNOWLEDGED' }),
      health: vi.fn(),
      recurringIncidentDetail: vi.fn(),
      resolveFailure: vi.fn().mockResolvedValue({ ok: true, status: 'RESOLVED' }),
    };
    const controller = new AdminSystemController(
      backgroundJobs as unknown as AdminBackgroundJobsService,
    );
    const user = { id: 'internal-admin' } as AuthenticatedUser;

    await expect(controller.acknowledgeBackgroundJobFailure(
      user,
      'payment-status-check',
      'job-1',
      'master@hands.vn',
    )).resolves.toMatchObject({ status: 'ACKNOWLEDGED' });
    await expect(controller.resolveBackgroundJobFailure(
      user,
      'payment-status-check',
      'job-1',
      { reason: 'Credentials corrected' },
      'master@hands.vn',
    )).resolves.toMatchObject({ status: 'RESOLVED' });
    expect(backgroundJobs.acknowledgeFailure).toHaveBeenCalledWith(
      'internal-admin',
      'payment-status-check',
      'job-1',
      'master@hands.vn',
    );
    expect(backgroundJobs.resolveFailure).toHaveBeenCalledWith(
      'internal-admin',
      'payment-status-check',
      'job-1',
      'Credentials corrected',
      'master@hands.vn',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.acknowledgeBackgroundJobFailure)).toBe(
      'background-jobs/:queueName/:jobId/acknowledge',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, controller.acknowledgeBackgroundJobFailure)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.resolveBackgroundJobFailure)).toBe(
      'background-jobs/:queueName/:jobId/resolve',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, controller.resolveBackgroundJobFailure)).toBe(
      RequestMethod.POST,
    );
  });
});
