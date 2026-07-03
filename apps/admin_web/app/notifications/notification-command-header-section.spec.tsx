import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';

describe('NotificationCommandHeaderSection', () => {
  it('renders the notification delivery command summary and operating badges', () => {
    const section = NotificationCommandHeaderSection();
    const rendered = normalizedText(section);

    expect(rendered).toContain('Delivery board for push retries, disabled devices, and last-mile alert confidence.');
    expect(rendered).toContain('Current failures first');
    expect(rendered).toContain('Delivery signal');
    expect(rendered).toContain('Retry readiness');
    expect(rendered).toContain('FCM setup');
    expect(hrefsIn(section)).toContain('/setup#notifications');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'ops-section-header',
        'pill pill-success',
        'pill pill-info',
        'pill pill-warn',
        'pill pill-neutral',
      ]),
    );
  });
});
