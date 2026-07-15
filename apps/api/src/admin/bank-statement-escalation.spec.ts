import type { Job, Queue } from 'bullmq';
import type { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminService } from './admin.service';
import { BankStatementEscalationProcessor } from './bank-statement-escalation.processor';
import {
  BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
  BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
  BANK_STATEMENT_ESCALATION_INTERVAL_MS,
  BANK_STATEMENT_ESCALATION_JOB_NAME,
  BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
  type BankStatementEscalationJob,
} from './bank-statement-escalation.queue';
import { BankStatementEscalationScheduler } from './bank-statement-escalation.scheduler';

describe('Bank statement escalation queue', () => {
  it('registers stable five-minute escalation and failure-monitor schedulers', async () => {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
    };
    const scheduler = new BankStatementEscalationScheduler(queue as unknown as Queue);

    await scheduler.onApplicationBootstrap();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      BANK_STATEMENT_ESCALATION_SCHEDULER_ID,
      { every: BANK_STATEMENT_ESCALATION_INTERVAL_MS },
      expect.objectContaining({
        data: {},
        name: BANK_STATEMENT_ESCALATION_JOB_NAME,
        opts: expect.objectContaining({
          attempts: 3,
          removeOnComplete: { count: 25 },
          removeOnFail: { count: 100 },
        }),
      }),
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID,
      { every: BANK_STATEMENT_ESCALATION_INTERVAL_MS },
      expect.objectContaining({
        data: {},
        name: BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
        opts: expect.objectContaining({
          attempts: 3,
          removeOnComplete: { count: 25 },
          removeOnFail: { count: 100 },
        }),
      }),
    );
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(BANK_STATEMENT_ESCALATION_INTERVAL_MS).toBe(5 * 60_000);
  });

  it('runs the bounded Admin escalation sweep for the supported job', async () => {
    const admin = {
      syncCompanyBankTransactionImportBatchEscalations: vi.fn().mockResolvedValue({
        escalatedCount: 1,
        missingRecipientCount: 0,
        scannedCount: 1,
        skippedCount: 0,
      }),
      syncCompanyBankTransactionReviewEscalations: vi.fn().mockResolvedValue({
        escalatedCount: 1,
        missingRecipientCount: 0,
        scannedCount: 1,
        skippedCount: 0,
      }),
      syncPartnerBankDepositReconciliationEscalations: vi.fn().mockResolvedValue({
        escalatedCount: 1,
        missingRecipientCount: 0,
        scannedCount: 1,
        skippedCount: 0,
      }),
      syncCompanyBankTransactionReviewEscalationResolutions: vi.fn().mockResolvedValue({
        openCount: 0,
        resolvedCount: 1,
        scannedCount: 1,
        skippedCount: 0,
      }),
    };
    const backgroundJobs = {
      syncFailureNotifications: vi.fn(),
      syncQueueHealthAlerts: vi.fn(),
    };
    const processor = new BankStatementEscalationProcessor(
      admin as unknown as AdminService,
      backgroundJobs as unknown as AdminBackgroundJobsService,
    );

    await expect(processor.process({
      data: {},
      name: BANK_STATEMENT_ESCALATION_JOB_NAME,
    } as Job<BankStatementEscalationJob>)).resolves.toMatchObject({
      escalatedCount: 1,
      reviewEscalations: { escalatedCount: 1 },
      partnerDepositEscalations: { escalatedCount: 1 },
      reviewResolutions: { resolvedCount: 1 },
    });
    expect(admin.syncCompanyBankTransactionImportBatchEscalations).toHaveBeenCalledOnce();
    expect(admin.syncCompanyBankTransactionReviewEscalations).toHaveBeenCalledOnce();
    expect(admin.syncPartnerBankDepositReconciliationEscalations).toHaveBeenCalledOnce();
    expect(admin.syncCompanyBankTransactionReviewEscalationResolutions).toHaveBeenCalledOnce();
  });

  it('runs the background failure notification monitor for its scheduled job', async () => {
    const admin = {
      syncCompanyBankTransactionImportBatchEscalations: vi.fn(),
      syncCompanyBankTransactionReviewEscalations: vi.fn(),
      syncCompanyBankTransactionReviewEscalationResolutions: vi.fn(),
      syncPartnerBankDepositReconciliationEscalations: vi.fn(),
    };
    const backgroundJobs = {
      syncFailureNotifications: vi.fn().mockResolvedValue({ alertedCount: 1, scannedCount: 1 }),
      syncQueueHealthAlerts: vi.fn().mockResolvedValue({ alertedCount: 1, scannedCount: 4 }),
    };
    const processor = new BankStatementEscalationProcessor(
      admin as unknown as AdminService,
      backgroundJobs as unknown as AdminBackgroundJobsService,
    );

    await expect(processor.process({
      data: {},
      name: BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME,
    } as Job<BankStatementEscalationJob>)).resolves.toEqual({
      failures: { alertedCount: 1, scannedCount: 1 },
      queueHealth: { alertedCount: 1, scannedCount: 4 },
    });
    expect(backgroundJobs.syncFailureNotifications).toHaveBeenCalledOnce();
    expect(backgroundJobs.syncQueueHealthAlerts).toHaveBeenCalledOnce();
    expect(admin.syncCompanyBankTransactionImportBatchEscalations).not.toHaveBeenCalled();
    expect(admin.syncCompanyBankTransactionReviewEscalations).not.toHaveBeenCalled();
    expect(admin.syncCompanyBankTransactionReviewEscalationResolutions).not.toHaveBeenCalled();
    expect(admin.syncPartnerBankDepositReconciliationEscalations).not.toHaveBeenCalled();
  });

  it('does not run the sweep for an unexpected queue job', async () => {
    const admin = {
      syncCompanyBankTransactionImportBatchEscalations: vi.fn(),
      syncCompanyBankTransactionReviewEscalations: vi.fn(),
      syncCompanyBankTransactionReviewEscalationResolutions: vi.fn(),
      syncPartnerBankDepositReconciliationEscalations: vi.fn(),
    };
    const backgroundJobs = {
      syncFailureNotifications: vi.fn(),
      syncQueueHealthAlerts: vi.fn(),
    };
    const processor = new BankStatementEscalationProcessor(
      admin as unknown as AdminService,
      backgroundJobs as unknown as AdminBackgroundJobsService,
    );

    await expect(processor.process({
      data: {},
      name: 'unexpected-job',
    } as Job<BankStatementEscalationJob>)).resolves.toEqual({
      reason: 'UNSUPPORTED_JOB',
      skipped: true,
    });
    expect(admin.syncCompanyBankTransactionImportBatchEscalations).not.toHaveBeenCalled();
    expect(admin.syncCompanyBankTransactionReviewEscalations).not.toHaveBeenCalled();
    expect(admin.syncCompanyBankTransactionReviewEscalationResolutions).not.toHaveBeenCalled();
    expect(admin.syncPartnerBankDepositReconciliationEscalations).not.toHaveBeenCalled();
    expect(backgroundJobs.syncFailureNotifications).not.toHaveBeenCalled();
    expect(backgroundJobs.syncQueueHealthAlerts).not.toHaveBeenCalled();
  });
});
