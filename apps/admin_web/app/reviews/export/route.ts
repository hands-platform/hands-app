import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AdminReview } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { buildCsvContent } from '../../../lib/csv-export';
import {
  REVIEW_EXPORT_COLUMNS,
  buildReviewDataHrefs,
  buildReviewExportRows,
  buildReviewFilters,
} from '../review-page-model';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filters = buildReviewFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const dataHrefs = buildReviewDataHrefs({ ...filters, page: 1, pageSize: 100 });
  const reviews = await adminGet<AdminReview[]>(dataHrefs.listHref, []);
  const csv = buildCsvContent(buildReviewExportRows(reviews), [...REVIEW_EXPORT_COLUMNS]);

  return new NextResponse(csv, {
    headers: {
      'content-disposition': 'attachment; filename="hands-customer-reviews.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
