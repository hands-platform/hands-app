import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import GeneralLedgerPage, { metadata } from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

const summary = {
  balancedCount: 9,
  blockedAmount: 110000,
  blockedCount: 1,
  clearCount: 9,
  count: 12,
  currency: 'VND',
  draftCount: 2,
  entryMismatchCount: 0,
  formulaDeltaCount: 1,
  generatedAt: '2026-08-09T00:00:00.000Z',
  headerEntryMismatchCount: 1,
  headerMismatchCount: 0,
  needsActionCount: 4,
  postedCount: 10,
  postedWithoutEntryCount: 0,
  reversedCount: 1,
  totalCredit: 1200000,
  totalDebit: 1300000,
  unbalancedAmount: 110000,
  unbalancedCount: 1,
  unknownCount: 1,
};

describe('GeneralLedgerPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
  });

  it('uses the shared Vuexy text link atom for ledger table links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the ledger queue compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Journal batch integrity queues">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps primary filters first and secondary controls in a closed advanced disclosure', async () => {
    const page = await GeneralLedgerPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);
    const searchIndex = source.indexOf('label="Search journal batches"');
    const queueIndex = source.indexOf('label="Integrity queue"');
    const rangeIndex = source.indexOf('label="Posted range"');
    const applyIndex = source.indexOf('>Apply</AdminFormControlButton>');
    const advancedIndex = source.indexOf('ariaLabel="Advanced journal filters"');

    expect(searchIndex).toBeGreaterThan(-1);
    expect(searchIndex).toBeLessThan(queueIndex);
    expect(queueIndex).toBeLessThan(rangeIndex);
    expect(rangeIndex).toBeLessThan(applyIndex);
    expect(applyIndex).toBeLessThan(advancedIndex);
    expect(markup).toContain('class="admin-disclosure general-ledger-advanced-filters"');
    expect(markup).not.toMatch(/<details[^>]*general-ledger-advanced-filters[^>]*open=""/);
  });

  it('summarizes active advanced filters while their controls remain collapsed', async () => {
    const page = await GeneralLedgerPage({
      searchParams: Promise.resolve({
        period: '2026-07',
        range: 'all',
        review: 'all',
        sort: 'largest-discrepancy',
        source: 'BOOKING_SETTLEMENT_REVERSAL',
        take: '25',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Source: Settlement reversal');
    expect(markup).toContain('Period: 2026-07');
    expect(markup).toContain('Sort: Largest discrepancy');
    expect(markup).toContain('Rows: 25');
  });

  it('sets the root-templated browser title without duplicating the Admin suffix', () => {
    expect(metadata).toEqual({ title: 'Journal Batches' });
  });

  it('defaults to a bounded needs-action queue while keeping period overview metrics stable', async () => {
    const requests: string[] = [];
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      requests.push(href);
      if (href === '/admin/accounting-journal-batches/summary?range=today&review=all') {
        return { data: summary, ok: true, status: 200 };
      }
      if (
        href ===
        '/admin/accounting-journal-batches/summary?range=today&review=all&source=BOOKING_SETTLEMENT_REVERSAL'
      ) {
        return { data: { ...summary, count: 41 }, ok: true, status: 200 };
      }
      if (href.includes('/summary?')) {
        return { data: { ...summary, count: 3 }, ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await GeneralLedgerPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(requests).toContain('/admin/accounting-journal-batches/summary?range=today&review=needs-action');
    expect(requests).toContain('/admin/accounting-journal-batches/summary?range=today&review=all');
    expect(requests).toContain(
      '/admin/accounting-journal-batches/summary?range=today&review=all&source=BOOKING_SETTLEMENT_REVERSAL',
    );
    expect(requests).toContain('/admin/accounting-journal-batches?range=today&take=10&review=needs-action');
    expect(markup).toContain('Needs action');
    expect(markup).toContain('Blocked integrity');
    expect(markup).toContain('110.000 VND');
    expect(markup).toContain('Draft batches');
    expect(markup).toContain('Settlement reversals (41)');
    expect(markup).toContain('href="/finance-tax/general-ledger?range=today&amp;review=unknown"');
    expect(markup).toContain('2 batch(es) are not posted');
    expect(markup).toContain('<option value="all">All records</option>');
    expect(markup).toContain('href="/finance-tax/general-ledger?range=today&amp;review=needs-action">Reset</a>');
    expect(source).toContain("'overview'");
    expect(source).toContain("'approval-queue'");
    expect(source).toContain("'payment-clearing'");
    expect(source).toContain("'bank-reconciliation'");
    expect(source).toContain("'monthly-tax-closing'");
  });

  it('describes reversed review as batch lifecycle status rather than settlement reversal activity', () => {
    expect(source).toContain('batch lifecycle status');
    expect(source).not.toContain('Historical reversal journals');
  });

  it('keeps posted lifecycle results informational and states filtered integrity warnings', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/accounting-journal-batches/summary?range=all&review=posted') {
        return {
          data: { ...summary, blockedCount: 1, count: 10, unknownCount: 2 },
          ok: true,
          status: 200,
        };
      }
      if (href.includes('/summary?')) {
        return { data: summary, ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await GeneralLedgerPage({
      searchParams: Promise.resolve({ range: 'all', review: 'posted' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Posted records');
    expect(markup).toContain('10 batch(es) · 3 integrity warning(s)');
    expect(markup).toContain('pill pill-info');
    expect(source).not.toContain("if (review === 'posted') return 'success' as const;");
  });

  it('applies search only to the paginated queue and keeps compact integrity rows', async () => {
    const requests: string[] = [];
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      requests.push(href);
      if (href === '/admin/accounting-journal-batches?range=30d&take=25&review=unbalanced&q=booking+42&skip=25') {
        return { data: [
          {
            _count: { entries: 2 },
            booking: { status: 'COMPLETED' },
            bookingId: 'booking-42',
            createdAt: '2026-07-20T01:00:00.000Z',
            currency: 'VND',
            id: 'journal-42',
            integrity: {
              blockerCodes: ['HEADER_ENTRY_MISMATCH', 'FORMULA_DELTA'],
              checkedAt: '2026-08-09T00:00:00.000Z',
              discrepancyAmount: 110000,
              entryCount: 2,
              entryCredit: 390000,
              entryDebit: 390000,
              formulaDelta: 12000,
              formulaEvidenceAvailable: true,
              headerCredit: 500000,
              headerDebit: 500000,
              linkedMonthlyPeriod: '2026-07',
              periodEvidenceAvailable: true,
              state: 'BLOCKED',
            },
            monthlyPeriod: '2026-07',
            postedAt: '2026-07-20T02:00:00.000Z',
            reversedAt: null,
            sourceId: 'booking-42',
            sourceKey: 'journal:booking-42',
            sourceType: 'BOOKING_SETTLEMENT',
            status: 'POSTED',
            totalCredit: 500000,
            totalDebit: 500000,
            updatedAt: '2026-07-20T02:00:00.000Z',
          },
        ], ok: true, status: 200 };
      }
      if (href === '/admin/accounting-journal-batches/summary?range=30d&review=unbalanced&q=booking+42') {
        return { data: {
          ...summary,
          count: 26,
          draftCount: 0,
          postedCount: 26,
          reversedCount: 0,
        }, ok: true, status: 200 };
      }
      if (href === '/admin/accounting-journal-batches/summary?range=30d&review=all') {
        return { data: summary, ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await GeneralLedgerPage({
      searchParams: Promise.resolve({
        page: '2',
        q: 'booking 42',
        range: '30d',
        review: 'unbalanced',
        take: '25',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(requests).toContain(
      '/admin/accounting-journal-batches/summary?range=30d&review=unbalanced&q=booking+42',
    );
    expect(requests).toContain('/admin/accounting-journal-batches/summary?range=30d&review=all');
    expect(requests).toContain(
      '/admin/accounting-journal-batches?range=30d&take=25&review=unbalanced&q=booking+42&skip=25',
    );
    expect(markup).toContain('Related context');
    expect(markup).toContain('Integrity');
    expect(markup).toContain('Integrity blocked');
    expect(markup).toContain('Header/entry mismatch');
    expect(markup).toContain('Formula delta');
    expect(markup).toContain('Entries 2');
    expect(markup).toContain('390.000 VND');
    expect(markup).toContain('Formula <span class="money-text money-text-positive">12.000 VND</span>');
    expect(markup).toContain('/finance-tax/general-ledger/journal-42?returnTo=');
    expect(markup).toContain('Clear search');
    expect(markup).toContain(
      'href="/finance-tax/general-ledger?range=30d&amp;review=unbalanced&amp;take=25">Clear search</a>',
    );
    expect(markup).toContain(
      'href="/finance-tax/general-ledger?range=today&amp;review=needs-action">Reset</a>',
    );
    expect(markup).not.toContain('Customer phone');
    expect(markup).not.toContain('Partner phone');
  });

  it('renders upstream failures as unavailable instead of a zero-record ledger', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const page = await GeneralLedgerPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Journal summary unavailable');
    expect(markup).toContain('Journal batch records unavailable');
    expect(markup).toContain('No zero-count assumption has been made.');
    expect(markup).not.toContain('0 matching batch(es)');
    expect(markup).not.toContain('No journal batches match the current scope.');
  });

  it('distinguishes permission failures from unavailable data and zero results', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 403,
    }));

    const page = await GeneralLedgerPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Journal batch permission required');
    expect(markup).toContain('does not have permission');
    expect(markup).not.toContain('No journal batches match the current scope.');
  });
});
