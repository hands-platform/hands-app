import { AdminFilterPanel } from './admin-filter-panel';

describe('AdminFilterPanel', () => {
  it('renders shared filter panel structure with optional result and footer', () => {
    const panel = AdminFilterPanel({
      children: <div data-testid="filters">Filters</div>,
      className: 'booking-monitor-filter-panel',
      description: 'Active queue copy',
      footer: <p>Operator hint</p>,
      id: 'booking-filters',
      resultLabel: 'Showing 4 of 9',
      resultTone: 'warning',
      title: 'Booking operation filters',
    });

    expect(panel.type).toBe('section');
    expect(panel.props).toMatchObject({
      'aria-labelledby': 'booking-filters-title',
      className: 'card admin-filter-panel booking-monitor-filter-panel admin-section',
      id: 'booking-filters',
    });
    expect(panel.props.children).toHaveLength(3);
    expect(panel.props.children[0].props.className).toBe(
      'ops-section-header admin-filter-panel-header admin-section-header',
    );
    expect(panel.props.children[0].props.children[1].props.tone).toBe('warning');
    expect(panel.props.children[1].props.className).toBe('admin-filter-panel-body admin-section-body');
    expect(panel.props.children[2].props.className).toBe('admin-filter-panel-footer admin-section-footer');
  });

  it('allows link-only filter panels without a body section', () => {
    const panel = AdminFilterPanel({
      footer: <div>Quick filters</div>,
      resultLabel: 'Showing 2 of 10',
      title: 'Notification operation filters',
    });

    expect(panel.props.children).toHaveLength(3);
    expect(panel.props.children[1]).toBeNull();
    expect(panel.props.children[2].props.className).toBe('admin-filter-panel-footer admin-section-footer');
  });

  it('deduplicates Vuexy surface class tokens passed by legacy callers', () => {
    const panel = AdminFilterPanel({
      children: 'Filters',
      className: 'card admin-filter-panel booking-monitor-filter-panel admin-section',
      title: 'Booking operation filters',
    });

    expect(panel.props.className).toBe(
      'card admin-filter-panel booking-monitor-filter-panel admin-section',
    );
  });
});
