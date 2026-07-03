import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AdminReview } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../lib/admin-session';
import { buildCsvContent } from '../../../lib/csv-export';
import {
  REVIEW_EXPORT_COLUMNS,
  buildReviewDataHrefs,
  buildReviewExportRows,
  buildReviewFilters,
} from '../review-page-model';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { headers: { 'cache-control': 'no-store', pragma: 'no-cache' }, status: access.status },
    );
  }

  const filters = buildReviewFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const dataHrefs = buildReviewDataHrefs({ ...filters, page: 1, pageSize: 100 });
  const reviews = await adminGet<AdminReview[]>(dataHrefs.listHref, []);
  const csv = buildCsvContent(buildReviewExportRows(reviews), [...REVIEW_EXPORT_COLUMNS]);

  return new NextResponse(csv, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="hands-customer-reviews.csv"',
      'content-type': 'text/csv; charset=utf-8',
      pragma: 'no-cache',
    },
  });
}
