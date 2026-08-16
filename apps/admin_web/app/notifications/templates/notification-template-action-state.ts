import type { AdminNotificationTemplate } from '../../../lib/admin-api';

export type NotificationTemplateActionState = {
  status: 'idle' | 'saved' | 'validation' | 'session-expired' | 'forbidden' | 'missing' | 'conflict' | 'source-unavailable' | 'server-error';
  templateKey?: string;
  message?: string;
  latest?: AdminNotificationTemplate;
  saved?: AdminNotificationTemplate;
};

export const INITIAL_NOTIFICATION_TEMPLATE_ACTION_STATE: NotificationTemplateActionState = {
  status: 'idle',
};
