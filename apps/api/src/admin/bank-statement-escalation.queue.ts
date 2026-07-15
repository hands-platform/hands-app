export const BANK_STATEMENT_ESCALATION_QUEUE_NAME = 'bank-statement-escalation';
export const BANK_STATEMENT_ESCALATION_JOB_NAME = 'bank-statement-escalation-sweep';
export const BANK_STATEMENT_ESCALATION_SCHEDULER_ID = 'bank-statement-escalation-every-5-minutes';
export const BANK_STATEMENT_ESCALATION_INTERVAL_MS = 5 * 60_000;
export const BACKGROUND_JOB_FAILURE_MONITOR_JOB_NAME = 'background-job-failure-monitor';
export const BACKGROUND_JOB_FAILURE_MONITOR_SCHEDULER_ID =
  'background-job-failure-monitor-every-5-minutes';

export type BankStatementEscalationJob = Record<string, never>;
