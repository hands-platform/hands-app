import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { FinanceListFilterLinks, financeListFilterLinkClassName } from './finance-list-filter-links';

describe('FinanceListFilterLinks', () => {
  it('normalizes active and inactive pill classes through the shared badge helper', () => {
    expect(financeListFilterLinkClassName({ active: true, activePillClassName: 'pill-info' })).toBe(
      'pill pill-info',
    );
    expect(financeListFilterLinkClassName({ active: false, activePillClassName: 'pill-info' })).toBe(
      'pill pill-neutral',
    );
  });

  it('renders through shared segmented filter atoms instead of direct link class assembly', () => {
    const source = readFileSync('app/finance-tax/finance-list-filter-links.tsx', 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('AdminFilterChipGroup');
    expect(source).not.toContain('StatusBadgeLinkFromPillClass');
    expect(source).not.toContain("import Link from 'next/link'");
    expect(source).not.toContain('pillClassBadgeClassName');
    expect(source).not.toContain('className={financeListFilterLinkClassName(link)}');
  });

  it('keeps finance list pages from passing raw participant-list wrappers', () => {
    const financeListPages = [
      'app/finance-tax/booking-settlement-audit/page.tsx',
      'app/finance-tax/coupon-finance/page.tsx',
      'app/finance-tax/settlement-reversals/page.tsx',
    ];

    for (const pagePath of financeListPages) {
      expect(readFileSync(pagePath, 'utf8')).not.toContain("className: 'participant-list");
    }
  });

  it('renders filter links with shared Vuexy segmented controls', () => {
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
          {
            id: 'evidence-source',
            links: [
              {
                active: true,
                activePillClassName: 'pill-info',
                href: '/finance-tax/bank-reconciliation?source=PAYMENT_CLEARING',
                id: 'PAYMENT_CLEARING',
                label: 'Payment clearing',
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain('class="booking-date-filter-bar finance-list-filter-group"');
    expect(markup).toContain('class="finance-list-filter-group-label">Range</span>');
    expect(markup).toContain('class="booking-date-filter-buttons finance-list-filter-buttons"');
    expect(markup).toContain('class="booking-date-filter-button is-active"');
    expect(markup).toContain('class="booking-date-filter-button"');
    expect(markup).toContain('Active finance list filters');
    expect(markup).toContain('Range: Today');
    expect(markup).toContain('class="finance-list-filter-group-label">Evidence source</span>');
    expect(markup).toContain('Evidence source: Payment clearing');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/finance-tax/payment-clearing?range=today"');
  });

  it('keeps primary bank filters visible and summarizes only non-default compact filters', () => {
    const markup = renderToStaticMarkup(
      <FinanceListFilterLinks
        compact
        groups={[
          {
            defaultId: 'all',
            id: 'direction',
            links: [
              {
                active: true,
                activePillClassName: 'pill-info',
                href: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
                id: 'all',
                label: 'All',
              },
            ],
          },
          {
            defaultId: 'unmatched',
            id: 'review',
            links: [
              {
                active: true,
                activePillClassName: 'pill-warn',
                href: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
                id: 'unmatched',
                label: 'Needs action',
              },
            ],
          },
          {
            defaultId: 'all',
            id: 'range',
            links: [
              {
                active: true,
                activePillClassName: 'pill-info',
                href: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
                id: 'all',
                label: 'All dates',
              },
            ],
          },
          {
            defaultId: 'all',
            id: 'review-owner',
            links: [
              {
                active: false,
                activePillClassName: 'pill-info',
                href: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
                id: 'all',
                label: 'All owners',
              },
              {
                active: true,
                activePillClassName: 'pill-warn',
                href: '/finance-tax/bank-reconciliation?range=all&review=unmatched&owner=mine',
                id: 'mine',
                label: 'My reviews',
              },
            ],
          },
        ]}
      />,
    );

    expect(markup).toContain('More filters');
    expect(markup).toContain('Review owner: My reviews');
    expect(markup).not.toContain('direction: All');
    expect(markup).not.toContain('Queue: Needs action</span>');
    expect(markup).not.toContain('Range: All dates</span>');
  });
});
