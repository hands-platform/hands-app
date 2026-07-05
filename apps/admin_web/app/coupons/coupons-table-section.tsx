import Link from 'next/link';
import { Eye } from 'lucide-react';

import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormDateTime,
  AdminFormShell,
  AdminFormInput,
} from '../../components/admin-form-controls';
import { AdminCard, AdminDisclosure } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, type StatusBadgeTone, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
  readonly reversalStatusLabel: string;
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
  readonly usageBookingCount: number;
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
const usageHeaders = ['Request Time', 'Customer', 'Partner', 'Service Type', 'Amount', 'Discount', 'State', 'Reversal'];

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
        <AdminFilterPanel
          className={`coupons-status-section ${section.className}`}
          description={section.description}
          key={section.title}
          resultLabel={`${section.rows.length} coupon(s)`}
          title={section.title}
        >
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
              <AdminEmptyState framed message="No coupons in this state." />
            )}
          </div>
        </AdminFilterPanel>
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
  const usageCount = row.usageBookingCount;

  return (
    <AdminCard className={`coupon-management-section coupon-management-section-${row.windowState}`}>
      <div className="coupon-management-section-header">
        <div>
          <div className="coupon-code-line">
            <strong>{row.code}</strong>
            <span className="coupon-window-title">{row.windowLabel}</span>
            <StatusBadge tone={couponStatusBadgeTone(row.statusClassName)}>{row.statusLabel}</StatusBadge>
          </div>
        </div>
        <div className="coupon-discount-summary">
          <strong>{row.discountLabel}</strong>
          <span className="muted">{row.windowSignal}</span>
        </div>
      </div>

      <p className="coupon-window-copy">{row.checkoutHint}</p>

      <div className="coupon-section-footer">
        <span>{usageCount > 0 ? `Used ${usageCount} booking(s)` : 'Booking usage loads on demand'}</span>
        <span>{row.opsHint}</span>
        <AdminTextLink href={usageHrefForPage(row.id, 1)}>
          View usage
        </AdminTextLink>
        <Link className="coupon-delete-link" href={couponDeleteConfirmHref(row.id)}>
          Delete
        </Link>
      </div>

      <AdminDisclosure className="coupon-section-disclosure">
        <summary>Edit coupon</summary>
        <AdminFormShell action={updateAction} className="coupon-edit-form">
          <input name="couponId" type="hidden" value={row.id} />
          <AdminFormInput defaultValue={row.percentValue} label="Discount %" max="100" min="1" name="percent" type="number" />
          <AdminFormDateTime
            className="admin-form-control-fluid"
            defaultValue={row.startsAtInputValue}
            label="Starts"
            labelVisibility="visible"
            name="startsAt"
          />
          <AdminFormDateTime
            className="admin-form-control-fluid"
            defaultValue={row.endsAtInputValue}
            label="Ends"
            labelVisibility="visible"
            name="endsAt"
          />
          <AdminFormCheckbox
            defaultChecked={row.active}
            label={`${row.code} active`}
            name="active"
          >
            <span>Active</span>
          </AdminFormCheckbox>
          <AdminFormControlButton className="button-primary" type="submit">
            Save
          </AdminFormControlButton>
        </AdminFormShell>
      </AdminDisclosure>

      <AdminDisclosure className="coupon-section-disclosure" open={usageShouldOpen ? true : undefined}>
        <summary>Booking usage</summary>
        <CouponUsageBookingTable
          hrefForPage={(page) => usageHrefForPage(row.id, page)}
          page={usagePage}
          rows={row.usageBookings}
          totalCount={row.usageBookingCount}
        />
      </AdminDisclosure>
    </AdminCard>
  );
}

function couponStatusBadgeTone(className: string): StatusBadgeTone {
  if (className.includes('ok') || className.includes('success')) {
    return 'success';
  }

  return statusBadgeToneFromPillClass(className);
}

function CouponUsageBookingTable({
  hrefForPage,
  page,
  rows,
  totalCount,
}: {
  readonly hrefForPage: (page: number) => string;
  readonly page: number;
  readonly rows: readonly CouponUsageBookingRow[];
  readonly totalCount: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / COUPON_USAGE_PAGE_SIZE));
  const activePage = Math.min(Math.max(1, page), totalPages);
  const pageStartIndex = (activePage - 1) * COUPON_USAGE_PAGE_SIZE;
  const visibleRows = rows;
  const pageFrom = totalCount === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(totalCount, pageStartIndex + visibleRows.length);

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
                  <AdminTextLink href={booking.bookingHref} title="Open booking detail">
                    <Eye aria-hidden="true" size={14} />
                    {booking.bookingLabel}
                  </AdminTextLink>
                </div>
                <div className="muted">{booking.requestTimeLabel}</div>
              </td>
              <td>{booking.customerLabel}</td>
              <td>{booking.partnerLabel}</td>
              <td>{booking.serviceLabel}</td>
              <td>{booking.amountLabel}</td>
              <td>{booking.discountLabel}</td>
              <td>
                <StatusBadge tone="neutral">{booking.statusLabel}</StatusBadge>
              </td>
              <td>
                <StatusBadge tone={booking.reversalStatusLabel === 'REVERSED' ? 'warning' : 'neutral'}>
                  {booking.reversalStatusLabel}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel="Coupon booking usage pages"
        className="coupon-usage-table-footer"
        from={pageFrom}
        hrefForPage={hrefForPage}
        to={pageTo}
        totalPages={totalPages}
        totalRows={totalCount}
      />
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
