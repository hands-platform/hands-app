import Link from 'next/link';
import { Eye } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import {
  AdminFormControlButton,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
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
  readonly createdAt: string | null;
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
                <StatusBadge key={label} tone="warning">
                  {label}
                </StatusBadge>
              ))}
            </div>
          ) : null
        }
      >
        <div className="booking-date-filter-bar vuexy-review-filter-bar" aria-label="Partner evaluation filters">
          <AdminSegmentedControl
            activeValue={filters.dateRange}
            ariaLabel="Evaluation request date"
            className="vuexy-review-date-buttons"
            options={partnerEvaluationDateButtonOptions.map((option) => ({
              href: buildPartnerCustomerEvaluationListHref(filters, {
                dateFrom: '',
                dateRange: option.value,
                dateTo: '',
              }),
              label: option.label,
              value: option.value,
            }))}
          />
          {filters.dateRange === 'custom' ? (
            <AdminFormShell
              action="/reviews/partner-customer-evaluations"
              className="booking-custom-date-grid vuexy-review-custom-date-grid"
            >
              <input name="q" type="hidden" value={filters.q} />
              <input name="pageSize" type="hidden" value={filters.pageSize} />
              <input name="sort" type="hidden" value={filters.sort} />
              <input name="dateRange" type="hidden" value="custom" />
              <AdminFormDate defaultValue={filters.dateFrom} label="Date from" name="dateFrom" />
              <AdminFormDate defaultValue={filters.dateTo} label="Date to" name="dateTo" />
              <AdminFormControlButton className="button-primary booking-date-apply-button">
                Apply dates
              </AdminFormControlButton>
            </AdminFormShell>
          ) : null}
          <AdminSegmentedControl
            activeValue={filters.sort}
            ariaLabel="Evaluation sort"
            className="vuexy-review-sort-buttons"
            options={partnerEvaluationSortOptions.map((option) => ({
              href: buildPartnerCustomerEvaluationListHref(filters, { sort: option.value }),
              label: option.label,
              value: option.value,
            }))}
          />
          <AdminFormGrid action="/reviews/partner-customer-evaluations" className="vuexy-review-controls">
            <input name="dateRange" type="hidden" value={filters.dateRange} />
            <input name="dateFrom" type="hidden" value={filters.dateFrom} />
            <input name="dateTo" type="hidden" value={filters.dateTo} />
            <input name="sort" type="hidden" value={filters.sort} />
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search Evaluation"
              name="q"
              placeholder="Search Evaluation"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={String(filters.pageSize)}
              label="Rows per page"
              name="pageSize"
              options={partnerEvaluationPageSizeOptions}
            />
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </AdminFormGrid>
        </div>
      </AdminFilterPanel>

      <AdminTablePanel
        className="vuexy-review-card"
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
                    Evaluation submitted <DateTimeText fallback="No date" value={row.createdAt} />
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

        <AdminTablePaginationFooter
          activePage={pagination.page}
          ariaLabel="Partner customer evaluation pages"
          className="vuexy-review-footer"
          from={pagination.from}
          hrefForPage={(page) => buildPartnerCustomerEvaluationListHref(filters, { page })}
          pageLinkClassName="vuexy-review-page-link"
          paginationClassName="vuexy-review-pagination"
          to={pagination.to}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalRows}
        />
      </AdminTablePanel>
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
