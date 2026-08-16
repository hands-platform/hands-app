import type { AdminReferralCashoutQueueRow, AdminReferralCashoutQueueSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
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
  const [rows, summary] = await Promise.all([
    adminGet<AdminReferralCashoutQueueRow[]>(buildReferralCashoutApiHref(filters, currentPage), []),
    adminGet<AdminReferralCashoutQueueSummary>(
      buildReferralCashoutSummaryApiHref(filters),
      referralCashoutSummaryFallback(),
    ),
  ]);
  return (
    <ReferralCashoutQueuePage
      currentPage={currentPage}
      filters={filters}
      rows={rows}
      summary={summary}
    />
  );
}
