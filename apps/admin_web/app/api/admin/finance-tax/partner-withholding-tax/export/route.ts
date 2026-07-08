import { NextRequest, NextResponse } from 'next/server';

import type { AdminPartnerWithholdingTaxRow } from '../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import {
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxRowsCsvContent,
  buildTaxSettlementServerPagination,
  readPartnerWithholdingTaxFilters,
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

  const filters = readPartnerWithholdingTaxFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const rows = await adminGet<AdminPartnerWithholdingTaxRow[]>(buildPartnerWithholdingTaxApiHref(filters), []);
  const storedTotal = rows.length ? Math.max(filters.page * filters.take, rows.length) : 0;
  const csv = buildPartnerWithholdingTaxRowsCsvContent(
    buildTaxSettlementServerPagination(rows, filters, storedTotal).rows,
  );

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': `attachment; filename="hands-partner-withholding-tax-${filters.period}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
