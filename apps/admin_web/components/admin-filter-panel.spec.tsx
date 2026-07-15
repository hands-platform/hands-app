import { renderToStaticMarkup } from 'react-dom/server';

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
    expect(panel.props.children[0].props.children[0].props.className).toBe('admin-filter-panel-copy');
    expect(panel.props.children[0].props.children[1].props.className).toBe('admin-filter-panel-actions');
    expect(renderToStaticMarkup(panel)).toContain('pill pill-warn');
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

  it('supports multiple header action badges without leaving filter chrome', () => {
    const panel = AdminFilterPanel({
      actions: (
        <>
          <span>Vietnam only</span>
          <span>Generated now</span>
        </>
      ),
      children: <div>Range controls</div>,
      className: 'usage-overview-filter-panel',
      resultLabel: '7 days',
      title: 'Usage range',
    });

    expect(panel.props.className).toBe('card admin-filter-panel usage-overview-filter-panel admin-section');
    expect(panel.props.children[0].props.children[1].props.className).toBe('admin-filter-panel-actions');
    const markup = renderToStaticMarkup(panel);

    expect(markup).toContain('admin-filter-panel-actions');
    expect(markup).toContain('7 days');
    expect(markup).toContain('Vietnam only');
    expect(markup).toContain('Generated now');
  });

  it('allows page-specific body layout classes while keeping shared filter chrome', () => {
    const panel = AdminFilterPanel({
      bodyClassName: 'vietnam-overview-filter-body',
      children: <div>Region controls</div>,
      className: 'vietnam-overview-filter-panel',
      title: 'Period metrics range',
    });

    expect(panel.props.className).toBe('card admin-filter-panel vietnam-overview-filter-panel admin-section');
    expect(panel.props.children[1].props.className).toBe(
      'admin-filter-panel-body admin-section-body vietnam-overview-filter-body',
    );
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
