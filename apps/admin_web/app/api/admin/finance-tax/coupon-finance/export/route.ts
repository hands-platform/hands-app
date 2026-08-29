import { NextRequest, NextResponse } from 'next/server';

import type {
  AdminBookingSettlementSnapshot,
  AdminCouponFinanceSummary,
} from '../../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildBookingSettlementSnapshotRowsCsvContent,
  buildCouponFinanceApiHref,
  buildCouponFinanceSummaryApiHref,
  buildTaxSettlementServerPagination,
  emptyCouponFinanceSummary,
  readCouponFinanceFilters,
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

  const filters = readCouponFinanceFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const [snapshotsResult, summaryResult] = await Promise.all([
    adminGetResult<AdminBookingSettlementSnapshot[]>(buildCouponFinanceApiHref(filters), []),
    adminGetResult<AdminCouponFinanceSummary>(
      buildCouponFinanceSummaryApiHref(filters),
      emptyCouponFinanceSummary(),
    ),
  ]);
  if (!snapshotsResult.ok || !summaryResult.ok) {
    const upstreamStatus = !snapshotsResult.ok ? snapshotsResult.status : summaryResult.status;
    const status = upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502;
    return NextResponse.json(
      { error: 'COUPON_FINANCE_EXPORT_UPSTREAM_UNAVAILABLE' },
      { headers: NO_STORE_HEADERS, status },
    );
  }
  const snapshots = snapshotsResult.data;
  const totalRows = summaryResult.data.couponActivityCount ?? summaryResult.data.couponSettlementCount;
  const rows = buildTaxSettlementServerPagination(snapshots, filters, totalRows).rows;
  const visibleEnd = (filters.page - 1) * filters.take + rows.length;
  const activeFilters = new URLSearchParams({
    page: String(filters.page),
    range: filters.range,
    review: filters.review,
    take: String(filters.take),
    truncated: String(visibleEnd < totalRows),
    visible_rows_only: 'true',
  });
  if (filters.period) activeFilters.set('period', filters.period);
  if (filters.paymentMethod) activeFilters.set('paymentMethod', filters.paymentMethod);
  if (filters.q) activeFilters.set('q', filters.q);
  const csv = buildBookingSettlementSnapshotRowsCsvContent(rows, {
    activeFilters: activeFilters.toString(),
    generatedAt: new Date().toISOString(),
    generatedBy:
      access.mode === 'session-cookie'
        ? `session:${access.session?.jti.slice(0, 12) ?? 'authenticated'}`
        : 'dev-fallback',
    sort: filters.sort ?? 'server-default',
    timezone: 'Asia/Ho_Chi_Minh',
    totalRows,
  });

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-coupon-finance-${filters.range}-${filters.review}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
