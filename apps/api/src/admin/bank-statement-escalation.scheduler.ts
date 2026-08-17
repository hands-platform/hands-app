import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
  BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
  BANK_STATEMENT_ESCALATION_INTERVAL_MS,
  BANK_STATEMENT_ESCALATION_JOB_NAME,
  BANK_STATEMENT_ESCALATION_QUEUE_NAME,
  BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
} from './bank-statement-escalation.queue';

const SCHEDULER_REGISTRATION_RETRY_MS = 5_000;

@Injectable()
export class BankStatementEscalationScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BankStatementEscalationScheduler.name);
  private destroyed = false;
  private registrationRetry?: NodeJS.Timeout;

  constructor(
    @InjectQueue(BANK_STATEMENT_ESCALATION_QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
    await this.registerSchedulers();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.registrationRetry) {
      clearTimeout(this.registrationRetry);
      this.registrationRetry = undefined;
    }
  }

  private async registerSchedulers() {
    try {
      await Promise.all([
        this.upsertScheduler(
          BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
          BANK_STATEMENT_ESCALATION_JOB_NAME,
        ),
        this.upsertScheduler(
          BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
          BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
        ),
      ]);
      if (this.registrationRetry) {
        clearTimeout(this.registrationRetry);
        this.registrationRetry = undefined;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register Admin background schedulers: ${message}`);
      this.scheduleRegistrationRetry();
    }
  }

  private scheduleRegistrationRetry() {
    if (this.destroyed || this.registrationRetry) return;
    this.registrationRetry = setTimeout(() => {
      this.registrationRetry = undefined;
      void this.registerSchedulers();
    }, SCHEDULER_REGISTRATION_RETRY_MS);
  }

  private upsertScheduler(schedulerId: string, jobName: string) {
    return this.queue.upsertJobScheduler(
      schedulerId,
      { every: BANK_STATEMENT_ESCALATION_INTERVAL_MS },
      {
        name: jobName,
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 25 },
          removeOnFail: { count: 100 },
        },
      },
    );
  }
}
