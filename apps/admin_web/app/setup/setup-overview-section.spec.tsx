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
    expect(source).toContain('Updated <DateTimeText value={readinessTimestamp} />');
    expect(source).not.toContain('`Updated ${formatDate(readinessTimestamp)}`');
  });

  it('uses the shared AdminSignal atom for readiness action chips', () => {
    const source = readFileSync(new URL('./setup-overview-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain('className={`signal');
  });

  it('renders setup readiness labels and summary metrics', () => {
    const section = SetupOverviewSection({
      readinessOk: false,
      readinessUnavailable: false,
      readinessTimestamp: new Date(0).toISOString(),
      currentStage: {
        ok: false,
        label: '2 blocker(s)',
        blockers: 2,
        helper: 'Current setup gaps need attention.',
      },
      summary: {
        ready: 3,
        partial: 4,
        blocked: 5,
        missing: 6,
      },
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('ops-section-header');
    expect(markup).not.toContain('class="toolbar"');
    expect(rendered).toContain('External setup');
    expect(rendered).toContain('Production deferred');
    expect(markup).toContain('Current blockers');
    expect(markup).toContain('Current setup gaps need attention.');
    expect(markup).toContain('Missing values');
    expect(markup).toContain('6');
  });

  it('renders the unavailable readiness state without formatting a timestamp', () => {
    const section = SetupOverviewSection({
      readinessOk: false,
      readinessUnavailable: true,
      readinessTimestamp: new Date(0).toISOString(),
      currentStage: {
        ok: true,
        label: 'Local check',
        blockers: 0,
        helper: 'Start local checks.',
      },
      summary: {
        ready: 0,
        partial: 0,
        blocked: 0,
        missing: 0,
      },
    });

    const rendered = textContent(section);

    expect(rendered).toContain('External status unknown');
    expect(rendered).toContain('Readiness not loaded');
  });
});
