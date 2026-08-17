import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AdminReview, AdminReviewSummary } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../lib/admin-session';
import { buildCsvContent } from '../../../lib/csv-export';
import { mapInBatches } from '../../../lib/bounded-parallel';
import {
  REVIEW_EXPORT_COLUMNS,
  buildReviewDataHrefs,
  buildReviewExportRows,
  buildReviewFilters,
  reviewMatchingCount,
} from '../review-page-model';

export const dynamic = 'force-dynamic';
const EXPORT_CONCURRENCY = 4;

export async function GET(request: NextRequest) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { headers: { 'cache-control': 'no-store', pragma: 'no-cache' }, status: access.status },
    );
  }

  const filters = buildReviewFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const summaryHref = buildReviewDataHrefs({ ...filters, page: 1, pageSize: 100 }).summaryHref;
  const summaryResult = await adminGetResult<AdminReviewSummary>(summaryHref, { totalCount: 0 });
  if (!summaryResult.ok) {
    return exportError('Review export summary could not be loaded.', 502);
  }

  const matchingCount = reviewMatchingCount(summaryResult.data, filters.review);
  const pageCount = Math.ceil(Math.max(0, matchingCount) / 100);
  const pageResults = await mapInBatches(
    Array.from({ length: pageCount }, (_, index) => index + 1),
    EXPORT_CONCURRENCY,
    async (page) => {
    const listHref = buildReviewDataHrefs({ ...filters, page, pageSize: 100 }).listHref;
    const pageResult = await adminGetResult<AdminReview[]>(listHref, []);
      return { page, pageResult };
    },
  );
  const failedPage = pageResults.find(({ pageResult }) => !pageResult.ok);
  if (failedPage) {
    return exportError(`Review export failed while loading page ${failedPage.page}.`, 502);
  }
  const reviews = pageResults.flatMap(({ pageResult }) => pageResult.data);

  if (reviews.length !== matchingCount) {
    return exportError(
      `Review export count changed during generation (${reviews.length} of ${matchingCount}). Retry the export.`,
      409,
    );
  }

  const csv = buildCsvContent(buildReviewExportRows(reviews), [...REVIEW_EXPORT_COLUMNS]);
  const generatedDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="hands-customer-reviews-${filters.dateRange}-${generatedDate}.csv"`,
      'content-type': 'text/csv; charset=utf-8',
      pragma: 'no-cache',
    },
  });
}

function exportError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { headers: { 'cache-control': 'no-store', pragma: 'no-cache' }, status },
  );
}
