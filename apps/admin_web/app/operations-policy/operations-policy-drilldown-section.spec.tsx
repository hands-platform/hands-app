import { OperationsPolicyDrilldownSection } from './operations-policy-drilldown-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyDrilldownSection', () => {
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

    const rendered = normalizedTextContent(section);
    const children = Array.isArray(section.props.children) ? section.props.children : [];
    const grid = children[1];
    const lists = Array.isArray(grid.props.children) ? grid.props.children : [];

    expect(section.type).toBe('section');
    expect(rendered).toContain('Policy impact drill-down');
    expect(rendered).toContain('Partner records');
    expect(rendered).toContain('1 item(s) to review');
    expect(lists).toHaveLength(2);
    expect(lists[0].props.list.title).toBe('Open matching records');
    expect(lists[0].props.list.rows[0].href).toBe('/bookings/booking-1');
    expect(lists[1].props.list.emptyText).toBe('No saved policy drift is currently loaded.');
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
