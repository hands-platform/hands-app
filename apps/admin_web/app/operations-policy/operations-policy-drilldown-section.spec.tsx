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
});
