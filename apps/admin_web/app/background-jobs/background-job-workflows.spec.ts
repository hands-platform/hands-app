import { backgroundJobWorkflow } from './background-job-workflows';

describe('background job workflow destinations', () => {
  it.each([
    ['admin-push-campaign', '/notifications?view=campaigns'],
    [
      'bank-statement-escalation',
      '/finance-tax/bank-reconciliation?range=today&review=unmatched&importRange=all&importReview=escalated',
    ],
    ['booking-timeouts', '/bookings?view=attention&dateRange=today'],
    ['notification-retry', '/notifications?range=today&review=needs-retry'],
    ['payment-booking-recovery', '/bookings?view=attention&dateRange=today'],
    ['payment-refund-status', '/refunds?range=all'],
    ['payment-status-check', '/payments?range=today&review=needs-action'],
  ])('maps %s to its owning operational workflow', (queueName, href) => {
    expect(backgroundJobWorkflow(queueName)).toMatchObject({ href });
  });

  it('does not guess a destination for an unknown queue', () => {
    expect(backgroundJobWorkflow('unknown-queue')).toBeNull();
  });

  it.each([
    ['booking-timeouts', { id: 'booking-123', kind: 'BOOKING' as const }, '/bookings/booking-123'],
    ['payment-status-check', { id: 'payment-123', kind: 'PAYMENT' as const }, '/payments/payment-123'],
    [
      'notification-retry',
      { id: 'notification 123', kind: 'NOTIFICATION' as const },
      '/audit-log?bucket=Notification&q=notification%20123&range=all',
    ],
  ])('opens the exact retained record for %s', (queueName, reference, href) => {
    expect(backgroundJobWorkflow(queueName, reference)).toMatchObject({
      actionLabel: 'Open record',
      href,
    });
  });

  it('ignores a mismatched reference kind and keeps the safe queue-level workflow', () => {
    expect(backgroundJobWorkflow(
      'payment-status-check',
      { id: 'booking-123', kind: 'BOOKING' },
    )).toMatchObject({
      actionLabel: 'Open workflow',
      href: '/payments?range=today&review=needs-action',
    });
  });

  it('opens the refund review workflow without pretending the list supports direct refund lookup', () => {
    expect(backgroundJobWorkflow(
      'payment-refund-status',
      { id: 'refund-123', kind: 'REFUND' },
    )).toMatchObject({
      actionLabel: 'Open workflow',
      href: '/refunds?range=all&review=open',
    });
  });
});
