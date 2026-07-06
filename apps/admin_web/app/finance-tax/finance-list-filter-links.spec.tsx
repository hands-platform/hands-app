import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceListFilterLinks, financeListFilterLinkClassName } from './finance-list-filter-links';

describe('FinanceListFilterLinks', () => {
  it('normalizes active and inactive pill classes through the shared badge helper', () => {
    expect(financeListFilterLinkClassName({ active: true, activePillClassName: 'pill-info' })).toBe('pill pill-info');
    expect(financeListFilterLinkClassName({ active: false, activePillClassName: 'pill-info' })).toBe(
      'pill pill-neutral',
    );
  });

  it('renders through shared StatusBadgeLink atoms instead of direct link class assembly', () => {
    const source = readFileSync('app/finance-tax/finance-list-filter-links.tsx', 'utf8');

    expect(source).toContain('StatusBadgeLinkFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain("import Link from 'next/link'");
    expect(source).not.toContain('pillClassBadgeClassName');
    expect(source).not.toContain('className={financeListFilterLinkClassName(link)}');
  });

  it('renders filter links with shared pill classes', () => {
    const markup = renderToStaticMarkup(
      <FinanceListFilterLinks
        groups={[
          {
            id: 'range',
            links: [
              {
                active: true,
                activePillClassName: 'pill-success',
                href: '/finance-tax/payment-clearing?range=today',
                id: 'today',
                label: 'Today',
              },
              {
                active: false,
                activePillClassName: 'pill-warn',
                href: '/finance-tax/payment-clearing?range=all',
                id: 'all',
                label: 'All dates',
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain('class="pill pill-success"');
    expect(markup).toContain('class="pill pill-neutral"');
  });
});
