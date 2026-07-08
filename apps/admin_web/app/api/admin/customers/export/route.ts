import { NextRequest, NextResponse } from 'next/server';

import type { AdminCustomer } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { buildCsvContent } from '../../../../../lib/csv-export';
import { buildCustomerDataHrefs, buildCustomerFilters } from '../../../../customers/customer-filters';
import { buildCustomerExportRows, CUSTOMER_EXPORT_COLUMNS } from '../../../../customers/customer-export-rows';
import { buildCustomerRow } from '../../../../customers/customer-list-model';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  const filters = buildCustomerFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const hrefs = buildCustomerDataHrefs(filters);
  const customers = await adminGet<AdminCustomer[]>(hrefs.listHref, []);
  const rows = buildCustomerExportRows(customers.map(buildCustomerRow));
  const csv = buildCsvContent(rows, [...CUSTOMER_EXPORT_COLUMNS]);

  return new NextResponse(csv, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-disposition': 'attachment; filename="hands-customers.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
