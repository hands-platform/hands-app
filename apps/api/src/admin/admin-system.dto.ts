import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const BACKGROUND_JOB_QUEUES = [
  'ALL',
  'admin-push-campaign',
  'bank-statement-escalation',
  'booking-timeouts',
  'notification-retry',
  'payment-booking-recovery',
  'payment-refund-status',
  'payment-status-check',
] as const;
const BACKGROUND_JOB_REVIEW_FILTERS = [
  'ALL',
  'OPEN',
  'NEW',
  'ACKNOWLEDGED',
  'RESOLVED',
  'UNTRACKED',
] as const;
const BACKGROUND_JOB_RANGES = ['24H', '7D', '30D', 'ALL'] as const;
const BACKGROUND_JOB_HEALTH_EVENT_FILTERS = ['ALL', 'ALERTED', 'RECOVERED'] as const;
const BACKGROUND_JOB_INCIDENT_FILTERS = ['ALL', 'OPEN', 'RECOVERED'] as const;

export class BackgroundJobHealthQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  jobId?: string;

  @IsOptional()
  @IsIn(BACKGROUND_JOB_QUEUES)
  queue?: typeof BACKGROUND_JOB_QUEUES[number];

  @IsOptional()
  @IsIn(BACKGROUND_JOB_REVIEW_FILTERS)
  review?: typeof BACKGROUND_JOB_REVIEW_FILTERS[number];

  @IsOptional()
  @IsIn(BACKGROUND_JOB_RANGES)
  range?: typeof BACKGROUND_JOB_RANGES[number];

  @IsOptional()
  @IsIn(BACKGROUND_JOB_HEALTH_EVENT_FILTERS)
  eventStatus?: typeof BACKGROUND_JOB_HEALTH_EVENT_FILTERS[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  eventPage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  incidentPage?: number;

  @IsOptional()
  @IsIn(BACKGROUND_JOB_INCIDENT_FILTERS)
  incidentStatus?: typeof BACKGROUND_JOB_INCIDENT_FILTERS[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(20)
  pageSize?: number;
}

export class BackgroundJobIncidentDetailQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(20)
  pageSize?: number;
}

export class ResolveBackgroundJobFailureDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
