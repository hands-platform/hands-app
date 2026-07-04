import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FilterBar, filterBarOptionClassName } from './filter-bar';
import { AdminFilterPanel } from './admin-filter-panel';
import { AdminFormGrid } from './admin-form-controls';

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

    expect(filterBar.type).toBe(AdminFilterPanel);
    expect(filterBar.props).toMatchObject({
      className: 'filter-bar',
      resultLabel: '2 Partner records',
      resultTone: 'info',
      title: 'Find Partner',
    });
    expect(filterBar.props.children[0].type).toBe(AdminFormGrid);
    expect(filterBar.props.children[0].props.className).toBe('compact-form');
    expect(filterBar.props.children[1].props.className).toBe('participant-list filter-bar-options');
  });

  it('uses the shared badge link atom for reset actions', () => {
    const source = readFileSync(join(process.cwd(), 'components/filter-bar.tsx'), 'utf8');

    expect(source).toContain('PillClassBadgeLink');
    expect(source).not.toContain('AdminFormControlLink');
    expect(source).not.toContain('className="pill pill-neutral"');
  });
});
