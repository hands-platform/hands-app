import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import { OperationsPolicyDrilldownSection } from './operations-policy-drilldown-section';

describe('OperationsPolicyDrilldownSection', () => {
  it('uses shared Vuexy link atoms for drill-down actions', () => {
    const source = readFileSync('app/operations-policy/operations-policy-drilldown-section.tsx', 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminTaskBreakdown');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-task-breakdown">');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<div className="ops-task-note"');
    expect(source).not.toContain('<a className="button button-secondary policy-inline-action"');
    expect(source).not.toContain('<p className="muted admin-m-0">{list.emptyText}</p>');
  });

  it('renders drill-down lists with record links and empty guidance', () => {
    const section = OperationsPolicyDrilldownSection({
      drilldown: {
        totalCount: 1,
        lists: [
          {
            className: 'ops-task-pending',
            emptyText: 'No open matching booking is currently loaded.',
            helper: 'Review these bookings before changing live matching policy.',
            key: 'open',
            pillClass: 'pill-warn',
            rows: [
              {
                href: '/bookings/booking-1',
                id: 'booking-1',
                operatorAction: 'Review this booking before changing response-window policy.',
                pills: [{ className: 'pill-warn', label: 'OPEN_MATCHING' }],
                subtitle: 'Partner One / Customer One',
                title: 'Massage / book...g-1',
              },
            ],
            title: 'Open matching records',
          },
          {
            className: 'ops-task-done',
            emptyText: 'No saved policy drift is currently loaded.',
            helper: 'Snapshot drift records.',
            key: 'drift',
            pillClass: 'pill-success',
            rows: [],
            title: 'Saved policy drift records',
          },
        ],
      },
    });

    const rendered = renderToStaticMarkup(section);

    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
    expect(rendered).toContain('Policy impact drill-down');
    expect(rendered).toContain('Partner records');
    expect(rendered).toContain('1 item(s) to review');
    expect(rendered).toContain('Open matching records');
    expect(rendered).toContain('Saved policy drift records');
    expect(rendered).toContain('No saved policy drift is currently loaded.');
    expect(rendered).toContain('/bookings/booking-1');
    expect(classNamesIn(section)).toContain(
      'admin-form-control-link button button-secondary policy-inline-action',
    );
  });

  it('does not duplicate the base pill class for list and row pill badges', () => {
    const section = OperationsPolicyDrilldownSection({
      drilldown: {
        totalCount: 1,
        lists: [
          {
            className: 'ops-task-pending',
            emptyText: 'No open matching booking is currently loaded.',
            helper: 'Review these bookings before changing live matching policy.',
            key: 'open',
            pillClass: 'pill pill-warn',
            rows: [
              {
                href: '/bookings/booking-1',
                id: 'booking-1',
                operatorAction: 'Review this booking before changing response-window policy.',
                pills: [{ className: 'pill pill-danger', label: 'OPEN_MATCHING' }],
                subtitle: 'Partner One / Customer One',
                title: 'Massage / book...g-1',
              },
            ],
            title: 'Open matching records',
          },
        ],
      },
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-warn');
    expect(classNames).toContain('pill pill-danger');
    expect(classNames).not.toContain('pill pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-danger');
  });
});

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
