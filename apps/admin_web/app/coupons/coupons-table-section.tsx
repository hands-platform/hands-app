import Link from 'next/link';
import { CalendarDays, Eye } from 'lucide-react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import type { CouponWindowState } from './coupon-page-model';
import { couponDeleteConfirmHref } from './coupon-action-confirmation';

export type CouponUsageBookingRow = {
  readonly amountLabel: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly customerLabel: string;
  readonly discountLabel: string;
  readonly partnerLabel: string;
  readonly requestTimeLabel: string;
  readonly serviceLabel: string;
  readonly statusLabel: string;
};

export type CouponTableRow = {
  readonly active: boolean;
  readonly checkoutHint: string;
  readonly code: string;
  readonly description: string;
  readonly discountLabel: string;
  readonly endsAtInputValue: string;
  readonly id: string;
  readonly lowerCode: string;
  readonly opsHint: string;
  readonly percentValue: string;
  readonly startsAtInputValue: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
  readonly usageBookings: readonly CouponUsageBookingRow[];
  readonly windowLabel: string;
  readonly windowSignal: string;
  readonly windowState: CouponWindowState;
};

type CouponsTableSectionProps = {
  readonly rows: readonly CouponTableRow[];
  readonly updateAction: (formData: FormData) => Promise<void>;
  readonly usageCouponId?: string;
  readonly usageHrefForPage: (couponId: string, page: number) => string;
  readonly usagePage: number;
};

type CouponSection = {
  readonly className: string;
  readonly description: string;
  readonly rows: readonly CouponTableRow[];
  readonly title: string;
};

const COUPON_USAGE_PAGE_SIZE = 10;
const usageHeaders = ['Request Time', 'Customer', 'Partner', 'Service Type', 'Amount', 'Discount', 'State'];

export function CouponsTableSection({
  rows,
  updateAction,
  usageCouponId,
  usageHrefForPage,
  usagePage,
}: CouponsTableSectionProps) {
  const sections = couponSections(rows);

  return (
    <div className="coupons-management-stack">
      {sections.map((section) => (
        <section
          className={`admin-filter-panel coupons-status-section ${section.className}`}
          key={section.title}
        >
          <AdminSectionHeader
            description={section.description}
            status={<span className="pill">{section.rows.length} coupon(s)</span>}
            title={section.title}
          />
          <div className="coupons-status-section-body">
            {section.rows.length > 0 ? (
              section.rows.map((row) => (
                <CouponManagementCard
                  key={row.id}
                  row={row}
                  updateAction={updateAction}
                  usageHrefForPage={usageHrefForPage}
                  usagePage={usageCouponId === row.id ? usagePage : 1}
                  usageShouldOpen={usageCouponId === row.id}
                />
              ))
            ) : (
              <p className="muted">No coupons in this state.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function CouponManagementCard({
  row,
  updateAction,
  usageHrefForPage,
  usagePage,
  usageShouldOpen,
}: {
  readonly row: CouponTableRow;
  readonly updateAction: (formData: FormData) => Promise<void>;
  readonly usageHrefForPage: (couponId: string, page: number) => string;
  readonly usagePage: number;
  readonly usageShouldOpen: boolean;
}) {
  const usageCount = row.usageBookings.length;

  return (
    <section className={`coupon-management-section coupon-management-section-${row.windowState}`}>
      <div className="coupon-management-section-header">
        <div>
          <div className="coupon-code-line">
            <strong>{row.code}</strong>
            <span className="coupon-window-title">{row.windowLabel}</span>
            <span className={row.statusClassName}>{row.statusLabel}</span>
          </div>
        </div>
        <div className="coupon-discount-summary">
          <strong>{row.discountLabel}</strong>
          <span className="muted">{row.windowSignal}</span>
        </div>
      </div>

      <p className="coupon-window-copy">{row.checkoutHint}</p>

      <div className="coupon-section-footer">
        <span>{usageCount > 0 ? `Used ${usageCount} booking(s)` : 'No recent booking usage'}</span>
        <span>{row.opsHint}</span>
        <Link className="coupon-delete-link" href={couponDeleteConfirmHref(row.id)}>
          Delete
        </Link>
      </div>

      <details className="coupon-section-disclosure">
        <summary>Edit coupon</summary>
        <form action={updateAction} className="coupon-edit-form">
          <input name="couponId" type="hidden" value={row.id} />
          <label>
            <span>Discount %</span>
            <input defaultValue={row.percentValue} max="100" min="1" name="percent" type="number" />
          </label>
          <label>
            <span>Starts</span>
            <span className="coupon-date-input-shell">
              <input defaultValue={row.startsAtInputValue} name="startsAt" type="datetime-local" />
              <CalendarDays aria-hidden="true" size={17} />
            </span>
          </label>
          <label>
            <span>Ends</span>
            <span className="coupon-date-input-shell">
              <input defaultValue={row.endsAtInputValue} name="endsAt" type="datetime-local" />
              <CalendarDays aria-hidden="true" size={17} />
            </span>
          </label>
          <label className="coupon-active-field">
            <span>Active</span>
            <input defaultChecked={row.active} name="active" type="checkbox" />
          </label>
          <button className="button" type="submit">
            Save
          </button>
        </form>
      </details>

      <details className="coupon-section-disclosure" open={usageShouldOpen ? true : undefined}>
        <summary>Booking usage</summary>
        <CouponUsageBookingTable
          hrefForPage={(page) => usageHrefForPage(row.id, page)}
          page={usagePage}
          rows={row.usageBookings}
        />
      </details>
    </section>
  );
}

function CouponUsageBookingTable({
  hrefForPage,
  page,
  rows,
}: {
  readonly hrefForPage: (page: number) => string;
  readonly page: number;
  readonly rows: readonly CouponUsageBookingRow[];
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / COUPON_USAGE_PAGE_SIZE));
  const activePage = Math.min(Math.max(1, page), totalPages);
  const pageStartIndex = (activePage - 1) * COUPON_USAGE_PAGE_SIZE;
  const visibleRows = rows.slice(pageStartIndex, pageStartIndex + COUPON_USAGE_PAGE_SIZE);
  const pageFrom = rows.length === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(rows.length, pageStartIndex + visibleRows.length);

  return (
    <div className="coupon-usage-list booking-monitor">
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table coupon-booking-usage-table"
          emptyMessage="No bookings used this coupon recently."
          headers={usageHeaders}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((booking) => (
            <tr key={booking.bookingHref}>
              <td>
                <div className="vuexy-booking-id-line">
                  <Link className="text-link" href={booking.bookingHref} title="Open booking detail">
                    <Eye aria-hidden="true" size={14} />
                    {booking.bookingLabel}
                  </Link>
                </div>
                <div className="muted">{booking.requestTimeLabel}</div>
              </td>
              <td>{booking.customerLabel}</td>
              <td>{booking.partnerLabel}</td>
              <td>{booking.serviceLabel}</td>
              <td>{booking.amountLabel}</td>
              <td>{booking.discountLabel}</td>
              <td>
                <span className="pill pill-neutral">{booking.statusLabel}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <div className="vuexy-booking-table-footer coupon-usage-table-footer">
        <span>
          Showing {pageFrom} to {pageTo} of {rows.length} entries
        </span>
        <AdminRoundedPagination
          activePage={activePage}
          ariaLabel="Coupon booking usage pages"
          className="vuexy-booking-pagination"
          hrefForPage={hrefForPage}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}

function couponSections(rows: readonly CouponTableRow[]): CouponSection[] {
  return [
    {
      className: 'coupons-status-section-running',
      description: 'Coupons customers can use now during booking checkout.',
      rows: rows.filter((row) => row.active && row.windowState === 'live'),
      title: 'Running Coupons',
    },
    {
      className: 'coupons-status-section-upcoming',
      description: 'Coupons that are active but waiting for their start date.',
      rows: rows.filter((row) => row.active && row.windowState === 'scheduled'),
      title: 'Upcoming Coupons',
    },
    {
      className: 'coupons-status-section-expired',
      description: 'Expired or paused coupons that should stay out of customer checkout.',
      rows: rows.filter((row) => !row.active || row.windowState === 'expired' || row.windowState === 'draft'),
      title: 'Expired Coupons',
    },
  ];
}
