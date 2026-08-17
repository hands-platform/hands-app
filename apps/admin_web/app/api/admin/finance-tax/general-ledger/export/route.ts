import { NextRequest, NextResponse } from 'next/server';

import type {
  AdminAccountingJournalBatch,
  AdminAccountingJournalBatchSummary,
} from '../../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../../lib/admin-api';
import { recordAdminOperatorActivity } from '../../../../../../lib/admin-operator-access';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import { mapInBatches } from '../../../../../../lib/bounded-parallel';
import {
  buildAccountingJournalBatchApiHref,
  buildAccountingJournalBatchRowsCsvContent,
  buildAccountingJournalBatchSummaryApiHref,
  emptyAccountingJournalBatchSummary,
  readFinanceAccountingFilters,
} from '../../../../../finance-tax/tax-settlement-page-model';

const EXPORT_PAGE_SIZE = 100;
const EXPORT_CONCURRENCY = 4;
const MAX_EXPORT_ROWS = 100_000;
const EXPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const NO_STORE_HEADERS = { 'cache-control': 'no-store', pragma: 'no-cache' };

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = readFinanceAccountingFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
    'needs-action',
  );
  const summaryResult = await adminGetResult<AdminAccountingJournalBatchSummary>(
    buildAccountingJournalBatchSummaryApiHref(filters),
    emptyAccountingJournalBatchSummary(),
  );
  if (!summaryResult.ok) return upstreamExportError('JOURNAL_BATCH_SUMMARY_UNAVAILABLE', summaryResult.status);
  if (summaryResult.data.count > MAX_EXPORT_ROWS) {
    return NextResponse.json(
      { error: 'JOURNAL_BATCH_EXPORT_TOO_LARGE', limit: MAX_EXPORT_ROWS, totalRows: summaryResult.data.count },
      { headers: NO_STORE_HEADERS, status: 413 },
    );
  }

  const pageCount = Math.ceil(summaryResult.data.count / EXPORT_PAGE_SIZE);
  const pageResults = await mapInBatches(
    Array.from({ length: pageCount }, (_, index) => index + 1),
    EXPORT_CONCURRENCY,
    (page) => adminGetResult<AdminAccountingJournalBatch[]>(
      buildAccountingJournalBatchApiHref({ ...filters, page, take: EXPORT_PAGE_SIZE }),
      [],
    ),
  );
  const failedPage = pageResults.find((pageResult) => !pageResult.ok);
  if (failedPage) return upstreamExportError('JOURNAL_BATCH_ROWS_UNAVAILABLE', failedPage.status);
  const rows = pageResults.flatMap((pageResult) => pageResult.data);
  if (rows.length < summaryResult.data.count) {
      return NextResponse.json(
        {
          error: 'JOURNAL_BATCH_EXPORT_INCOMPLETE',
          expectedRows: summaryResult.data.count,
          receivedRows: rows.length,
        },
        { headers: NO_STORE_HEADERS, status: 502 },
      );
  }

  const generatedAt = new Date().toISOString();
  const activeFilters = exportFilterDescription(filters);
  const sort = filters.sort ?? (filters.review === 'needs-action' ? 'oldest' : 'newest');
  const csv = buildAccountingJournalBatchRowsCsvContent(rows.slice(0, summaryResult.data.count), {
    activeFilters,
    generatedAt,
    generatedBy: access.session?.sub ?? access.mode,
    sort,
    timezone: EXPORT_TIMEZONE,
    totalRows: summaryResult.data.count,
  });

  await recordAdminOperatorActivity('finance.journal_batches.export', '/finance-tax/general-ledger', {
    filters: activeFilters,
    generatedAt,
    rowCount: summaryResult.data.count,
    sort,
  });

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-journal-batches-${filters.period ?? filters.range}-${filters.review}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

function exportFilterDescription(filters: ReturnType<typeof readFinanceAccountingFilters>) {
  return [
    `range=${filters.range}`,
    `review=${filters.review}`,
    filters.journalSource ? `source=${filters.journalSource}` : null,
    filters.period ? `period=${filters.period}` : null,
    filters.q ? `q=${filters.q}` : null,
  ]
    .filter(Boolean)
    .join(';');
}

function upstreamExportError(error: string, upstreamStatus: number | null) {
  return NextResponse.json({ error, upstreamStatus }, { headers: NO_STORE_HEADERS, status: 502 });
}
