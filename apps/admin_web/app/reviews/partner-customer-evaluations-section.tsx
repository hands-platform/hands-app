import { Fragment, type ReactNode } from 'react';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminDetails } from '../../components/admin-details';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import type { AdminPartnerCustomerReviewSummary } from '../../lib/admin-api';
import {
  AdminFormControlButton,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../components/admin-form-controls';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminNoticeCard } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { partnerNoteModerationConfirmHref } from './partner-customer-note-action-confirmation';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import {
  REVIEW_DATE_RANGE_OPTIONS,
  REVIEW_PAGE_SIZE_OPTIONS,
  buildPartnerCustomerEvaluationListHref,
} from './review-page-model';

export type PartnerCustomerEvaluationTableRow = {
  readonly bookingHref: string | null;
  readonly bookingLabel: string;
  readonly bookingRequestTimeLabel: string;
  readonly commentLabel: string;
  readonly createdAt: string | null;
  readonly customerHref: string | null;
  readonly customerLabel: string;
  readonly id: string;
  readonly isDefaultRetained: boolean;
  readonly lastReviewedAt: string | null;
  readonly lastReviewedBy: string;
  readonly lastReviewReason: string;
  readonly partnerHref: string | null;
  readonly partnerLabel: string;
  readonly reportReasonLabel: string;
  readonly serviceLabel: string;
  readonly status: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
};

type PartnerCustomerEvaluationsSectionProps = {
  readonly dateError: string;
  readonly filters: ReviewFilters;
  readonly pagination: ReviewPagination<PartnerCustomerEvaluationTableRow>;
  readonly returnTo: string;
  readonly rows: readonly PartnerCustomerEvaluationTableRow[];
  readonly summary: AdminPartnerCustomerReviewSummary;
};

export function PartnerCustomerEvaluationsSection({
  dateError,
  filters,
  pagination,
  returnTo,
  rows,
  summary,
}: PartnerCustomerEvaluationsSectionProps) {
  const filtersActive = partnerNoteFiltersActive(filters);

  return (
    <>
      {dateError ? null : <PartnerNoteSummary filters={filters} summary={summary} />}

      <AdminFilterPanel
        actions={
          filtersActive ? (
            <AdminTextLink href="/reviews/partner-customer-evaluations">Clear filters</AdminTextLink>
          ) : null
        }
        className="vuexy-review-filter-card admin-mb-16"
        description="Search immutable internal notes by submitted date, state, customer, Partner, or booking."
        id="partner-note-search"
        title="Partner note search"
      >
        <div className="partner-note-filter-grid" aria-label="Partner note filters">
          <div className="reviews-filter-group partner-note-date-group">
            <strong>Submitted date</strong>
            <AdminSegmentedControl
              activeValue={filters.dateRange}
              ariaLabel="Submitted date"
              className="vuexy-review-date-buttons"
              options={REVIEW_DATE_RANGE_OPTIONS.filter((option) => option.value !== 'custom').map(
                (option) => ({
                  href: buildPartnerCustomerEvaluationListHref(filters, {
                    dateFrom: '',
                    dateRange: option.value,
                    dateTo: '',
                  }),
                  label: option.label,
                  value: option.value,
                }),
              )}
            />
          </div>

          <AdminDetails
            className="partner-note-custom-dates"
            name="partner-note-custom-dates"
            open={filters.dateRange === 'custom' || undefined}
          >
            <summary>Custom dates</summary>
            <AdminFormShell
              action="/reviews/partner-customer-evaluations"
              className="booking-custom-date-grid vuexy-review-custom-date-grid"
            >
              <input name="q" type="hidden" value={filters.q} />
              <input name="pageSize" type="hidden" value={filters.pageSize} />
              <input name="sort" type="hidden" value={filters.sort} />
              <input name="status" type="hidden" value={filters.review} />
              <input name="dateRange" type="hidden" value="custom" />
              <AdminFormDate
                defaultValue={filters.dateFrom}
                label="From"
                labelVisibility="visible"
                name="dateFrom"
              />
              <AdminFormDate
                defaultValue={filters.dateTo}
                label="To"
                labelVisibility="visible"
                name="dateTo"
              />
              <AdminFormControlButton className="button-primary booking-date-apply-button">
                Apply dates
              </AdminFormControlButton>
            </AdminFormShell>
          </AdminDetails>

          <div className="reviews-filter-group partner-note-sort-group">
            <strong>Sort</strong>
            <AdminSegmentedControl
              activeValue={filters.sort}
              ariaLabel="Submitted date sort"
              className="vuexy-review-sort-buttons"
              options={partnerNoteSortOptions.map((option) => ({
                href: buildPartnerCustomerEvaluationListHref(filters, { sort: option.value }),
                label: option.label,
                value: option.value,
              }))}
            />
          </div>

          <AdminFormGrid
            action="/reviews/partner-customer-evaluations"
            className="partner-note-search-controls"
          >
            <input name="dateRange" type="hidden" value={filters.dateRange} />
            <input name="dateFrom" type="hidden" value={filters.dateFrom} />
            <input name="dateTo" type="hidden" value={filters.dateTo} />
            <input name="sort" type="hidden" value={filters.sort} />
            <input name="status" type="hidden" value={filters.review} />
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search"
              labelVisibility="visible"
              name="q"
              placeholder="Search note, customer, Partner, or booking"
            />
            <AdminFormSelect
              className="admin-directory-filter-select"
              defaultValue={String(filters.pageSize)}
              label="Rows"
              labelVisibility="visible"
              name="pageSize"
              options={partnerNotePageSizeOptions}
            />
            <AdminFormControlButton className="admin-directory-filter-button">Apply</AdminFormControlButton>
          </AdminFormGrid>
        </div>

        {dateError ? (
          <AdminNoticeCard role="alert" tone="danger">
            <strong>Submitted date is invalid</strong>
            <p>{dateError}</p>
          </AdminNoticeCard>
        ) : null}
      </AdminFilterPanel>

      {dateError ? null : (
        <AdminTablePanel
          className="vuexy-review-card partner-notes-table-panel"
          description="Immutable Partner notes with customer, Partner, booking, and review-state evidence."
          id="partner-notes-table"
          resultLabel={naturalNoteCount(pagination.totalRows)}
          resultTone={rows.length > 0 ? 'info' : 'neutral'}
          title="Partner notes"
        >
          <AdminTableScroll ariaLabel="Partner notes table" className="partner-notes-table-scroll">
            <AdminDataTable
              className="partner-notes-table"
              emptyMessage={partnerNoteEmptyMessage(filters, filtersActive)}
              headers={['Submitted', 'Partner note', 'Context', 'Note state']}
              rowCount={rows.length}
            >
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr id={`partner-note-${row.id}`} tabIndex={-1}>
                    <td data-label="Submitted">
                      <DateTimeText fallback="No submitted date" value={row.createdAt} />
                    </td>
                    <td className="partner-note-copy-cell" data-label="Partner note">
                      <p className="partner-note-preview">{row.commentLabel}</p>
                    </td>
                    <td data-label="Context">
                      <div className="partner-note-context-cell">
                        <span>
                          <small>Customer</small>
                          {entityLink(row.customerHref, row.customerLabel)}
                        </span>
                        <span>
                          <small>Partner</small>
                          {entityLink(row.partnerHref, row.partnerLabel)}
                        </span>
                        <span>
                          <small>Booking</small>
                          {entityLink(row.bookingHref, row.bookingLabel)}
                        </span>
                        <span>
                          <small>Service</small>
                          {row.serviceLabel}
                        </span>
                      </div>
                    </td>
                    <td data-label="Note state">
                      <div className="partner-note-state-cell">
                        <span className={row.statusClassName}>{row.statusLabel}</span>
                        {row.isDefaultRetained ? <small>Default state</small> : null}
                        {row.reportReasonLabel ? <small>Reason: {row.reportReasonLabel}</small> : null}
                        <small className="partner-note-review-metadata">
                          {row.lastReviewedAt ? (
                            <>
                              Reviewed <DateTimeText value={row.lastReviewedAt} /> · {row.lastReviewedBy}
                            </>
                          ) : (
                            'Not manually reviewed'
                          )}
                        </small>
                        <ActionMenu
                          actions={partnerNoteModerationActions(row, returnTo)}
                          className="partner-note-action-menu-root"
                          label={`Actions for Partner note ${row.id}`}
                          managedDropdown
                          menuClassName="partner-note-action-menu"
                          title="Change note state"
                          variant="dropdown"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="partner-note-detail-row">
                    <td colSpan={4}>
                      <AdminDetails className="partner-note-details" name={`partner-note-detail-${row.id}`}>
                        <summary>View full note and context</summary>
                        <div className="partner-note-detail-panel">
                          <section>
                            <h3>Full immutable note</h3>
                            <blockquote>{row.commentLabel}</blockquote>
                          </section>
                          <section>
                            <h3>Context</h3>
                            <dl>
                              <div>
                                <dt>Customer</dt>
                                <dd>{entityLink(row.customerHref, row.customerLabel)}</dd>
                              </div>
                              <div>
                                <dt>Partner</dt>
                                <dd>{entityLink(row.partnerHref, row.partnerLabel)}</dd>
                              </div>
                              <div>
                                <dt>Booking</dt>
                                <dd>{entityLink(row.bookingHref, row.bookingLabel)}</dd>
                              </div>
                              <div>
                                <dt>Service</dt>
                                <dd>{row.serviceLabel}</dd>
                              </div>
                              <div>
                                <dt>Submitted</dt>
                                <dd>
                                  <DateTimeText fallback="No submitted date" value={row.createdAt} />
                                </dd>
                              </div>
                              <div>
                                <dt>Booking requested</dt>
                                <dd>{row.bookingRequestTimeLabel}</dd>
                              </div>
                            </dl>
                          </section>
                          <section>
                            <h3>Moderation</h3>
                            <dl>
                              <div>
                                <dt>Current state</dt>
                                <dd>{row.statusLabel}</dd>
                              </div>
                              <div>
                                <dt>Active reason</dt>
                                <dd>{row.reportReasonLabel || 'No active reason'}</dd>
                              </div>
                              <div>
                                <dt>Reviewed</dt>
                                <dd>
                                  {row.lastReviewedAt ? (
                                    <>
                                      <DateTimeText value={row.lastReviewedAt} /> · {row.lastReviewedBy}
                                    </>
                                  ) : (
                                    'No moderation audit recorded'
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt>Last reason</dt>
                                <dd>{row.lastReviewReason}</dd>
                              </div>
                            </dl>
                            <AdminTextLink
                              href={`/audit-log?q=${encodeURIComponent(`provider_customer_review:${row.id}`)}`}
                            >
                              View moderation history
                            </AdminTextLink>
                          </section>
                        </div>
                      </AdminDetails>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </AdminDataTable>
          </AdminTableScroll>

          <AdminTablePaginationFooter
            activePage={pagination.page}
            ariaLabel="Partner note pages"
            className="vuexy-review-footer"
            from={pagination.from}
            hrefForPage={(page) => buildPartnerCustomerEvaluationListHref(filters, { page })}
            itemLabel="notes"
            pageLinkClassName="vuexy-review-page-link"
            paginationClassName="vuexy-review-pagination"
            to={pagination.to}
            totalPages={pagination.totalPages}
            totalRows={pagination.totalRows}
          />
        </AdminTablePanel>
      )}
    </>
  );
}

function PartnerNoteSummary({
  filters,
  summary,
}: {
  readonly filters: ReviewFilters;
  readonly summary: AdminPartnerCustomerReviewSummary;
}) {
  const items = [
    { label: 'Total', status: '', value: summary.totalCount },
    { label: 'Needs review', status: 'needs-review', value: summary.needsReview },
    { label: 'Restricted', status: 'restricted', value: summary.restricted },
    { label: 'Retained', status: 'retained', value: summary.retained },
  ];

  return (
    <nav aria-label="Partner note summary and state filters" className="partner-note-summary-strip">
      {items.map((item) => (
        <AdminTextLink
          aria-current={filters.review === item.status ? 'page' : undefined}
          className={filters.review === item.status ? 'is-active' : undefined}
          href={buildPartnerCustomerEvaluationListHref(filters, { review: item.status })}
          key={item.label}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </AdminTextLink>
      ))}
    </nav>
  );
}

function partnerNoteModerationActions(
  row: PartnerCustomerEvaluationTableRow,
  returnTo: string,
): readonly ActionMenuItem[] {
  const actions = [
    { label: 'Retain', status: 'PUBLISHED' as const },
    { label: 'Send to Needs review', status: 'REPORTED' as const },
    { label: 'Restrict', status: 'HIDDEN' as const },
  ];

  return actions
    .filter((action) => action.status !== row.status)
    .map((action) => ({
      href: partnerNoteModerationConfirmHref(row.id, action.status, returnTo),
      kind: 'link' as const,
      label: action.label,
    }));
}

function entityLink(href: string | null, label: string): ReactNode {
  return href ? <AdminTextLink href={href}>{label}</AdminTextLink> : <span>{label}</span>;
}

function partnerNoteEmptyMessage(filters: ReviewFilters, filtersActive: boolean) {
  const message =
    filters.q || filters.review
      ? 'No Partner notes match the current filters.'
      : 'No Partner notes were submitted in this period.';

  return (
    <>
      <strong>{message}</strong>
      {filtersActive ? (
        <AdminTextLink href="/reviews/partner-customer-evaluations">Clear filters</AdminTextLink>
      ) : null}
    </>
  );
}

function partnerNoteFiltersActive(filters: ReviewFilters) {
  return Boolean(
    filters.q ||
    filters.review ||
    filters.dateRange !== 'all' ||
    filters.sort !== 'newest' ||
    filters.pageSize !== 10,
  );
}

function naturalNoteCount(value: number) {
  return `${value} ${value === 1 ? 'note' : 'notes'}`;
}

const partnerNotePageSizeOptions = REVIEW_PAGE_SIZE_OPTIONS.map((option) => ({
  label: String(option),
  value: String(option),
}));

const partnerNoteSortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;
