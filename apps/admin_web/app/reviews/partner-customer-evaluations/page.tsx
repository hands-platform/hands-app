import type {
  AdminPartnerCustomerReview,
  AdminPartnerCustomerReviewSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import {
  buildPartnerCustomerReviewDataHrefs,
  buildPartnerCustomerEvaluationFilters,
  buildPartnerCustomerReviewTableRows,
  buildServerReviewPagination,
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
  const dataHrefs = buildPartnerCustomerReviewDataHrefs(filters);
  const [evaluations, summary] = await Promise.all([
    adminGet<AdminPartnerCustomerReview[]>(dataHrefs.listHref, []),
    adminGet<AdminPartnerCustomerReviewSummary>(dataHrefs.summaryHref, { totalCount: 0 }),
  ]);
  const pagination = buildServerReviewPagination(evaluations, filters, summary.totalCount);
  const rows = buildPartnerCustomerReviewTableRows(pagination.rows);
  const rowPagination = { ...pagination, rows };

  return (
    <AdminPageTemplate
      contentClassName="reviews-page booking-monitor"
      description="Internal Partner-written customer evaluations in one operations board. Partners can write text only; no customer-facing star rating is attached."
      metrics={[
        {
          label: 'Total evaluations',
          value: summary.totalCount,
          helper: 'Matching partner-written customer evaluation records.',
          kind: 'record',
          scope: 'All records',
        },
        {
          label: 'Admin-only',
          value: 'Internal',
          helper: 'These records stay in the admin workspace only.',
          kind: 'record',
          scope: 'Admin-only records',
        },
        {
          label: 'Rating fields',
          value: 'None',
          helper: 'Partners write text only; customers do not receive star ratings here.',
          kind: 'record',
          scope: 'Policy guard',
        },
      ]}
      title="Partner Customer Evaluations"
    >
      <PartnerCustomerEvaluationsSection
        filters={filters}
        pagination={rowPagination}
        rows={rows}
        totalEvaluationCount={summary.totalCount}
      />
    </AdminPageTemplate>
  );
}
