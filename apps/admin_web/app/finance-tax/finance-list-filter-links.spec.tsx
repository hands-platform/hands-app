import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceListFilterLinks, financeListFilterLinkClassName } from './finance-list-filter-links';

describe('FinanceListFilterLinks', () => {
  it('normalizes active and inactive pill classes through the shared badge helper', () => {
    expect(financeListFilterLinkClassName({ active: true, activePillClassName: 'pill-info' })).toBe('pill pill-info');
    expect(financeListFilterLinkClassName({ active: false, activePillClassName: 'pill-info' })).toBe(
      'pill pill-neutral',
    );
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
