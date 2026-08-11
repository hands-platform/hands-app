import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { RefundsTableSection, type RefundTableRow } from './refunds-table-section';

describe('RefundsTableSection', () => {
  it('renders six operator columns, direct detail links, and a stateful checklist trigger', () => {
    const markup = renderToStaticMarkup(
      <RefundsTableSection emptyMessage="No cases" pagination={pagination([buildRow()])} />,
    );

    expect(markup).toContain('Customer / booking');
    expect(markup).toContain('Control readiness');
    expect(markup).toContain('Owner / action');
    expect(markup).toContain('Approval required');
    expect(markup).toContain('/payments/payment-1');
    expect(markup).not.toContain('/payments#payment-payment-1');
    expect(markup).toContain('/finance-tax/approval-queue?view=refunds');
    expect(markup).toContain('Review checklist');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="refund-review-refund-1"');
    expect(markup).not.toContain('class="refund-review-row"');
    expect(markup).not.toContain('colSpan="7"');
  });

  it('keeps only one checklist open and restores focus on Escape', () => {
    const source = readFileSync('app/refunds/refund-rows-table.tsx', 'utf8');

    expect(source).toContain('const [openId, setOpenId]');
    expect(source).toContain("event.key !== 'Escape'");
    expect(source).toContain('document.getElementById(`refund-checklist-toggle-${openId}`)?.focus()');
    expect(source).toContain('aria-expanded={isOpen}');
    expect(source).toContain("event.key !== 'Enter' && event.key !== ' '");
    expect(source).toContain('event.preventDefault()');
    expect(source).toContain('{isOpen ? (');
    expect(source).toContain('<td colSpan={6}>');
  });

  it('keeps empty-state actions supplied by the page', () => {
    const markup = renderToStaticMarkup(
      <RefundsTableSection
        emptyMessage={<div><strong>No cases in this view</strong><a href="/refunds?range=all">View all open refunds</a></div>}
        pagination={pagination([])}
      />,
    );

    expect(markup).toContain('No cases in this view');
    expect(markup).toContain('View all open refunds');
  });
});

function pagination(rows: readonly RefundTableRow[]) {
  return {
    from: rows.length ? 1 : 0,
    hrefForPage: (page: number) => `/refunds?page=${page}`,
    page: 1,
    rows,
    to: rows.length,
    totalPages: 1,
    totalRows: rows.length,
  };
}

function buildRow(): RefundTableRow {
  return {
    ageLabel: '2h ago',
    amount: 250000,
    bookingHref: '/bookings/booking-1',
    bookingId: 'booking-1',
    bookingIdLabel: 'bookin',
    bookingStatus: 'CANCELLED',
    checklistCompleted: 4,
    checklistRows: [
      { detail: 'Booking linked.', label: 'Booking record', pillClass: 'pill-success', status: 'Present' },
      { detail: 'Payment linked.', label: 'Payment record', pillClass: 'pill-success', status: 'Present' },
      { detail: 'Request linked.', label: 'Request context', pillClass: 'pill-success', status: 'Present' },
      { detail: 'Gateway linked.', label: 'Gateway evidence', pillClass: 'pill-success', status: 'Present' },
      { detail: 'Needs reconciliation.', label: 'State alignment', pillClass: 'pill-danger', status: 'Missing' },
    ],
    createdAtLabel: '09 Aug 2026, 10:00',
    currency: 'VND',
    customerHref: '/customers/customer-1',
    customerLabel: 'Customer One',
    evidenceBlockerLabel: '1 blocker to resolve',
    evidenceLabel: '4 of 5 checks complete',
    id: 'refund-1',
    opsHint: 'Review evidence and approve or reject',
    opsTone: 'warn',
    paymentHref: '/payments/payment-1',
    paymentId: 'payment-1',
    paymentLabel: 'CARD · CAPTURED',
    primaryActionHref: '/finance-tax/approval-queue?view=refunds',
    primaryActionLabel: 'Review decision',
    reason: 'Customer request',
    requestSource: 'Admin requested',
    shortId: 'ref-1',
    stageLabel: 'Approval required',
    workstreamLabel: 'Finance approval',
  };
}
