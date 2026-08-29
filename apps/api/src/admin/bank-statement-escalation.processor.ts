import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminService } from './admin.service';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
  BANK_STATEMENT_ESCALATION_JOB_NAME,
  BANK_STATEMENT_ESCALATION_QUEUE_NAME,
  PARTNER_WALLET_DEBT_SNAPSHOT_PURGE_JOB_NAME,
  type BankStatementEscalationJob,
} from './bank-statement-escalation.queue';

@Processor({ name: BANK_STATEMENT_ESCALATION_QUEUE_NAME, configKey: 'worker' })
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
      const [failures, missingJobs, queueHealth] = await Promise.all([
        this.backgroundJobs.syncFailureNotifications(),
        this.backgroundJobs.syncMissingDurableJobs(),
        this.backgroundJobs.syncQueueHealthAlerts(),
      ]);
      return { failures, missingJobs, queueHealth };
    }
    if (job.name === PARTNER_WALLET_DEBT_SNAPSHOT_PURGE_JOB_NAME) {
      const result = await this.admin.purgeExpiredPartnerWalletDebtSnapshots();
      if (result.hasMore) {
        throw new Error(
          `Expired Partner wallet debt snapshot backlog remains after purging ${result.purgedCount} records`,
        );
      }
      return result;
    }
    return { skipped: true, reason: 'UNSUPPORTED_JOB' };
  }
}
