import { AdminSegmentedControl } from './admin-segmented-control';

describe('AdminSegmentedControl', () => {
  it('renders Vuexy segmented filter links with stable active state and deduped classes', () => {
    const segmented = AdminSegmentedControl({
      activeValue: 'today',
      ariaLabel: 'Usage range',
      className: 'booking-date-filter-buttons usage-overview-range-buttons',
      options: [
        { href: '/usage-overview?range=today', label: 'Today', title: 'Show today', value: 'today' },
        { href: '/usage-overview?range=7d', label: '7 days', value: '7d' },
      ],
    });

    expect(segmented.props).toMatchObject({
      'aria-label': 'Usage range',
      className: 'booking-date-filter-buttons usage-overview-range-buttons',
    });
    expect(segmented.props.children[0].props).toMatchObject({
      'aria-current': 'page',
      className: 'booking-date-filter-button is-active',
      href: '/usage-overview?range=today',
      title: 'Show today',
    });
    expect(segmented.props.children[1].props['aria-current']).toBeUndefined();
  });

  it('keeps duplicate option values on unique React keys during migrations', () => {
    const segmented = AdminSegmentedControl({
      activeValue: 'open',
      ariaLabel: 'Review queues',
      options: [
        { href: '/reviews?queue=open', label: 'Open reviews', value: 'open' },
        { href: '/partners?queue=open', label: 'Open partners', value: 'open' },
      ],
    });

    expect(segmented.props.children.map((child: { key: string }) => child.key)).toEqual([
      'open-0',
      'open-1',
    ]);
  });

  it('supports explicit navigation and tab semantics without changing default callers', () => {
    const navigation = AdminSegmentedControl({
      activeValue: 'today',
      ariaLabel: 'Finance workspaces',
      options: [
        { href: '/finance-overview', label: 'Today movement', value: 'today' },
        { href: '/finance-overview?view=queues', label: 'Current backlog', value: 'queues' },
      ],
      semantics: 'navigation',
    });
    const tabs = AdminSegmentedControl({
      activeValue: '7d',
      ariaLabel: 'Finance range',
      options: [
        { href: '/finance-overview?view=flow&range=today', label: 'Today', value: 'today' },
        { href: '/finance-overview?view=flow&range=7d', label: '7 days', value: '7d' },
      ],
      semantics: 'tabs',
    });

    expect(navigation.type).toBe('nav');
    expect(navigation.props.children[0].props['aria-current']).toBe('page');
    expect(tabs.props.role).toBe('tablist');
    expect(tabs.props.children[1].props).toMatchObject({
      'aria-current': undefined,
      'aria-selected': true,
      role: 'tab',
    });
  });
});
