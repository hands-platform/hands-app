import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import PaymentClearingPage, { generateMetadata } from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});
vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('PaymentClearingPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  const selectionSource = readFileSync(join(__dirname, 'payment-clearing-selection-controls.tsx'), 'utf8');
  const modelSource = readFileSync(join(__dirname, '..', 'tax-settlement-page-model.ts'), 'utf8');

  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'finance-admin' } as never);
  });

  it('gives each payment clearing table a distinct accessible name', () => {
    expect(source).toContain('ariaLabel="Payment clearing owner workload table"');
    expect(source).toContain('ariaLabel="Payment clearing evidence table"');
  });

  it('uses the shared Vuexy text link atom for table navigation links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the finance list compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Clearing command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('connects payment evidence to the four-part payment matching workspace', () => {
    expect(source).toContain('ariaLabel="Payment matching workspace"');
    expect(source).toContain("paymentMatchingTabLabel(\n              'Bank transactions'");
    expect(source).toContain("paymentMatchingTabLabel('Unmatched payment evidence'");
    expect(source).toContain("paymentMatchingTabLabel('Partial matches'");
    expect(source).toContain("paymentMatchingTabLabel(\n              'Cleared & reversed history'");
    expect(source).toContain('review=terminal&sort=recent');
  });

  it('gives each payment matching evidence workspace a distinct document title', async () => {
    await expect(generateMetadata({ searchParams: Promise.resolve({ review: 'open' }) })).resolves.toEqual({
      title: 'Unmatched Payment Evidence',
    });
    await expect(generateMetadata({ searchParams: Promise.resolve({ review: 'partial' }) })).resolves.toEqual({
      title: 'Partial Matches',
    });
    await expect(generateMetadata({ searchParams: Promise.resolve({ review: 'terminal' }) })).resolves.toEqual({
      title: 'Payment Matching History',
    });
  });

  it('operates payment clearing as an accountable oldest-first review queue', () => {
    expect(source).toContain("(['all', 'mine', 'unassigned', 'assigned'] as const)");
    expect(source).toContain("id: 'review-owner'");
    expect(source).toContain("'Review owner'");
    expect(source).toContain('label="Unassigned reviews"');
    expect(source).toContain('label="Open exposure"');
    expect(source).toContain('label="Over SLA"');
    expect(source).toContain('label="Terminal outcomes"');
    expect(source).not.toContain('Cleared ratio');
    expect(source).toContain('/review-assignment`');
    expect(source).toContain('The status and original age do not change.');
    expect(source).toContain('assignPaymentClearingReviewsAction');
    expect(source).toContain("'/admin/booking-payment-clearing/review-assignments'");
    expect(source).toContain(".getAll('clearingEntryIds')");
    expect(source).toContain('clearingEntryIds.length > 50');
    expect(source).toContain('name="clearingEntryIds"');
  });

  it('separates all-date command metrics from the currently filtered table summary', () => {
    expect(source).toContain('buildBookingPaymentClearingSummaryApiHref(overviewFilters)');
    expect(source).toContain('overviewSummary.clearedCount');
    expect(source).toContain('overviewSummary.openAmount');
    expect(source).toContain('overviewSummary.partiallyClearedCount');
    expect(source).toContain('buildTaxSettlementServerPagination(entries, filters, queueSummary.count)');
  });

  it('uses operator-facing queue names and a compact table with conditional bulk selection', () => {
    expect(modelSource).toContain("{ label: 'Needs bank match', review: 'open' }");
    expect(source).toContain("...(showBulkReviewAssignment ? ['Select'] : [])");
    expect(source).toContain("'Booking & payment'");
    expect(source).toContain("'Event & evidence'");
    expect(source).toContain("'Remaining & original'");
    expect(source).toContain("'Owner & SLA'");
    expect(source).toContain("'Next action'");
    expect(source).toContain("clearingState.isMatchable ? 'Review and match' : 'View evidence'");
    expect(source).toContain("if (review === 'cleared') return 'Cleared records';");
    expect(source).toContain("if (review === 'reversed') return 'Reversal records';");
    expect(source).not.toContain('<ActionMenu');
  });

  it('renders all-date command metrics above the filtered needs-action queue', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.includes('/booking-payment-clearing/review-owner-summary?')) {
        return {
          currency: 'VND',
          openAmount: 300000,
          openCount: 1,
          owners: [],
          unassigned: {
            oldestOccurredAt: '2026-07-25T08:00:00.000Z',
            openAmount: 300000,
            openCount: 1,
            over48hAmount: 300000,
            over48hCount: 1,
          },
        } as never;
      }
      if (href.startsWith('/admin/users?')) {
        return [{
          id: 'finance-admin',
          email: 'finance-admin@hands.test',
          fullName: 'Payment Operator',
          roles: ['ADMIN'],
          adminOperatorPermission: { categories: ['FINANCE_PAYMENT_CLEARING'] },
        }] as never;
      }
      if (href.includes('/booking-payment-clearing/summary?') && href.includes('review=open')) {
        return {
          amount: 300000,
          assignedCount: 0,
          clearedCount: 0,
          count: 1,
          currency: 'VND',
          oldestOpenAt: '2026-07-25T08:00:00.000Z',
          oldestUnassignedOpenAt: '2026-07-25T08:00:00.000Z',
          over48hAmount: 300000,
          over48hCount: 1,
          openAmount: 300000,
          openCount: 1,
          partiallyClearedAmount: 0,
          partiallyClearedCount: 0,
          reversedCount: 0,
          unassignedCount: 1,
        } as never;
      }
      if (href.includes('/booking-payment-clearing/summary?')) {
        return {
          amount: 1000000,
          assignedCount: 0,
          clearedCount: 2,
          count: 4,
          currency: 'VND',
          oldestOpenAt: '2026-07-25T08:00:00.000Z',
          oldestPartiallyClearedAt: '2026-07-24T08:00:00.000Z',
          oldestUnassignedOpenAt: '2026-07-25T08:00:00.000Z',
          over48hAmount: 500000,
          over48hCount: 2,
          openAmount: 300000,
          openCount: 1,
          partiallyClearedAmount: 200000,
          partiallyClearedCount: 1,
          reversedCount: 0,
          unassignedCount: 1,
        } as never;
      }
      if (href.startsWith('/admin/booking-payment-clearing?')) {
        return [{
          id: 'clearing-open-1',
          sourceKey: 'payment:captured:1',
          type: 'CUSTOMER_PAYMENT_CAPTURED',
          status: 'OPEN',
          bookingId: 'booking-open-1',
          paymentId: 'payment-open-1',
          amount: 300000,
          currency: 'VND',
          occurredAt: '2026-07-25T08:00:00.000Z',
          createdAt: '2026-07-25T08:00:00.000Z',
          updatedAt: '2026-07-25T08:00:00.000Z',
          booking: { id: 'booking-open-1', status: 'COMPLETED' },
          payment: {
            id: 'payment-open-1',
            method: 'CARD',
            status: 'CAPTURED',
            amount: 300000,
            currency: 'VND',
          },
          _count: { bankReconciliationMatches: 0 },
        }] as never;
      }
      return fallback as never;
    });

    const markup = renderToStaticMarkup(await PaymentClearingPage({
      searchParams: Promise.resolve({ range: 'today' }),
    }));

    expect(markup).toContain('Unassigned reviews');
    expect(markup).toContain('Open exposure');
    expect(markup).toContain('Over SLA');
    expect(markup).toContain('Terminal outcomes');
    expect(markup).not.toContain('Cleared ratio');
    expect(markup).toContain('All unresolved payment evidence');
    expect(markup).toContain('Review owner workload');
    expect(markup).toContain('Needs an owner');
    expect(markup).toContain('48h+');
    expect(markup).toContain('Customer Payment Captured');
    expect(markup).toContain('Booking &amp; payment');
    expect(markup).toContain('Event &amp; evidence');
    expect(markup).toContain('Remaining &amp; original');
    expect(markup).toContain('Owner &amp; SLA');
    expect(markup).toContain('Next action');
    expect(markup).toContain('Select all visible');
    expect(markup).toContain('0 selected');
    expect(markup).not.toContain('Assign selected to');
    expect(source).toContain('loadOwnerOptions={loadPaymentClearingReviewOwnerOptions}');
    expect(selectionSource).toContain('loadOwnerOptionsRef.current()');
    expect(selectionSource).toContain('const shouldSelect = selectedCount === 0');
    expect(selectionSource).toContain('Assign selected to');
    expect(selectionSource).toContain('disabled={!canSubmit}');
    expect(markup).toContain('name="clearingEntryIds"');
    expect(markup).toContain('value="clearing-open-1"');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing/summary?range=today&review=unresolved',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing/summary?range=all',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing/review-owner-summary?range=today&review=unresolved',
      expect.any(Object),
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('links to the all-date backlog when a limited range has no unresolved rows', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/booking-payment-clearing/summary?range=all') {
        return {
          amount: 550000,
          assignedCount: 0,
          clearedCount: 0,
          count: 3,
          currency: 'VND',
          openAmount: 450000,
          openCount: 2,
          over48hAmount: 0,
          over48hCount: 0,
          partiallyClearedAmount: 100000,
          partiallyClearedCount: 1,
          reversedCount: 0,
          unassignedCount: 3,
        } as never;
      }
      return fallback as never;
    });

    const markup = renderToStaticMarkup(await PaymentClearingPage({
      searchParams: Promise.resolve({ range: 'today' }),
    }));

    expect(markup).toContain('No unresolved payment evidence is in Today');
    expect(markup).toContain('3 unresolved record(s) remain across all dates');
    expect(markup).toContain('Review all unresolved evidence');
    expect(markup).toContain(
      '/finance-tax/payment-clearing?range=all&amp;review=unresolved&amp;sort=oldest',
    );
  });

  it('removes owner controls from historical record views', async () => {
    const markup = renderToStaticMarkup(await PaymentClearingPage({
      searchParams: Promise.resolve({ owner: 'mine', range: '30d', review: 'cleared' }),
    }));

    expect(markup).toContain('Cleared records');
    expect(markup).not.toContain('id="review-owner"');
    expect(markup).not.toContain('Review owner:');
    expect(mockedGetCurrentAdminOperatorAccess).not.toHaveBeenCalled();
    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.includes('/review-owner-summary')),
    ).toBe(false);
  });

  it('keeps the 48h SLA scope on list, summary, owner workload, and pagination links', async () => {
    const markup = renderToStaticMarkup(await PaymentClearingPage({
      searchParams: Promise.resolve({
        age: '48h',
        owner: 'unassigned',
        range: 'all',
        review: 'open',
      }),
    }));

    expect(markup).toContain('All ages');
    expect(markup).toContain('48h+');
    expect(markup).toContain('SLA age: 48h+');
    expect(markup).toContain(
      '/finance-tax/payment-clearing?range=all&amp;review=open&amp;sort=oldest&amp;age=48h&amp;owner=unassigned',
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing?range=all&take=10&review=open&assignment=unassigned&sort=oldest&age=48h',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing/summary?range=all&review=open&assignment=unassigned&age=48h',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-payment-clearing/review-owner-summary?range=all&review=open&age=48h',
      expect.any(Object),
    );
  });
});
