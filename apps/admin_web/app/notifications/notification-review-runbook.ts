export type NotificationReviewRunbook = {
  readonly detail: string;
  readonly primaryAction: string;
  readonly title: string;
};

const notificationReviewRunbooks: Readonly<Record<string, NotificationReviewRunbook>> = {
  'disabled-device': {
    detail:
      'A push device on this queue is disabled. Recovery should come from a fresh app token, not from blindly reusing the old token.',
    primaryAction:
      'Ask the customer or Partner to reopen the app, complete token recovery when needed, then re-enable only after the token path is current.',
    title: 'Device recovery gate',
  },
  failed: {
    detail:
      'The latest send attempt failed. Treat retry as a controlled resend after checking the failure code, token freshness, and Firebase credentials.',
    primaryAction:
      'Open the row delivery evidence and audit trail, fix the blocker, then use Retry only after the delivery path is valid.',
    title: 'Retry gate',
  },
  fcm: {
    detail:
      'These rows already attempted FCM delivery. Use this queue to confirm delivery route status, token freshness, and Firebase project alignment before broad push.',
    primaryAction:
      'Check the live preflight candidate, complete token recovery when app devices changed, then retry only after the notification and device path are valid.',
    title: 'FCM route gate',
  },
  'needs-retry': {
    detail:
      'This queue combines current failed sends and disabled device paths, so every row needs a recovery decision before resend.',
    primaryAction:
      'Resolve the device or credential signal first, then retry from the row action menu with the active queue context preserved.',
    title: 'Recovery decision gate',
  },
  pending: {
    detail:
      'These rows have no captured delivery attempt yet. Retrying before the worker path is confirmed can hide the original queue issue.',
    primaryAction:
      'Confirm API workers and delivery processing first; retry only if operations intentionally wants to create a new send attempt.',
    title: 'Worker path gate',
  },
  'stale-device': {
    detail:
      'The latest delivery used an old push token timestamp. A successful FCM response here does not prove the user has a fresh app token.',
    primaryAction:
      'Ask the user to reopen the app so the token refreshes, then prefer token recovery review before relying on another retry.',
    title: 'Token freshness gate',
  },
};

export function notificationReviewRunbook(review: string) {
  return notificationReviewRunbooks[review] ?? null;
}
