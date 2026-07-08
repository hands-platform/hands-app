import { readFileSync } from 'node:fs';

const globalCss = readFileSync('app/globals.css', 'utf8');

describe('BookingMonitor Vuexy shell', () => {
  it('wraps the whole monitor workspace with AdminPageTemplate content chrome', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');

    expect(source).toContain("import { AdminPageTemplate } from '../../components/admin-page-template';");
    expect(source).toContain('<AdminPageTemplate');
    expect(source).toContain('contentClassName="booking-monitor"');
    expect(source).toContain('title={pageTitle');
    expect(source).toContain('description={pageDescription');
  });

  it('keeps the toolbar component focused on the live-update action only', () => {
    const source = readFileSync('app/bookings/booking-monitor-toolbar-section.tsx', 'utf8');

    expect(source).not.toContain('AdminPageTemplate');
    expect(source).not.toContain('title=');
    expect(source).not.toContain('description=');
  });

  it('loads route-specific booking boards outside the primary monitor bundle', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');

    expect(source).toContain('const BookingMonitorBlockedCreateSection = dynamic<BookingMonitorBlockedCreateSectionProps>(');
    expect(source).toContain(
      "() => import('./booking-monitor-blocked-create-section').then((module) => module.BookingMonitorBlockedCreateSection)",
    );
    expect(source).toContain(
      "() => import('./booking-monitor-matching-escalation-section').then((module) => module.BookingMonitorMatchingEscalationSection)",
    );
    expect(source).toContain(
      "() => import('./booking-post-match-cancellations-section').then((module) => module.BookingPostMatchCancellationsSection)",
    );
    expect(source).toContain(
      "() => import('./booking-completed-closeout-section').then((module) => module.BookingCompletedCloseoutSection)",
    );
    expect(source.match(/ssr: false/g)).toHaveLength(4);
    expect(source).not.toContain("import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';");
    expect(source).not.toContain("import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';");
    expect(source).not.toContain("import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';");
    expect(source).not.toContain("import { BookingCompletedCloseoutSection } from './booking-completed-closeout-section';");
  });

  it('skips hidden route-specific board model builders on primary monitor renders', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');

    expect(source).toContain('showPostMatchCancellationBoard ? buildBookingPostMatchCancellationBoard');
    expect(source).toContain('showMatchingEscalation ? buildBookingMonitorMatchingEscalationBoard');
    expect(source).toContain('showMatchingEscalation ? buildBookingLiveMatchingPolicyCards');
    expect(source).toContain('showMatchingEscalation ? buildBookingMonitorMatchingEscalationRows');
    expect(source).toContain('showMatchingEscalation ? buildBookingMonitorMatchingFlowTimeline');
    expect(source).toContain('showMatchingEscalation ? buildBookingDispatchPartnerShortcuts');
  });

  it('scopes booking monitor header chrome to card-level section headers', () => {
    expect(globalCss).toContain(
      '.booking-monitor:is(.card, .admin-card, .admin-section) > .ops-section-header,',
    );
    expect(globalCss).toContain(
      '.booking-monitor :is(.card, .admin-card, .admin-section) > .ops-section-header {',
    );
    expect(globalCss).toContain(
      '.booking-monitor:is(.card, .admin-card, .admin-section) > .ops-section-header :is(h2, h3),',
    );
    expect(globalCss).toContain(
      '.booking-monitor :is(.card, .admin-card, .admin-section) > .ops-section-header :is(h2, h3) {',
    );
    expect(globalCss).not.toContain('.booking-monitor .ops-section-header {');
    expect(globalCss).not.toContain('.booking-monitor .ops-section-header h2,');
    expect(globalCss).not.toContain('.booking-monitor .ops-section-header h3 {');
  });
});
