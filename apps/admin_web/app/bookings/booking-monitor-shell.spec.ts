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
