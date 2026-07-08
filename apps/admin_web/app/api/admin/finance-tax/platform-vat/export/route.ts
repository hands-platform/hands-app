import { NextRequest, NextResponse } from 'next/server';

import type { AdminPlatformVatSummary } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildPlatformVatSummaryApiHref,
  buildPlatformVatSummaryCsvContent,
  emptyPlatformVatSummary,
  readMonthlyTaxClosingFilters,
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

  const filters = readMonthlyTaxClosingFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const summary = await adminGet<AdminPlatformVatSummary>(
    buildPlatformVatSummaryApiHref(filters),
    emptyPlatformVatSummary(filters.period),
  );

  return new NextResponse(buildPlatformVatSummaryCsvContent(summary), {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-platform-vat-${filters.period}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
