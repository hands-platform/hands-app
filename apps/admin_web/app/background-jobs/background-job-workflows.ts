import type { AdminBackgroundJobReference } from '../../lib/admin-api';

export type BackgroundJobWorkflow = {
  readonly actionLabel: 'Open record' | 'Open workflow';
  readonly href: string;
  readonly label: string;
};

const backgroundJobWorkflows: Record<string, BackgroundJobWorkflow> = {
  'bank-statement-escalation': {
    actionLabel: 'Open workflow',
    href: '/finance-tax/bank-reconciliation?range=today&review=unmatched&importRange=all&importReview=escalated',
    label: 'Escalated bank imports',
  },
  'booking-timeouts': {
    actionLabel: 'Open workflow',
    href: '/bookings?view=attention&dateRange=today',
    label: 'Booking follow-up',
  },
  'notification-retry': {
    actionLabel: 'Open workflow',
    href: '/notifications?range=today&review=needs-retry',
    label: 'Notification retry',
  },
  'payment-status-check': {
    actionLabel: 'Open workflow',
    href: '/payments?range=today&review=needs-action',
    label: 'Payment needs action',
  },
  'payment-refund-status': {
    actionLabel: 'Open workflow',
    href: '/refunds?range=all',
    label: 'Payment provider refund recovery',
  },
};

export function backgroundJobWorkflow(
  queueName: string,
  reference?: AdminBackgroundJobReference | null,
): BackgroundJobWorkflow | null {
  const recordWorkflow = backgroundJobRecordWorkflow(queueName, reference);
  if (recordWorkflow) return recordWorkflow;
  return backgroundJobWorkflows[queueName] ?? null;
}

function backgroundJobRecordWorkflow(
  queueName: string,
  reference?: AdminBackgroundJobReference | null,
): BackgroundJobWorkflow | null {
  if (!reference) return null;
  const id = encodeURIComponent(reference.id);
  if (queueName === 'booking-timeouts' && reference.kind === 'BOOKING') {
    return { actionLabel: 'Open record', href: `/bookings/${id}`, label: 'Booking record' };
  }
  if (queueName === 'payment-status-check' && reference.kind === 'PAYMENT') {
    return { actionLabel: 'Open record', href: `/payments/${id}`, label: 'Payment record' };
  }
  if (queueName === 'payment-refund-status' && reference.kind === 'REFUND') {
    return {
      actionLabel: 'Open workflow',
      href: '/refunds?range=all&review=open',
      label: 'Refund recovery record',
    };
  }
  if (queueName === 'notification-retry' && reference.kind === 'NOTIFICATION') {
    return {
      actionLabel: 'Open record',
      href: `/audit-log?bucket=Notification&q=${id}&range=all`,
      label: 'Notification evidence',
    };
  }
  return null;
}
