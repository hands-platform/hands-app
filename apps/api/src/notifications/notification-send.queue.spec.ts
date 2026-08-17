import {
  NOTIFICATION_SEND_JOB_NAME,
  NOTIFICATION_SEND_QUEUE_NAME,
  notificationSendJob,
} from './notification-send.queue';

describe('notification send queue descriptor', () => {
  it('keeps notification retry queue names and retry policy centralized', () => {
    expect(NOTIFICATION_SEND_QUEUE_NAME).toBe('notification-retry');
    expect(notificationSendJob('notification-1')).toEqual({
      name: NOTIFICATION_SEND_JOB_NAME,
      data: { notificationId: 'notification-1' },
      options: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        deduplication: {
          id: 'notification-1',
          keepLastIfActive: true,
        },
        removeOnComplete: true,
        removeOnFail: { count: 500 },
      },
    });
  });
});
