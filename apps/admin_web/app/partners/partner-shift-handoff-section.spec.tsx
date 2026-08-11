import { readFileSync } from 'node:fs';

import {
  PartnerShiftHandoffSection,
  type PartnerShiftHandoffSectionModel,
} from './partner-shift-handoff-section';

describe('PartnerShiftHandoffSection', () => {
  it('uses shared Vuexy badge atoms instead of raw shift handoff pill spans', () => {
    const source = readFileSync('app/partners/partner-shift-handoff-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).toContain('AdminActionCard');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-14">');
    expect(source).not.toContain('actions={<span className={`signal ${partnerCommandToneClass(handoff.tone)}`}>{handoff.label}</span>}');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('<span className="pill pill-info">Next best partner move</span>');
    expect(source).not.toContain('<span className={`pill ${partnerShiftPillClass(item.tone)}`}>{item.scope}</span>');
    expect(source).not.toContain('<span className="pill" key={`${item.title}-${sample}`}>');
    expect(source).not.toContain('<span className="pill pill-success">No immediate partner sample</span>');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-14">');
  });

  it('renders the partner shift handoff summary, stats, and action cards', () => {
    const section = PartnerShiftHandoffSection({
      handoff: buildHandoff(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner shift handoff');
    expect(rendered).toContain('The first operator read for this partner queue.');
    expect(rendered).toContain('payout profile');
    expect(rendered).not.toContain('payout setup');
    expect(rendered).toContain('Immediate check');
    expect(rendered).toContain('Next best partner move');
    expect(rendered).toContain('Collect cash-fee debt before more bookings');
    expect(rendered).toContain('Open partner work queue');
    expect(rendered).toContain('Cash debt');
    expect(rendered).toContain('2');
    expect(rendered).toContain('Negative wallet blocks final acceptance, service start, and payout release.');
    expect(rendered).toContain('Finance gate');
    expect(rendered).toContain('Linh Wellness');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners?review=cash-debt', '/cash-settlements']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 partner-shift-handoff-card',
        'signal signal-warn',
        'pill pill-danger',
        'ops-task-card ops-task-blocked',
      ]),
    );
  });

  it('renders the no-sample state for action cards without sample partners', () => {
    const section = PartnerShiftHandoffSection({
      handoff: {
        ...buildHandoff(),
        actions: [
          {
            detail: 'No blockers are currently visible.',
            href: '/partners?review=ready-now',
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
        operatorAction:
          'Collect company fee deposit before final acceptance, service start, or payout release resumes.',
        samples: ['Linh Wellness'],
        scope: 'Finance gate',
        title: 'Collect cash-fee debt before more bookings',
        tone: 'danger',
      },
    ],
    detail: 'Collect company fee deposit before final acceptance, service start, or payout release resumes.',
    headline: 'Collect cash-fee debt before more bookings',
    label: 'Immediate check',
    primaryAction: {
      href: '/partners?review=cash-debt',
      label: 'Open partner work queue',
    },
    stats: [
      {
        detail: 'Negative wallet blocks final acceptance, service start, and payout release.',
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
