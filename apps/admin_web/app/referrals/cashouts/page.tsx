import type { AdminReferralCashoutQueueRow, AdminReferralCashoutQueueSummary, AdminUser } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { buildFinanceApproverOptions } from '../../finance-tax/finance-approver-options';
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
  const needsFinanceApproverDirectory = rows.some((row) => row.status === 'CASHOUT_APPROVED');
  const [currentOperatorAccess, financeApproverUsers] = needsFinanceApproverDirectory
    ? await Promise.all([
        getCurrentAdminOperatorAccess(),
        adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
      ])
    : [null, []];
  const financeApproverOptions = buildFinanceApproverOptions(
    financeApproverUsers,
    currentOperatorAccess?.id ?? null,
  );

  return (
    <ReferralCashoutQueuePage
      currentPage={currentPage}
      filters={filters}
      financeApproverOptions={financeApproverOptions}
      rows={rows}
      summary={summary}
    />
  );
}
