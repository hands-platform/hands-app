import type { AdminPartnerCustomerReview } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import {
  buildPartnerCustomerEvaluationFilters,
  buildPartnerCustomerReviewTableRows,
  filterPartnerCustomerReviews,
  paginateReviewRows,
  sortPartnerCustomerReviews,
} from '../review-page-model';
import { PartnerCustomerEvaluationsSection } from '../partner-customer-evaluations-section';

type PartnerCustomerEvaluationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PartnerCustomerEvaluationsPage({
  searchParams,
}: {
  searchParams?: PartnerCustomerEvaluationsPageSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = buildPartnerCustomerEvaluationFilters(params);
  const allEvaluations = await adminGet<AdminPartnerCustomerReview[]>('/admin/partner-customer-reviews', []);
  const evaluations = filterPartnerCustomerReviews(sortPartnerCustomerReviews(allEvaluations, filters.sort), filters);
  const pagination = paginateReviewRows(evaluations, filters);
  const rows = buildPartnerCustomerReviewTableRows(pagination.rows);
  const rowPagination = { ...pagination, rows };

  return (
    <AdminPageTemplate
      contentClassName="reviews-page booking-monitor"
      description="Internal Partner-written customer evaluations in one operations board. Partners can write text only; no customer-facing star rating is attached."
      metrics={[
        {
          label: 'Total evaluations',
          value: allEvaluations.length,
          helper: 'Partner-written customer evaluation records loaded.',
        },
        {
          label: 'Admin-only',
          value: 'Internal',
          helper: 'These records stay in the admin workspace only.',
        },
        {
          label: 'Rating fields',
          value: 'None',
          helper: 'Partners write text only; customers do not receive star ratings here.',
        },
      ]}
      title="Partner Customer Evaluations"
    >
      <PartnerCustomerEvaluationsSection
        filters={filters}
        pagination={rowPagination}
        rows={rows}
        totalEvaluationCount={allEvaluations.length}
      />
    </AdminPageTemplate>
  );
}
