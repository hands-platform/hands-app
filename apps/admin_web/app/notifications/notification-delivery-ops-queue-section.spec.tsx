import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
        'card admin-section soft-card admin-mb-16',
        'ops-section-header admin-section-header',
        'ops-task-card',
        'pill pill-warn',
        'pill pill-neutral',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('card soft-card admin-mb-16');
  });

  it('renders a clean state when no delivery blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({ items: [] });

    const rendered = textContent(section);

    expect(rendered).toContain('No delivery blockers');
    expect(rendered).toContain('Delivery path is clean');
    expect(rendered).toContain('FCM credentials and mobile token registration');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['ops-task-card', 'pill pill-success']));
  });

  it('uses shared badge atoms for delivery queue status and links', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-delivery-ops-queue-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('<div className="ops-task-card"');
    expect(source).not.toContain('<span className={`pill ${items.length ?');
    expect(source).not.toContain('<span className={`pill ${item.tone}`}>{item.label}</span>');
    expect(source).not.toContain('<AdminFormControlLink className="pill pill-neutral" href={item.href}>');
    expect(source).not.toContain('<span className="pill pill-success">Ready</span>');
    expect(source).not.toContain('<div className="ops-task-grid"');
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
      tone: 'warning',
    },
  ];
}
