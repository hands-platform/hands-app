import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CashSettlementOpenDebtTableSection,
  type CashSettlementOpenDebtTableRow,
} from './cash-settlement-open-debt-table-section';
import type { CashSettlementFilters } from './cash-settlement-page-types';

describe('CashSettlementOpenDebtTableSection', () => {
  it('renders five compact columns with remaining, original and allocated amounts', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementOpenDebtTableSection
        filters={filters()}
        globalRowCount={89}
        pagination={pagination([buildRow()])}
      />,
    );

    for (const label of [
      'Partner / Booking',
      'Remaining exposure',
      'Age / Evidence',
      'Recommended action',
      'Review',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Remaining');
    expect(markup).toContain('100.000 VND');
    expect(markup).toContain('Original');
    expect(markup).toContain('170.000 VND');
    expect(markup).toContain('Allocated');
    expect(markup).toContain('70.000 VND');
    expect(markup).not.toContain('Owner / follow-up');
    expect(markup).not.toContain('No owner recorded');
    expect(markup).toContain(
      '/cash-settlements?queue=missing-evidence&amp;q=Mai&amp;sort=oldest&amp;review=earning-1',
    );
  });

  it('uses shared table, money, status, empty-state, and pagination atoms', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-open-debt-table-section.tsx'),
      'utf8',
    );
    for (const atom of ['FinanceDataTable', 'MoneyText', 'StatusBadge', 'AdminEmptyState', 'AdminTablePaginationFooter']) {
      expect(source).toContain(atom);
    }
    expect(source).toContain('cashSettlementReviewHref');
    expect(source).not.toContain('AdminInlineForm');
    expect(source).not.toContain('recordPartnerBankDeposit');
  });

  it('keeps the five-column workbench table within the desktop container', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    const tableRules = css.slice(
      css.indexOf('.cash-settlement-workbench-table-scroll .admin-data-table'),
      css.indexOf('.cash-settlement-row-links'),
    );

    expect(tableRules).toContain('min-width: 0;');
    expect(tableRules).toContain('table-layout: fixed;');
    expect(tableRules).toContain('width: 100%;');
    expect(tableRules).toContain('th:nth-child(5)');
    expect(tableRules).not.toContain('1180px');
    expect(tableRules).not.toContain('position: sticky');
    expect(tableRules).not.toContain('word-break: break-all');
  });

  it('renders a queue-specific compact empty state without a table shell', () => {
    const markup = renderToStaticMarkup(
      <CashSettlementOpenDebtTableSection
        filters={{ ...filters(), queue: 'payment-check' }}
        globalRowCount={89}
        pagination={pagination([])}
      />,
    );
    expect(markup).toContain('No booking-payment anomalies need review');
    expect(markup).toContain('global all-date backlog still contains 89');
    expect(markup).toContain('Return to All open (89)');
    expect(markup).not.toContain('<table');
  });
});

function filters(): CashSettlementFilters {
  return {
    age: 'all',
    page: 1,
    pageSize: 10,
    period: null,
    q: 'Mai',
    queue: 'missing-evidence',
    range: 'all',
    returnTo: null,
    sla: 'all',
    sort: 'oldest',
    view: null,
  };
}

function pagination(rows: readonly CashSettlementOpenDebtTableRow[]) {
  return {
    from: rows.length ? 1 : 0,
    page: 1,
    pageSize: 10,
    rows,
    to: rows.length,
    totalPages: 1,
    totalRows: rows.length,
  };
}

function buildRow(): CashSettlementOpenDebtTableRow {
  return {
    allocatedAmount: 70_000,
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'bookin',
    createdAtLabel: '26h ago',
    currency: 'VND',
    earningId: 'earning-1',
    isOverdue: true,
    nextAction: 'Review partial recovery',
    originalDebtAmount: 170_000,
    partnerHref: '/partners/partner-1',
    paymentMethod: 'CASH',
    providerName: 'Partner One',
    providerPhone: '+84900000000',
    remainingDebtAmount: 100_000,
    serviceLabel: 'Massage / 60 min',
    settlementEvidence: 'One approved allocation linked.',
  };
}
