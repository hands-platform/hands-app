import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  NotificationDeliveryOpsQueueSection,
  type NotificationDeliveryOpsQueueItem,
} from './notification-delivery-ops-queue-section';
import { classNamesIn, hrefsIn, normalizedText, textContent } from './notification-section-test-utils';

describe('NotificationDeliveryOpsQueueSection', () => {
  it('renders delivery issue cards when blockers exist', () => {
    const section = NotificationDeliveryOpsQueueSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Needs action');
    expect(rendered).toContain('1 queue type');
    expect(rendered).toContain('Open incidents');
    expect(rendered).toContain('100 affected notifications');
    expect(rendered).toContain('Review delivery incidents');
    expect(rendered).not.toContain('Open queue');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/notifications?review=delivery-incidents']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section soft-card admin-mb-16',
        'ops-section-header admin-section-header',
        'ops-task-card',
        'pill pill-danger',
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
    expect(rendered).toContain('Delivery queue is clear');
    expect(rendered).toContain('No failed or unconfirmed mobile alerts');
    expect(rendered).not.toContain('FCM');
    expect(rendered).not.toContain('token');
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
      actionLabel: 'Review delivery incidents',
      count: 2,
      detail:
        '100 affected notifications grouped by provider and failure code. Contact affected users when urgent; Platform reviews the technical cause.',
      href: '/notifications?review=delivery-incidents',
      key: 'delivery-incidents',
      label: 'Open incidents',
      tone: 'danger',
    },
  ];
}
