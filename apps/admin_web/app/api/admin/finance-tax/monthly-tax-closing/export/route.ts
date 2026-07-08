import { NextRequest, NextResponse } from 'next/server';

import type { AdminMonthlyTaxClosing, AdminMonthlyTaxClosingSummary } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildMonthlyTaxClosingAccountingJournalCsvContent,
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingRowsCsvContent,
  buildMonthlyTaxClosingSummaryApiHref,
  buildMonthlyTaxClosingSummaryCsvContent,
  buildTaxSettlementServerPagination,
  emptyMonthlyTaxClosingSummary,
  readMonthlyTaxClosingFilters,
  type MonthlyTaxClosingExportKind,
} from '../../../../../finance-tax/tax-settlement-page-model';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

const EXPORT_KINDS = new Set<MonthlyTaxClosingExportKind>(['summary', 'rows', 'accounting-journal']);

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const kind = readExportKind(params.kind);
  if (!kind) {
    return NextResponse.json({ error: 'INVALID_EXPORT_KIND' }, { headers: NO_STORE_HEADERS, status: 400 });
  }

  const filters = readMonthlyTaxClosingFilters(params);
  const csv = await buildExportCsv(kind, filters);

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="${buildExportFilename(filters.period, kind)}"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}

function readExportKind(value: string | undefined) {
  return value && EXPORT_KINDS.has(value as MonthlyTaxClosingExportKind)
    ? (value as MonthlyTaxClosingExportKind)
    : null;
}

async function buildExportCsv(
  kind: MonthlyTaxClosingExportKind,
  filters: ReturnType<typeof readMonthlyTaxClosingFilters>,
) {
  if (kind === 'rows') {
    const closings = await adminGet<AdminMonthlyTaxClosing[]>(buildMonthlyTaxClosingApiHref(filters), []);
    const storedClosingTotal = closings.length ? Math.max(filters.page * filters.take, closings.length) : 0;
    return buildMonthlyTaxClosingRowsCsvContent(
      buildTaxSettlementServerPagination(closings, filters, storedClosingTotal).rows,
    );
  }

  const summary = await adminGet<AdminMonthlyTaxClosingSummary>(
    buildMonthlyTaxClosingSummaryApiHref(filters),
    emptyMonthlyTaxClosingSummary(filters.period),
  );

  return kind === 'summary'
    ? buildMonthlyTaxClosingSummaryCsvContent(summary)
    : buildMonthlyTaxClosingAccountingJournalCsvContent(summary);
}

function buildExportFilename(period: string, kind: MonthlyTaxClosingExportKind) {
  if (kind === 'accounting-journal') {
    return `hands-accounting-journal-${period}.csv`;
  }
  return `hands-monthly-tax-closing-${period}-${kind}.csv`;
}
