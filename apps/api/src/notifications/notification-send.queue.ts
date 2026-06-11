const NOTIFICATION_SEND_ATTEMPTS = 3;
const NOTIFICATION_SEND_BACKOFF_MS = 5_000;

export const NOTIFICATION_SEND_QUEUE_NAME = 'notification-retry';
export const NOTIFICATION_SEND_JOB_NAME = 'notification-send';

export type NotificationSendJob = {
  notificationId: string;
};

export function notificationSendJob(notificationId: string) {
  return {
    name: NOTIFICATION_SEND_JOB_NAME,
    data: { notificationId },
    options: {
      attempts: NOTIFICATION_SEND_ATTEMPTS,
      backoff: { type: 'exponential', delay: NOTIFICATION_SEND_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}
