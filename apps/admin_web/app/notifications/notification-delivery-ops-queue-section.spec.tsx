import {
  NotificationDeliveryOpsQueueSection,
  type NotificationDeliveryOpsQueueItem,
} from './notification-delivery-ops-queue-section';
import {
  classNamesIn,
  hrefsIn,
  normalizedText,
  textContent,
} from './notification-section-test-utils';

describe('NotificationDeliveryOpsQueueSection', () => {
  it('renders delivery issue cards when blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Delivery operations queue');
    expect(rendered).toContain('1 issue(s)');
    expect(rendered).toContain('Failed sends');
    expect(rendered).toContain('Latest push attempt returned an error');
    expect(rendered).toContain('Open queue');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/notifications?review=failed']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'ops-task-card',
        'pill pill-warn',
        'admin-form-control-link pill pill-neutral',
      ]),
    );
  });

  it('renders a clean state when no delivery blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({ items: [] });

    const rendered = textContent(section);

    expect(rendered).toContain('No delivery blockers');
    expect(rendered).toContain('Delivery path is clean');
    expect(rendered).toContain('FCM credentials and mobile token registration');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['ops-task-card', 'pill pill-success']));
  });
});

function buildItems(): NotificationDeliveryOpsQueueItem[] {
  return [
    {
      count: 2,
      detail: 'Latest push attempt returned an error. Check failure reason, token freshness, and credentials.',
      href: '/notifications?review=failed',
      key: 'failed',
      label: 'Failed sends',
      tone: 'pill-warn',
    },
  ];
}
