import { readFileSync } from 'node:fs';

describe('ServiceBookingReadinessQueueSection source', () => {
  it('uses the shared Vuexy status badge atom for readiness queue counters', () => {
    const source = readFileSync('app/services/service-booking-readiness-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain("className={blockedCount ? 'pill pill-danger' : 'pill pill-success'}");
    expect(source).not.toContain("className={warningCount ? 'pill pill-warn' : 'pill pill-success'}");
  });
});
