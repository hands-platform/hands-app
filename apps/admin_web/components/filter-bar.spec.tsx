import { FilterBar, filterBarOptionClassName } from './filter-bar';

describe('FilterBar', () => {
  it('maps active and neutral options to existing pill classes', () => {
    expect(filterBarOptionClassName({ active: true })).toBe('pill pill-warn');
    expect(filterBarOptionClassName({ active: false, tone: 'success' })).toBe('pill pill-success');
    expect(filterBarOptionClassName({ active: false })).toBe('pill pill-neutral');
  });

  it('renders a search form with reset link, result label, and filter options', () => {
    const filterBar = FilterBar({
      action: '/partners',
      defaultQuery: 'Linh',
      options: [
        { href: '/partners?status=ready', label: 'Ready', active: true },
        { href: '/partners?status=blocked', label: 'Blocked', tone: 'danger' },
      ],
      placeholder: 'Partner name or phone',
      queryLabel: 'Find Partner',
      resetHref: '/partners',
      resultLabel: '2 Partner records',
      submitLabel: 'Search Partners',
    });

    expect(filterBar.type).toBe('section');
    expect(filterBar.props).toMatchObject({
      className: 'card filter-bar',
    });
    expect(filterBar.props.children).toHaveLength(2);
    expect(filterBar.props.children[1].props.className).toBe('participant-list filter-bar-options');
  });
});
