import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { SetupOverviewSection } from './setup-overview-section';
import { textContent } from './setup-section-test-utils';

describe('SetupOverviewSection', () => {
  it('uses the shared StatusBadge atom for the readiness timestamp', () => {
    const source = readFileSync(new URL('./setup-overview-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">');
  });

  it('uses the shared DateTimeText atom for the readiness timestamp value', () => {
    const source = readFileSync(new URL('./setup-overview-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain("import { DateTimeText } from '../../components/date-time-text';");
    expect(source).toContain('Last checked <DateTimeText value={readinessTimestamp} />');
    expect(source).not.toContain('`Updated ${formatDate(readinessTimestamp)}`');
  });

  it('renders operational health fields and status without developer metrics', () => {
    const section = SetupOverviewSection({
      readinessUnavailable: false,
      readinessTimestamp: '2026-08-08T02:00:00.000Z',
      rows: [{
        affectedWork: 'Notification delivery may be unavailable.',
        id: 'push-health',
        lastCheckedAt: '2026-08-08T02:00:00.000Z',
        name: 'Push delivery',
        nextAction: 'Review notification delivery.',
        owner: 'Operations team',
        status: 'Limited',
        tone: 'warning',
      }],
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(rendered).toContain('System health');
    expect(rendered).toContain('Push delivery');
    expect(rendered).toContain('Limited');
    expect(rendered).toContain('Notification delivery may be unavailable.');
    expect(rendered).toContain('Operations team');
    expect(rendered).toContain('Review notification delivery.');
    expect(markup).not.toContain('Developer readiness');
  });

  it('renders the unavailable readiness state without formatting a timestamp', () => {
    const section = SetupOverviewSection({
      readinessUnavailable: true,
      readinessTimestamp: new Date(0).toISOString(),
      rows: [{
        affectedWork: 'External service health cannot be confirmed.',
        id: 'unavailable',
        lastCheckedAt: null,
        name: 'System health data',
        nextAction: 'Restore API connectivity.',
        owner: 'Owner unavailable',
        status: 'Unavailable',
        tone: 'danger',
      }],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Status unavailable');
    expect(rendered).toContain('Last checked unavailable');
    expect(rendered).toContain('Restore API connectivity.');
  });
});
