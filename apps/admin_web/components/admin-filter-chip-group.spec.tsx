import { readFileSync } from 'node:fs';

import { StatusBadgeLink } from './status-badge';
import { AdminFilterChipGroup } from './admin-filter-chip-group';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

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

  it('keeps chip groups on the Vuexy filter chip row rhythm', () => {
    const groupIndex = globalsCss.indexOf('.admin-filter-chip-group {');
    const groupBlock = cssRuleBlockAt(groupIndex);
    const pillIndex = globalsCss.indexOf('.admin-filter-chip-group .pill {');
    const pillBlock = cssRuleBlockAt(pillIndex);

    expect(groupIndex).toBeGreaterThan(-1);
    expect(groupBlock).toContain('align-items: center');
    expect(groupBlock).toContain('min-width: 0');
    expect(pillIndex).toBeGreaterThan(groupIndex);
    expect(pillBlock).toContain('flex-shrink: 0');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
