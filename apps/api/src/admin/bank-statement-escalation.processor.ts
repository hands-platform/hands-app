import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminService } from './admin.service';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
  BANK_STATEMENT_ESCALATION_JOB_NAME,
  BANK_STATEMENT_ESCALATION_QUEUE_NAME,
  type BankStatementEscalationJob,
} from './bank-statement-escalation.queue';

@Processor(BANK_STATEMENT_ESCALATION_QUEUE_NAME)
export class BankStatementEscalationProcessor extends WorkerHost {
  constructor(
    private readonly admin: AdminService,
    private readonly backgroundJobs: AdminBackgroundJobsService,
  ) {
    super();
  }

  async process(job: Job<BankStatementEscalationJob>) {
    if (job.name === BANK_STATEMENT_ESCALATION_JOB_NAME) {
      const [batches, reviews, partnerDeposits, resolutions] = await Promise.all([
        this.admin.syncCompanyBankTransactionImportBatchEscalations(),
        this.admin.syncCompanyBankTransactionReviewEscalations(),
        this.admin.syncPartnerBankDepositReconciliationEscalations(),
        this.admin.syncCompanyBankTransactionReviewEscalationResolutions(),
      ]);
      return {
        ...batches,
        partnerDepositEscalations: partnerDeposits,
        reviewEscalations: reviews,
        reviewResolutions: resolutions,
      };
    }
    if (job.name === BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME) {
      const [failures, queueHealth] = await Promise.all([
        this.backgroundJobs.syncFailureNotifications(),
        this.backgroundJobs.syncQueueHealthAlerts(),
      ]);
      return { failures, queueHealth };
    }
    return { skipped: true, reason: 'UNSUPPORTED_JOB' };
  }
}
