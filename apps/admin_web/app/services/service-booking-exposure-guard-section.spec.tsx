import { readFileSync } from 'node:fs';

describe('ServiceBookingExposureGuardSection source', () => {
  it('uses the shared Vuexy status badge atom for exposure guard counters', () => {
    const source = readFileSync('app/services/service-booking-exposure-guard-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary">');
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('<a className="button button-secondary"');
    expect(source).not.toContain("className={blockedCount ? 'pill pill-danger' : 'pill pill-success'}");
    expect(source).not.toContain("className={warningCount ? 'pill pill-warn' : 'pill pill-success'}");
  });
});
