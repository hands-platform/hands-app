import { StatusBadgeLink } from './status-badge';
import { AdminFilterChipGroup } from './admin-filter-chip-group';

describe('AdminFilterChipGroup', () => {
  it('renders Vuexy chip filters as a labelled control group with deduped classes', () => {
    const group = AdminFilterChipGroup({
      ariaLabel: 'Finance date filters',
      className: 'participant-list admin-filter-chip-group admin-mt-12',
      children: [
        <StatusBadgeLink href="/finance-overview?range=today" key="today" tone="primary">
          Today
        </StatusBadgeLink>,
        <StatusBadgeLink href="/finance-overview?range=7d" key="7d" tone="neutral">
          7 days
        </StatusBadgeLink>,
      ],
    });

    expect(group.type).toBe('div');
    expect(group.props).toMatchObject({
      'aria-label': 'Finance date filters',
      className: 'participant-list admin-filter-chip-group admin-mt-12',
      role: 'group',
    });
    expect(group.props.children).toHaveLength(2);
  });
});
