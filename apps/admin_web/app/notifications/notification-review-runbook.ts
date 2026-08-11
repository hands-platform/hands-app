export type NotificationReviewRunbook = {
  readonly detail: string;
  readonly primaryAction: string;
  readonly title: string;
};

const notificationReviewRunbooks: Readonly<Record<string, NotificationReviewRunbook>> = {
  'delivery-incidents': {
    detail:
      'Repeated failures are grouped by provider, failure code, and the configured delivery SLA window. Only incidents from the last 24 hours affect the current queue.',
    primaryAction:
      'Support contacts affected users when the alert is urgent. Platform reviews the grouped technical cause before any controlled retry.',
    title: 'Current delivery incidents',
  },
  'delivery-incident-history': {
    detail:
      'These failures are older than 24 hours and retained for cleanup and audit. They do not contribute to current delivery SLA counts.',
    primaryAction:
      'Review recurring causes and stale device records during cleanup; do not treat these rows as current customer incidents.',
    title: 'Historical cleanup',
  },
  'finance-overdue': {
    detail:
      'These Finance records remained unresolved for more than 48 hours after import or operator assignment. Notification retry does not resolve the accounting evidence gap.',
    primaryAction:
      'Open the linked bank reconciliation record, resolve or reassign its review, then confirm the retained escalation audit trail.',
    title: 'Finance review SLA',
  },
  'finance-overdue-history': {
    detail:
      'These Finance SLA alerts were resolved after their linked bank records left the open reconciliation queue.',
    primaryAction:
      'Use the linked Finance record and audit trail to verify when the overdue review was resolved; no delivery retry is required.',
    title: 'Finance SLA history',
  },
  'system-incidents': {
    detail:
      'These alerts come from Admin system monitors. Review the linked incident before retrying notification delivery, because resend does not resolve the source failure.',
    primaryAction:
      'Open the incident, confirm whether the source job is still failing, then use its recovery evidence and audit trail to close the operational issue.',
    title: 'System incident gate',
  },
  'disabled-device': {
    detail:
      'These users cannot currently receive a mobile alert through the app.',
    primaryAction:
      'Contact the customer or Partner directly if the alert is urgent. Ask them to reopen the app before retrying.',
    title: 'Push unavailable',
  },
  failed: {
    detail:
      'The latest mobile alert was not delivered.',
    primaryAction:
      'Contact the user directly if the alert is urgent. Review the latest attempt, then retry only when the alert is still needed.',
    title: 'Failed delivery review',
  },
  fcm: {
    detail:
      'These records attempted delivery through mobile push.',
    primaryAction:
      'Use the delivery result and audit trail to decide whether the alert needs a controlled retry.',
    title: 'Mobile push records',
  },
  'needs-retry': {
    detail:
      'This queue contains notifications with at least one device whose latest delivery attempt is still failed.',
    primaryAction:
      'Resolve the failure signal first, then retry only unresolved deliveries from the row action menu.',
    title: 'Recovery decision gate',
  },
  'delivery-gap': {
    detail:
      'These alerts still have no delivery confirmation after 15 minutes.',
    primaryAction:
      'Contact the user directly if urgent. Confirm the alert is still needed before retrying.',
    title: 'Delivery not confirmed',
  },
  'no-push-path': {
    detail:
      'These users cannot currently receive a mobile alert through the app.',
    primaryAction:
      'Keep the in-app record, contact the user directly if urgent, and ask them to reopen the app before retrying.',
    title: 'Push unavailable',
  },
  pending: {
    detail: 'Legacy alias for all notification rows without delivery evidence.',
    primaryAction: 'Use Delivery not confirmed for current issues and Push unavailable for app-access records.',
    title: 'Unattempted history',
  },
  unattempted: {
    detail:
      'This is the complete historical set of inbox rows without delivery evidence.',
    primaryAction:
      'Use Delivery not confirmed for current issues; use Push unavailable when the user needs to reopen the app.',
    title: 'Unattempted history',
  },
  'stale-device': {
    detail:
      'These are historical delivery records linked to an enabled device that had not checked in for 30+ days. The record total is not the number of affected users or current devices.',
    primaryAction:
      'Ask the user to reopen the app, then review the latest delivery before relying on another retry.',
    title: 'App reopen needed',
  },
};

export function notificationReviewRunbook(review: string) {
  return notificationReviewRunbooks[review] ?? null;
}
