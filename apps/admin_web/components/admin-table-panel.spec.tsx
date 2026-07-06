import { AdminTableCard, AdminTablePanel, AdminTableSection } from './admin-table-panel';

describe('Admin table panel surfaces', () => {
  it('deduplicates shared Vuexy table chrome classes on table panels and cards', () => {
    const panel = AdminTablePanel({
      children: <p>Rows</p>,
      className: 'vuexy-booking-table-card finance-table vuexy-booking-table-group',
      title: 'Finance queue',
    });
    const card = AdminTableCard({
      children: <p>Rows</p>,
      className: 'vuexy-booking-table-card finance-card vuexy-booking-table-group',
    });
    const section = AdminTableSection({
      children: <p>Rows</p>,
      className: 'vuexy-booking-table-card finance-section vuexy-booking-table-group',
      title: 'Settlement queue',
    });

    expect(panel.props.className).toBe(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group finance-table',
    );
    expect(card.props.className).toBe('vuexy-booking-table-card vuexy-booking-table-group finance-card');
    expect(section.props.className).toBe('vuexy-booking-table-card vuexy-booking-table-group finance-section');
  });

  it('can render ungrouped table surfaces without adding the group class', () => {
    const panel = AdminTablePanel({
      children: <p>Rows</p>,
      grouped: false,
      title: 'Ungrouped table',
    });

    expect(panel.props.className).toBe('booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card');
  });
});
