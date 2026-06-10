import {
  PartnerShiftHandoffSection,
  type PartnerShiftHandoffSectionModel,
} from './partner-shift-handoff-section';

describe('PartnerShiftHandoffSection', () => {
  it('renders the partner shift handoff summary, stats, and action cards', () => {
    const section = PartnerShiftHandoffSection({
      handoff: buildHandoff(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner shift handoff');
    expect(rendered).toContain('The first operator read for this partner queue.');
    expect(rendered).toContain('Immediate check');
    expect(rendered).toContain('Next best partner move');
    expect(rendered).toContain('Collect cash-fee debt before more bookings');
    expect(rendered).toContain('Open partner work queue');
    expect(rendered).toContain('Cash debt');
    expect(rendered).toContain('2');
    expect(rendered).toContain('Negative wallet blocks marketplace alerts and participation.');
    expect(rendered).toContain('Finance gate');
    expect(rendered).toContain('Linh Wellness');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners?review=cash-debt', '/cash-settlements']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['signal signal-warn', 'pill pill-danger', 'ops-task-card ops-task-blocked']),
    );
  });

  it('renders the no-sample state for action cards without sample partners', () => {
    const section = PartnerShiftHandoffSection({
      handoff: {
        ...buildHandoff(),
        actions: [
          {
            detail: 'No blockers are currently visible.',
            href: '/partners?review=direct-ready',
            operatorAction: 'Keep monitoring dispatch supply.',
            samples: [],
            scope: 'Dispatch supply',
            title: 'Keep ready partners warm for live requests',
            tone: 'ok',
          },
        ],
      },
    });

    expect(normalizedText(section)).toContain('No immediate partner sample');
  });
});

function buildHandoff(): PartnerShiftHandoffSectionModel {
  return {
    actions: [
      {
        detail: '2 partner(s) have negative wallet balance from cash-service fee or tax debt.',
        href: '/partners?review=cash-debt',
        operatorAction: 'Collect company fee deposit before marketplace alerts resume.',
        samples: ['Linh Wellness'],
        scope: 'Finance gate',
        title: 'Collect cash-fee debt before more bookings',
        tone: 'danger',
      },
    ],
    detail: 'Collect company fee deposit before marketplace alerts resume.',
    headline: 'Collect cash-fee debt before more bookings',
    label: 'Immediate check',
    primaryAction: {
      href: '/partners?review=cash-debt',
      label: 'Open partner work queue',
    },
    stats: [
      {
        detail: 'Negative wallet blocks marketplace alerts and participation.',
        href: '/cash-settlements',
        label: 'Cash debt',
        tone: 'danger',
        value: '2',
      },
    ],
    tone: 'danger',
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
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
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
