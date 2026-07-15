import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
  BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
  BANK_STATEMENT_ESCALATION_INTERVAL_MS,
  BANK_STATEMENT_ESCALATION_JOB_NAME,
  BANK_STATEMENT_ESCALATION_QUEUE_NAME,
  BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
} from './bank-statement-escalation.queue';

@Injectable()
export class BankStatementEscalationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(BankStatementEscalationScheduler.name);

  constructor(
    @InjectQueue(BANK_STATEMENT_ESCALATION_QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  async onApplicationBootstrap() {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register Admin background schedulers: ${message}`);
    }
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
