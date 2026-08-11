import { NextRequest, NextResponse } from 'next/server';

import type {
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementSnapshotSummary,
} from '../../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../../lib/admin-api';
import { recordAdminOperatorActivity } from '../../../../../../lib/admin-operator-access';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotRowsCsvContent,
  buildBookingSettlementSnapshotSummaryApiHref,
  emptyBookingSettlementSummary,
  readBookingSettlementAuditFilters,
} from '../../../../../finance-tax/tax-settlement-page-model';

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 100_000;
const EXPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = readBookingSettlementAuditFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const summaryResult = await adminGetResult<AdminBookingSettlementSnapshotSummary>(
    buildBookingSettlementSnapshotSummaryApiHref(filters),
    emptyBookingSettlementSummary(),
  );
  if (!summaryResult.ok) {
    return exportFailureResponse(filters, 'failed', {
      error: 'SETTLEMENT_AUDIT_SUMMARY_UNAVAILABLE',
      upstreamStatus: summaryResult.status,
    });
  }

  const totalRows = summaryResult.data.count;
  if (totalRows > MAX_EXPORT_ROWS) {
    return exportFailureResponse(
      filters,
      'failed',
      {
        error: 'SETTLEMENT_AUDIT_EXPORT_TOO_LARGE',
        limit: MAX_EXPORT_ROWS,
        totalRows,
      },
      413,
    );
  }

  const snapshots: AdminBookingSettlementSnapshot[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (snapshots.length < totalRows) {
    const pageFilters = { ...filters, ...(cursor ? { cursor } : {}), page: 1, take: EXPORT_PAGE_SIZE };
    const pageResult = await adminGetResult<AdminBookingSettlementSnapshot[]>(
      buildBookingSettlementSnapshotApiHref(pageFilters),
      [],
    );
    if (!pageResult.ok) {
      return exportFailureResponse(filters, snapshots.length > 0 ? 'partial' : 'failed', {
        error: 'SETTLEMENT_AUDIT_ROWS_UNAVAILABLE',
        expectedRows: totalRows,
        receivedRows: snapshots.length,
        upstreamStatus: pageResult.status,
      });
    }
    if (pageResult.data.length === 0) {
      return exportFailureResponse(
        filters,
        snapshots.length > 0 ? 'partial' : 'failed',
        {
          error: 'SETTLEMENT_AUDIT_EXPORT_INCOMPLETE',
          expectedRows: totalRows,
          receivedRows: snapshots.length,
        },
      );
    }
    snapshots.push(...pageResult.data);
    const nextCursor = pageResult.data.at(-1)?.auditCursor;
    if (snapshots.length < totalRows && (!nextCursor || seenCursors.has(nextCursor))) {
      return exportFailureResponse(
        filters,
        'partial',
        {
          error: 'SETTLEMENT_AUDIT_EXPORT_CURSOR_INVALID',
          expectedRows: totalRows,
          receivedRows: snapshots.length,
        },
      );
    }
    if (nextCursor) {
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
  }

  const completeRows = snapshots.slice(0, totalRows);
  const generatedAt = new Date().toISOString();
  const generatedBy = access.session?.sub ?? access.mode;
  const activeFilters = exportFilterDescription(filters);
  const csv = buildBookingSettlementSnapshotRowsCsvContent(completeRows, {
    activeFilters,
    generatedAt,
    generatedBy,
    sort: filters.sort ?? 'oldest',
    timezone: EXPORT_TIMEZONE,
    totalRows,
  });

  await recordAdminOperatorActivity(
    'finance.booking_settlement_audit.export',
    '/finance-tax/booking-settlement-audit',
    {
      filters: activeFilters,
      generatedAt,
      rowCount: totalRows,
      sort: filters.sort ?? 'oldest',
    },
  );

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-booking-settlement-audit-${filters.period ?? filters.range}-${filters.review}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

function exportFilterDescription(filters: ReturnType<typeof readBookingSettlementAuditFilters>) {
  return [
    `range=${filters.range}`,
    `review=${filters.review}`,
    filters.paymentMethod ? `paymentMethod=${filters.paymentMethod}` : null,
    filters.period ? `period=${filters.period}` : null,
    filters.owner ? `owner=${filters.owner}` : null,
    filters.reason ? `reason=${filters.reason}` : null,
    filters.status ? `status=${filters.status}` : null,
    filters.q ? `q=${filters.q}` : null,
  ]
    .filter(Boolean)
    .join(';');
}

async function exportFailureResponse(
  filters: ReturnType<typeof readBookingSettlementAuditFilters>,
  outcome: 'failed' | 'partial',
  body: Record<string, number | string | null>,
  status = 502,
) {
  await recordAdminOperatorActivity(
    `finance.booking_settlement_audit.export_${outcome}`,
    '/finance-tax/booking-settlement-audit',
    {
      ...body,
      filters: exportFilterDescription(filters),
      sort: filters.sort ?? 'oldest',
    },
  );
  return NextResponse.json(
    body,
    { headers: NO_STORE_HEADERS, status },
  );
}
