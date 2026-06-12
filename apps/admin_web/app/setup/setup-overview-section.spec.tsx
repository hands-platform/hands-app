import { SetupOverviewSection } from './setup-overview-section';

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

function textContent(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return textContent(expanded);
  }
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

type RenderableComponent = (props: Record<string, unknown>) => unknown;

function renderKnownComponent(record: Record<string, unknown> | null) {
  const component = record?.type;
  if (typeof component === 'function' && component.name === 'MetricCard') {
    return (component as RenderableComponent)(readRecord(record?.props) ?? {});
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
