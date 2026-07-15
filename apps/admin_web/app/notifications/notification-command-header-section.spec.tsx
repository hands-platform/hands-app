import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';

describe('NotificationCommandHeaderSection', () => {
  it('renders the notification delivery command summary and operating badges', () => {
    const section = NotificationCommandHeaderSection();
    const rendered = normalizedText(section);

    expect(rendered).toContain('Delivery board for push retries, disabled devices, and last-mile alert confidence.');
    expect(rendered).toContain('Current failures first');
    expect(rendered).toContain('Delivery signal');
    expect(rendered).toContain('Retry checks');
    expect(rendered).not.toContain('FCM setup');
    expect(hrefsIn(section)).not.toContain('/setup?commands=all#notifications');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'ops-section-header admin-section-header',
        'pill pill-success',
        'pill pill-info',
        'pill pill-warn',
      ]),
    );
  });

  it('shows FCM setup only to Developer/System diagnostics viewers', () => {
    const section = NotificationCommandHeaderSection({ canViewDiagnostics: true });
    const rendered = normalizedText(section);

    expect(rendered).toContain('FCM setup');
    expect(hrefsIn(section)).toContain('/setup?commands=all#notifications');
    expect(classNamesIn(section)).toContain('pill pill-neutral');
  });

  it('uses shared badge atoms for command header chips', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-command-header-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('<span className="pill pill-success">Current failures first</span>');
    expect(source).not.toContain('<span className="pill pill-info">Delivery signal</span>');
    expect(source).not.toContain('<span className="pill pill-warn">Retry checks</span>');
    expect(source).not.toContain('<Link className="pill pill-neutral" href="/setup#notifications">');
  });
});
