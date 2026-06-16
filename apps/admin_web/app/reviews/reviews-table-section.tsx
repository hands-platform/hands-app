import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  MoreVertical,
  Search,
  Star,
} from 'lucide-react';
import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import type { ReviewFilters, ReviewPagination } from './review-page-model';
import { REVIEW_PAGE_SIZE_OPTIONS, buildReviewListHref } from './review-page-model';

export type ReviewTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly appVisibilityLabel: string;
  readonly bookingLabel: string;
  readonly commentLabel: string;
  readonly createdAtLabel: string;
  readonly customerInitials: string;
  readonly customerLabel: string;
  readonly customerPhone: string;
  readonly id: string;
  readonly partnerHint: string;
  readonly partnerInitials: string;
  readonly partnerLabel: string;
  readonly rating: number;
  readonly ratingLabel: string;
  readonly reportReasonLabel: string;
  readonly serviceLabel: string;
  readonly shortIdLabel: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
  readonly statusMeaning: string;
};

type ReviewsTableSectionProps = {
  readonly csvHref: string;
  readonly emptyMessage: string;
  readonly filters: ReviewFilters;
  readonly pagination: ReviewPagination<ReviewTableRow>;
  readonly rows: readonly ReviewTableRow[];
};

export function ReviewsTableSection({ csvHref, emptyMessage, filters, pagination, rows }: ReviewsTableSectionProps) {
  return (
    <section className="vuexy-review-card" aria-labelledby="customer-review-title">
      <div className="vuexy-review-toolbar">
        <div>
          <h2 id="customer-review-title">Customer Review</h2>
          <p>Customer-written reviews are published by default. Hold a review to remove it from app visibility.</p>
        </div>
        <form action="/reviews" className="vuexy-review-controls">
          <label className="vuexy-review-search">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search Review</span>
            <input defaultValue={filters.q} name="q" placeholder="Search Review" type="search" />
          </label>
          <label className="vuexy-review-select">
            <span className="sr-only">Rows per page</span>
            <select defaultValue={filters.pageSize} name="pageSize">
              {REVIEW_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="vuexy-review-select">
            <span className="sr-only">Review status</span>
            <select defaultValue={filters.review} name="review">
              <option value="">All</option>
              <option value="published">Published</option>
              <option value="held">Held</option>
              <option value="follow-up">Follow-up</option>
              <option value="reported">Reported</option>
            </select>
          </label>
          <button className="vuexy-review-button" type="submit">
            Apply
          </button>
          <a className="vuexy-review-export" download="hands-customer-reviews.csv" href={csvHref}>
            <Download aria-hidden="true" size={16} />
            Export
          </a>
        </form>
      </div>

      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={emptyMessage}
          headers={['', 'Partner', 'Customer', 'Review', 'Date', 'Status', 'Actions']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="vuexy-review-check-cell">
                <input aria-label={`Select review ${row.shortIdLabel}`} type="checkbox" />
              </td>
              <td>
                <div className="vuexy-review-person">
                  <span className="vuexy-review-avatar vuexy-review-avatar-square">{row.partnerInitials}</span>
                  <div>
                    <strong>{row.partnerLabel}</strong>
                    <span>{row.partnerHint}</span>
                  </div>
                </div>
              </td>
              <td>
                <div className="vuexy-review-person">
                  <span className="vuexy-review-avatar">{row.customerInitials}</span>
                  <div>
                    <strong className="vuexy-review-customer">{row.customerLabel}</strong>
                    <span>{row.customerPhone}</span>
                  </div>
                </div>
              </td>
              <td className="vuexy-review-copy-cell">
                <div aria-label={`Rating ${row.ratingLabel}`} className="vuexy-review-stars">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      aria-hidden="true"
                      className={index < row.rating ? 'is-filled' : ''}
                      key={`${row.id}-star-${index}`}
                      size={18}
                    />
                  ))}
                </div>
                <p>{row.commentLabel}</p>
                <span>{row.serviceLabel}</span>
                {row.reportReasonLabel ? <span>{row.reportReasonLabel}</span> : null}
              </td>
              <td className="vuexy-review-date-cell">{row.createdAtLabel}</td>
              <td>
                <span className={row.statusClassName}>{row.statusLabel}</span>
                <small>{row.statusMeaning}</small>
                <small>{row.appVisibilityLabel}</small>
              </td>
              <td>
                <div className="vuexy-review-actions">
                  <MoreVertical aria-hidden="true" size={22} />
                  <ActionMenu actions={row.actions} label={row.actionLabel} />
                </div>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <div className="vuexy-review-footer">
        <span>
          Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
        </span>
        <nav aria-label="Customer review pages" className="vuexy-review-pagination">
          <PaginationControl
            disabled={pagination.page <= 1}
            href={buildReviewListHref(filters, { page: 1 })}
            label="First page"
          >
            <ChevronsLeft size={18} />
          </PaginationControl>
          <PaginationControl
            disabled={pagination.page <= 1}
            href={buildReviewListHref(filters, { page: Math.max(1, pagination.page - 1) })}
            label="Previous page"
          >
            <ChevronLeft size={18} />
          </PaginationControl>
          {visiblePageNumbers(pagination).map((page) => (
            <PaginationControl
              active={page === pagination.page}
              href={buildReviewListHref(filters, { page })}
              key={page}
              label={`Page ${page}`}
            >
              {page}
            </PaginationControl>
          ))}
          <PaginationControl
            disabled={pagination.page >= pagination.totalPages}
            href={buildReviewListHref(filters, { page: Math.min(pagination.totalPages, pagination.page + 1) })}
            label="Next page"
          >
            <ChevronRight size={18} />
          </PaginationControl>
          <PaginationControl
            disabled={pagination.page >= pagination.totalPages}
            href={buildReviewListHref(filters, { page: pagination.totalPages })}
            label="Last page"
          >
            <ChevronsRight size={18} />
          </PaginationControl>
        </nav>
      </div>
    </section>
  );
}

function PaginationControl({
  active = false,
  children,
  disabled = false,
  href,
  label,
}: {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly href: string;
  readonly label: string;
}) {
  const className = active ? 'vuexy-review-page-link is-active' : 'vuexy-review-page-link';

  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className="vuexy-review-page-link is-disabled">
        {children}
      </span>
    );
  }

  return (
    <Link aria-current={active ? 'page' : undefined} aria-label={label} className={className} href={href}>
      {children}
    </Link>
  );
}

function visiblePageNumbers(pagination: ReviewPagination<ReviewTableRow>) {
  const start = Math.max(1, pagination.page - 2);
  const end = Math.min(pagination.totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}
