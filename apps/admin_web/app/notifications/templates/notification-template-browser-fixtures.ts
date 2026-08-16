export type NotificationTemplateBrowserFixture =
  | 'catalog-incomplete'
  | 'conflict'
  | 'load-error'
  | 'permission-denied'
  | 'save-failure'
  | 'save-success'
  | 'server-error'
  | 'session-expired'
  | 'slow-save'
  | 'source-unavailable';

const FIXTURES: readonly NotificationTemplateBrowserFixture[] = [
  'catalog-incomplete',
  'conflict',
  'load-error',
  'permission-denied',
  'save-failure',
  'save-success',
  'server-error',
  'session-expired',
  'slow-save',
  'source-unavailable',
];

export function notificationTemplateBrowserFixture(
  value: string | undefined,
): NotificationTemplateBrowserFixture | null {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NOTIFICATION_TEMPLATE_BROWSER_FIXTURES_ENABLED !== '1'
  ) {
    return null;
  }
  return FIXTURES.find((fixture) => fixture === value) ?? null;
}
