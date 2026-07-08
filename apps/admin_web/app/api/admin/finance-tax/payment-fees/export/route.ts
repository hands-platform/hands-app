import { NextRequest, NextResponse } from 'next/server';

import type { AdminPaymentFeeSummary } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildPaymentFeeSummaryApiHref,
  buildPaymentFeeSummaryCsvContent,
  emptyPaymentFeeSummary,
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
  const summary = await adminGet<AdminPaymentFeeSummary>(
    buildPaymentFeeSummaryApiHref(filters),
    emptyPaymentFeeSummary(filters.period),
  );

  return new NextResponse(buildPaymentFeeSummaryCsvContent(summary), {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-payment-fees-${filters.period}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
