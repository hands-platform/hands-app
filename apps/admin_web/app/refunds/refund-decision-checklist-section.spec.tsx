import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RefundDecisionChecklistSection,
  type RefundDecisionChecklistItem,
} from './refund-decision-checklist-section';

describe('RefundDecisionChecklistSection', () => {
  it('renders decision checklist cards and manual decision link', () => {
    const section = RefundDecisionChecklistSection({
      items: buildItems(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Refund decision checklist');
    expect(rendered).toContain('Evidence-first checklist');
    expect(rendered).toContain('Manual decision queue');
    expect(rendered).toContain('Booking evidence');
    expect(rendered).toContain('2 outcome-linked');
    expect(rendered).toContain('Decision must be based on saved evidence');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings?view=manual-decision']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'pill pill-warn',
        'ops-task-card ops-task-pending',
      ]),
    );
  });

  it('does not duplicate the base pill class for decision checklist badges', () => {
    const section = RefundDecisionChecklistSection({
      items: buildItems().map((item) => ({
        ...item,
        pillClass: 'pill pill-warn',
      })),
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });

  it('uses the shared Vuexy action card surface for checklist links', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/refunds/refund-decision-checklist-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<Link className={`ops-task-card');
  });
});

function buildItems(): RefundDecisionChecklistItem[] {
  return [
    {
      className: 'ops-task-pending',
      detail: 'Open the booking, chat, location notes, and operator notes before deciding the refund outcome.',
      href: '/bookings?view=manual-decision',
      operatorRule: 'Decision must be based on saved evidence, not customer or Partner judgement.',
      pillClass: 'pill-warn',
      status: '2 outcome-linked',
      title: 'Booking evidence',
    },
  ];
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
