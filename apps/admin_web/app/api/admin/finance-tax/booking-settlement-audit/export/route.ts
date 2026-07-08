import { NextRequest, NextResponse } from 'next/server';

import type { AdminBookingSettlementSnapshot } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotRowsCsvContent,
  buildTaxSettlementServerPagination,
  readBookingSettlementFilters,
} from '../../../../../finance-tax/tax-settlement-page-model';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = readBookingSettlementFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const snapshots = await adminGet<AdminBookingSettlementSnapshot[]>(buildBookingSettlementSnapshotApiHref(filters), []);
  const storedTotal = snapshots.length ? Math.max(filters.page * filters.take, snapshots.length) : 0;
  const csv = buildBookingSettlementSnapshotRowsCsvContent(
    buildTaxSettlementServerPagination(snapshots, filters, storedTotal).rows,
  );

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-booking-settlement-audit-${filters.range}-${filters.review}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
