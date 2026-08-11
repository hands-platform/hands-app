import { readFileSync } from 'node:fs';

const globalCss = readFileSync('app/globals.css', 'utf8');

describe('BookingMonitor Vuexy shell', () => {
  it('wraps the whole monitor workspace with AdminPageTemplate content chrome', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');

    expect(source).toContain("import { AdminPageTemplate } from '../../components/admin-page-template';");
    expect(source).toContain('<AdminPageTemplate');
    expect(source).toContain(
      "contentClassName={showCompletedCloseoutBoard ? 'booking-monitor booking-completed-monitor' : 'booking-monitor'}",
    );
    expect(source).toContain("title={isRecordsView ? 'Booking records' : (pageTitle ?? 'Live bookings')}");
    expect(source).toContain('description={');
    expect(source).toContain('pageDescription ??');
    expect(source).toContain("if (view === 'all' || view === 'usage-unresolved')");
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
    expect(source).toContain("import('./booking-monitor-blocked-create-section').then(");
    expect(source).toContain('module.BookingMonitorBlockedCreateSection');
    expect(source).toContain("import('./booking-monitor-matching-escalation-section').then(");
    expect(source).toContain('module.BookingMonitorMatchingEscalationBoard');
    expect(source).toContain("import('./booking-post-match-cancellations-section').then(");
    expect(source).toContain('module.BookingPostMatchCancellationBoard');
    expect(source).toContain("import('./booking-completed-closeout-section').then(");
    expect(source).toContain('module.BookingCompletedCloseoutSection');
    expect(source.match(/ssr: false/g)).toHaveLength(4);
    expect(source).not.toContain("import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';");
    expect(source).not.toContain("import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';");
    expect(source).not.toContain("import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';");
    expect(source).not.toContain("import { BookingCompletedCloseoutSection } from './booking-completed-closeout-section';");
  });

  it('moves hidden route-specific board model builders out of the primary monitor bundle', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');
    const matchingSource = readFileSync('app/bookings/booking-monitor-matching-escalation-section.tsx', 'utf8');
    const cancellationSource = readFileSync('app/bookings/booking-post-match-cancellations-section.tsx', 'utf8');

    expect(source).not.toContain('buildBookingPostMatchCancellationBoard');
    expect(source).not.toContain('buildBookingMonitorMatchingEscalationBoard');
    expect(source).not.toContain('buildBookingLiveMatchingPolicyCards');
    expect(source).not.toContain('buildBookingMonitorMatchingEscalationRows');
    expect(source).not.toContain('buildBookingMonitorMatchingFlowTimeline');
    expect(source).not.toContain('buildBookingDispatchPartnerShortcuts');
    expect(cancellationSource).not.toContain('buildBookingPostMatchCancellationBoard');
    expect(cancellationSource).toContain('AdminPostMatchCancellationOperationsSummary');
    expect(matchingSource).toContain('buildBookingMonitorMatchingEscalationBoard');
    expect(matchingSource).toContain('buildBookingLiveMatchingPolicyCards');
    expect(matchingSource).toContain('buildBookingMonitorMatchingEscalationRows');
    expect(matchingSource).toContain('buildBookingMonitorMatchingFlowTimeline');
    expect(matchingSource).toContain('buildBookingDispatchPartnerShortcuts');
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
