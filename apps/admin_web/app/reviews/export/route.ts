import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AdminReview } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { buildCsvContent } from '../../../lib/csv-export';
import {
  REVIEW_EXPORT_COLUMNS,
  buildReviewExportRows,
  buildReviewFilters,
  filterReviews,
  sortReviews,
} from '../review-page-model';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filters = buildReviewFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const allReviews = await adminGet<AdminReview[]>('/admin/reviews', []);
  const reviews = filterReviews(sortReviews(allReviews, filters.sort), filters);
  const csv = buildCsvContent(buildReviewExportRows(reviews), [...REVIEW_EXPORT_COLUMNS]);

  return new NextResponse(csv, {
    headers: {
      'content-disposition': 'attachment; filename="hands-customer-reviews.csv"',
      'content-type': 'text/csv; charset=utf-8',
    },
  });
}
