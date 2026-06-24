import Link from 'next/link';
import { Eye } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import {
  REVIEW_DATE_RANGE_OPTIONS,
  REVIEW_PAGE_SIZE_OPTIONS,
  buildPartnerCustomerEvaluationListHref,
  reviewDateRangeLabel,
} from './review-page-model';

export type PartnerCustomerEvaluationTableRow = {
  readonly bookingHref: string | null;
  readonly bookingLabel: string;
  readonly bookingRequestTimeLabel: string;
  readonly commentLabel: string;
  readonly createdAtLabel: string;
  readonly customerAvatarStatus: AdminAvatarStatus;
  readonly customerHref: string | null;
  readonly customerInitials: string;
  readonly customerLabel: string;
  readonly customerPhone: string;
  readonly id: string;
  readonly partnerAvatarStatus: AdminAvatarStatus;
  readonly partnerHref: string | null;
  readonly partnerHint: string;
  readonly partnerInitials: string;
  readonly partnerLabel: string;
  readonly serviceLabel: string;
};

type PartnerCustomerEvaluationsSectionProps = {
  readonly filters: ReviewFilters;
  readonly pagination: ReviewPagination<PartnerCustomerEvaluationTableRow>;
  readonly rows: readonly PartnerCustomerEvaluationTableRow[];
  readonly totalEvaluationCount: number;
};

export function PartnerCustomerEvaluationsSection({
  filters,
  pagination,
  rows,
  totalEvaluationCount,
}: PartnerCustomerEvaluationsSectionProps) {
  const activeFilterLabels = partnerEvaluationActiveFilterLabels(filters);

  return (
    <>
      <AdminFilterPanel
        className="booking-monitor-filter-panel vuexy-review-filter-card admin-mb-16"
        description="Partner-written customer evaluations are internal admin records. Partners can write text only, without customer-facing star ratings."
        id="partner-customer-evaluation-controls"
        resultLabel={`Showing ${pagination.totalRows} of ${totalEvaluationCount}`}
        resultTone={activeFilterLabels.length > 0 ? 'warning' : 'info'}
        title="Partner customer evaluation filters"
        footer={
          activeFilterLabels.length > 0 ? (
            <div className="vuexy-review-filter-summary">
              {activeFilterLabels.map((label) => (
                <span className="pill pill-warn" key={label}>
                  {label}
                </span>
              ))}
            </div>
          ) : null
        }
      >
        <div className="booking-date-filter-bar vuexy-review-filter-bar" aria-label="Partner evaluation filters">
          <div
            className="booking-date-filter-buttons vuexy-review-date-buttons"
            role="group"
            aria-label="Evaluation request date"
          >
            {partnerEvaluationDateButtonOptions.map((option) => (
              <a
                key={option.value}
                aria-current={filters.dateRange === option.value ? 'page' : undefined}
                className={filters.dateRange === option.value ? 'is-active' : undefined}
                href={buildPartnerCustomerEvaluationListHref(filters, {
                  dateFrom: '',
                  dateRange: option.value,
                  dateTo: '',
                })}
              >
                {option.label}
              </a>
            ))}
          </div>
          {filters.dateRange === 'custom' ? (
            <form
              action="/reviews/partner-customer-evaluations"
              className="booking-custom-date-grid vuexy-review-custom-date-grid"
            >
              <input name="q" type="hidden" value={filters.q} />
              <input name="pageSize" type="hidden" value={filters.pageSize} />
              <input name="sort" type="hidden" value={filters.sort} />
              <input name="dateRange" type="hidden" value="custom" />
              <AdminFormDate defaultValue={filters.dateFrom} label="Date from" name="dateFrom" />
              <AdminFormDate defaultValue={filters.dateTo} label="Date to" name="dateTo" />
              <button className="booking-date-apply-button" type="submit">
                Apply dates
              </button>
            </form>
          ) : null}
          <div
            className="booking-date-filter-buttons vuexy-review-sort-buttons"
            role="group"
            aria-label="Evaluation sort"
          >
            {partnerEvaluationSortOptions.map((option) => (
              <a
                key={option.value}
                aria-current={filters.sort === option.value ? 'page' : undefined}
                className={filters.sort === option.value ? 'is-active' : undefined}
                href={buildPartnerCustomerEvaluationListHref(filters, { sort: option.value })}
              >
                {option.label}
              </a>
            ))}
          </div>
          <form action="/reviews/partner-customer-evaluations" className="vuexy-review-controls">
            <input name="dateRange" type="hidden" value={filters.dateRange} />
            <input name="dateFrom" type="hidden" value={filters.dateFrom} />
            <input name="dateTo" type="hidden" value={filters.dateTo} />
            <input name="sort" type="hidden" value={filters.sort} />
            <AdminFormSearch
              className="vuexy-review-search"
              defaultValue={filters.q}
              label="Search Evaluation"
              name="q"
              placeholder="Search Evaluation"
            />
            <AdminFormSelect
              className="vuexy-review-select"
              defaultValue={String(filters.pageSize)}
              label="Rows per page"
              name="pageSize"
              options={partnerEvaluationPageSizeOptions}
            />
            <AdminFormControlButton className="vuexy-review-button">Apply</AdminFormControlButton>
          </form>
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-review-card"
        description="Text-only notes Partners write about customers after a booking. This page is for admin review only."
        id="partner-customer-evaluation-table"
        resultLabel={`${pagination.totalRows} evaluation(s)`}
        resultTone={rows.length > 0 ? 'info' : 'neutral'}
        title="Partner customer evaluations"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table vuexy-review-table vuexy-partner-evaluation-table"
            emptyMessage="No partner-written customer evaluations loaded."
            headers={['Request Time', 'Partner', 'Customer', 'Customer evaluation']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="vuexy-booking-id-line">
                    {row.bookingHref ? (
                      <Link className="text-link" href={row.bookingHref} title="Open booking detail">
                        <Eye aria-hidden="true" size={14} />
                        {row.bookingLabel}
                      </Link>
                    ) : (
                      <span className="muted">{row.bookingLabel}</span>
                    )}
                  </div>
                  <div className="muted">{row.bookingRequestTimeLabel}</div>
                  <div className="muted vuexy-review-submitted-line">
                    Evaluation submitted {row.createdAtLabel}
                  </div>
                </td>
                <td>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar is-partner"
                    avatarStatus={row.partnerAvatarStatus}
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={row.partnerHint}
                    href={row.partnerHref}
                    initials={row.partnerInitials}
                    label={row.partnerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td>
                  <AdminPersonCell
                    avatarClassName="vuexy-booking-avatar"
                    avatarStatus={row.customerAvatarStatus}
                    className="vuexy-booking-person"
                    copyClassName="vuexy-booking-person-copy"
                    helper={row.customerPhone}
                    href={row.customerHref}
                    initials={row.customerInitials}
                    label={row.customerLabel}
                    linkClassName="vuexy-booking-person-link"
                  />
                </td>
                <td className="vuexy-review-copy-cell">
                  <p>{row.commentLabel}</p>
                  <span>{row.serviceLabel}</span>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>

        <div className="vuexy-booking-table-footer vuexy-review-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="Partner customer evaluation pages"
            className="vuexy-review-pagination"
            hrefForPage={(page) => buildPartnerCustomerEvaluationListHref(filters, { page })}
            pageLinkClassName="vuexy-review-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </>
  );
}

function partnerEvaluationActiveFilterLabels(filters: ReviewFilters) {
  const labels: string[] = [];
  if (filters.q) {
    labels.push(`Search: ${filters.q}`);
  }
  const dateRange = reviewDateRangeLabel(filters);
  if (dateRange) {
    labels.push(dateRange);
  }
  if (filters.sort === 'oldest') {
    labels.push('Sort: Oldest request');
  }
  return labels;
}

const partnerEvaluationPageSizeOptions = REVIEW_PAGE_SIZE_OPTIONS.map((option) => ({
  label: String(option),
  value: String(option),
}));

const partnerEvaluationDateButtonOptions = REVIEW_DATE_RANGE_OPTIONS.filter((option) => option.value !== 'all');

const partnerEvaluationSortOptions = [
  { value: 'newest', label: 'Newest request' },
  { value: 'oldest', label: 'Oldest request' },
] as const;
