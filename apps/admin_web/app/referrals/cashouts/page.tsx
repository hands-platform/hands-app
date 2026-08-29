import type { AdminReferralCashoutQueueRow, AdminReferralCashoutQueueSummary } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import {
  ReferralCashoutQueuePage,
  buildReferralCashoutApiHref,
  buildReferralCashoutFilters,
  buildReferralCashoutPage,
  buildReferralCashoutSummaryApiHref,
  referralCashoutSummaryFallback,
} from '../referral-cashout-queue';

type ReferralCashoutsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReferralCashoutsPage({
  searchParams,
}: {
  readonly searchParams?: ReferralCashoutsPageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = buildReferralCashoutFilters(resolvedSearchParams);
  const currentPage = buildReferralCashoutPage(resolvedSearchParams);
  const [operatorAccess, rowsResult, summaryResult] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGetResult<AdminReferralCashoutQueueRow[]>(buildReferralCashoutApiHref(filters, currentPage), []),
    adminGetResult<AdminReferralCashoutQueueSummary>(
      buildReferralCashoutSummaryApiHref(filters),
      referralCashoutSummaryFallback(),
    ),
  ]);
  return (
    <ReferralCashoutQueuePage
      canReviewTax={hasAdminOperatorCategory(operatorAccess, 'FINANCE_TAX')}
      currentPage={currentPage}
      filters={filters}
      mutationsEnabled={rowsResult.ok && summaryResult.ok}
      partialReadError={
        rowsResult.ok && !summaryResult.ok
          ? 'Cashout summary could not be loaded. Loaded rows are read-only until the summary is available.'
          : undefined
      }
      readError={
        !rowsResult.ok
          ? 'Referral cashout rows could not be loaded. Retry before making a payout decision.'
          : undefined
      }
      rows={rowsResult.data}
      summary={summaryResult.data}
    />
  );
}
