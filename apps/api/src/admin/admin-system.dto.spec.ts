import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  BackgroundJobHealthQueryDto,
  BackgroundJobIncidentDetailQueryDto,
} from './admin-system.dto';

describe('BackgroundJobHealthQueryDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it('accepts supported filters and transforms bounded pagination values', async () => {
    await expect(pipe.transform({
      jobId: 'repeat:background-job-failure-monitor:1783980324023',
      page: '2',
      pageSize: '20',
      eventPage: '3',
      eventStatus: 'RECOVERED',
      incidentPage: '4',
      incidentStatus: 'OPEN',
      queue: 'notification-retry',
      range: '7D',
      review: 'OPEN',
    }, {
      metatype: BackgroundJobHealthQueryDto,
      type: 'query',
    })).resolves.toMatchObject({
      jobId: 'repeat:background-job-failure-monitor:1783980324023',
      page: 2,
      pageSize: 20,
      eventPage: 3,
      eventStatus: 'RECOVERED',
      incidentPage: 4,
      incidentStatus: 'OPEN',
      queue: 'notification-retry',
      range: '7D',
      review: 'OPEN',
    });
  });

  it('accepts the retained provider refund recovery queue filter', async () => {
    await expect(pipe.transform({ queue: 'payment-refund-status' }, {
      metatype: BackgroundJobHealthQueryDto,
      type: 'query',
    })).resolves.toMatchObject({ queue: 'payment-refund-status' });
  });

  it.each([
    { page: '0' },
    { page: '26' },
    { pageSize: '100' },
    { eventPage: '26' },
    { incidentPage: '26' },
    { incidentStatus: 'FAILED' },
    { eventStatus: 'STALE' },
    { jobId: '' },
    { jobId: 'x'.repeat(301) },
    { queue: 'unknown-queue' },
    { range: 'FOREVER' },
    { review: 'RETRIED' },
  ])('rejects unsupported or unbounded query input: %j', async (value) => {
    await expect(pipe.transform(value, {
      metatype: BackgroundJobHealthQueryDto,
      type: 'query',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BackgroundJobIncidentDetailQueryDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it('accepts bounded detail pagination', async () => {
    await expect(pipe.transform({ page: '2', pageSize: '20' }, {
      metatype: BackgroundJobIncidentDetailQueryDto,
      type: 'query',
    })).resolves.toMatchObject({ page: 2, pageSize: 20 });
  });

  it.each([{ page: '0' }, { page: '26' }, { pageSize: '100' }])(
    'rejects unbounded detail pagination: %j',
    async (value) => {
      await expect(pipe.transform(value, {
        metatype: BackgroundJobIncidentDetailQueryDto,
        type: 'query',
      })).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
