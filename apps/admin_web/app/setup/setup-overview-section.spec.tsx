import { SetupOverviewSection } from './setup-overview-section';
import { textContent } from './setup-section-test-utils';

describe('SetupOverviewSection', () => {
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

    expect(rendered).toContain('External setup');
    expect(rendered).toContain('Production deferred');
    expect(rendered).toContain('Current blockers');
    expect(rendered).toContain('Current setup gaps need attention.');
    expect(rendered).toContain('Missing values');
    expect(rendered).toContain('6');
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
