import { renderToStaticMarkup } from 'react-dom/server';

import {
  auditNotificationRetryEvidence,
  AuditNotificationRetryEvidenceSection,
} from './audit-notification-retry-evidence';

describe('notification retry audit evidence', () => {
  it('normalizes queued retry evidence and masks device and job identifiers', () => {
    const evidence = auditNotificationRetryEvidence({
      latestDelivery: {
        attemptedAt: '2026-08-12T01:00:00.000Z',
        failureCode: 'INVALID_ARGUMENT',
        provider: 'FCM_HTTP_V1',
        pushDeviceEnabled: true,
        pushDeviceId: 'device-identifier-raw-123456',
        pushDeviceLastSeenAt: '2026-08-11T01:00:00.000Z',
        pushDevicePlatform: 'ANDROID',
        status: 'FAILED',
      },
      retryAlreadyDelivered: false,
      retryJob: {
        attempts: 3,
        backoffMs: 5_000,
        jobName: 'send-notification',
        queueName: 'notification-retry',
        queuedJobId: 'queued-job-identifier-123456',
      },
      retryRisk: 'FAILED_DELIVERY_RETRY',
    });

    expect(evidence).toMatchObject({
      latestDelivery: {
        failureCode: 'INVALID_ARGUMENT',
        provider: 'FCM_HTTP_V1',
        pushDeviceId: 'devi...3456',
        status: 'FAILED',
      },
      retryAlreadyDelivered: false,
      retryJob: { jobName: 'send-notification', queueName: 'notification-retry' },
      retryRisk: 'FAILED_DELIVERY_RETRY',
    });

    const markup = renderToStaticMarkup(<AuditNotificationRetryEvidenceSection evidence={evidence!} />);
    expect(markup).toContain('Notification retry evidence');
    expect(markup).toContain('FCM_HTTP_V1');
    expect(markup).toContain('INVALID_ARGUMENT');
    expect(markup).toContain('devi...3456');
    expect(markup).toContain('queu...3456');
    expect(markup).not.toContain('device-identifier-raw-123456');
    expect(markup).not.toContain('queued-job-identifier-123456');
  });

  it('does not present unrelated audit metadata as retry evidence', () => {
    expect(auditNotificationRetryEvidence({ status: 'COMPLETED' })).toBeNull();
    expect(auditNotificationRetryEvidence(null)).toBeNull();
  });
});
