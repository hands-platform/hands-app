import { Eye, Pencil, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';

import { ActionMenu } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { CouponWindowState } from './coupon-page-model';

export type CouponUsageBookingRow = {
  readonly amount: number | null;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly currency: string;
  readonly customerLabel: string;
  readonly discountAmount: number | null;
  readonly discountLabel: string;
  readonly partnerLabel: string;
  readonly paymentLabel: string;
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
  readonly endsAtIso: string;
  readonly id: string;
  readonly lowerCode: string;
  readonly opsHint: string;
  readonly percentValue: string;
  readonly startsAtInputValue: string;
  readonly startsAtIso: string;
  readonly statusClassName: string;
  readonly statusLabel: string;
  readonly usageBookingCount: number;
  readonly usageBookings: readonly CouponUsageBookingRow[];
  readonly usageCountKnown: boolean;
  readonly windowLabel: string;
  readonly windowSignal: string;
  readonly windowState: CouponWindowState;
};

type CouponsTableSectionProps = {
  readonly actionsEnabled?: boolean;
  readonly deleteHrefForCoupon: (couponId: string) => string;
  readonly editHrefForCoupon: (couponId: string) => string;
  readonly listLoaded?: boolean;
  readonly rows: readonly CouponTableRow[];
  readonly toggleHrefForCoupon: (couponId: string) => string;
  readonly usageHrefForCoupon: (couponId: string) => string;
};

const couponHeaders = ['Coupon', 'Discount', 'Checkout window (ICT)', 'Status', 'Usage', 'Actions'];
const usageHeaders = [
  'Booking / request time',
  'Customer',
  'Partner',
  'Services',
  'Payment',
  'Customer paid',
  'Discount',
  'Booking state',
  'Reversal',
];
const COUPON_USAGE_PAGE_SIZE = 10;

export function CouponsTableSection({
  actionsEnabled = true,
  deleteHrefForCoupon,
  editHrefForCoupon,
  listLoaded = true,
  rows,
  toggleHrefForCoupon,
  usageHrefForCoupon,
}: CouponsTableSectionProps) {
  return (
    <AdminSection
      className="coupons-list-section"
      description="Compare checkout availability, campaign windows, and operator actions without opening each coupon."
      statusLabel={listLoaded ? `${rows.length} shown` : 'Unavailable'}
      statusTone={listLoaded ? 'neutral' : 'danger'}
      title="Coupon list"
    >
      {listLoaded ? (
        <AdminTableScroll ariaLabel="Coupon operations table" className="coupon-table-scroll">
          <AdminDataTable
            className="coupon-operations-table"
            emptyMessage="No coupons match the current view and search."
            headers={couponHeaders}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="coupon-table-identity" scope="row">
                  <strong>{row.code}</strong>
                  <span className="muted">{row.description}</span>
                </th>
                <td>
                  <strong>{row.discountLabel}</strong>
                </td>
                <td className="coupon-table-window">
                  <span>{row.windowLabel}</span>
                  <small className="muted">{row.windowSignal}</small>
                </td>
                <td>
                  <div className="coupon-table-status-stack">
                    <StatusBadgeFromPillClass pillClass={row.statusClassName}>
                      {row.statusLabel}
                    </StatusBadgeFromPillClass>
                    <small className="muted">{row.checkoutHint}</small>
                  </div>
                </td>
                <td>
                  <AdminTextLink href={usageHrefForCoupon(row.id)}>
                    <Eye aria-hidden="true" size={14} />
                    {row.usageCountKnown ? `${row.usageBookingCount} bookings` : 'View usage'}
                  </AdminTextLink>
                </td>
                <td>
                  {actionsEnabled ? (
                    <div className="coupon-table-actions">
                      <AdminTextLink href={toggleHrefForCoupon(row.id)}>
                        {row.active ? (
                          <PauseCircle aria-hidden="true" size={14} />
                        ) : (
                          <PlayCircle aria-hidden="true" size={14} />
                        )}
                        {row.active ? 'Pause' : 'Activate'}
                      </AdminTextLink>
                      <AdminTextLink href={editHrefForCoupon(row.id)}>
                        <Pencil aria-hidden="true" size={14} />
                        Edit
                      </AdminTextLink>
                      <ActionMenu
                        actions={[
                          row.usageCountKnown && row.usageBookingCount > 0 ? {
                            description: 'Used coupons are retained for audit. Pause the coupon instead of deleting it.',
                            disabled: true,
                            href: deleteHrefForCoupon(row.id),
                            icon: PauseCircle,
                            kind: 'link',
                            label: 'Pause only · usage retained',
                          } : {
                            description: 'Delete is allowed only when no booking usage exists.',
                            href: deleteHrefForCoupon(row.id),
                            icon: Trash2,
                            kind: 'link',
                            label: 'Delete coupon',
                            tone: 'danger',
                          },
                        ]}
                        label={`More actions for ${row.code}`}
                        managedDropdown
                        title="More actions"
                        variant="dropdown"
                      />
                    </div>
                  ) : (
                    <StatusBadge tone="neutral">Actions unavailable</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState
          framed
          message="Coupon records could not be loaded. Retry before changing campaign state."
          title="Coupon list unavailable"
        />
      )}
    </AdminSection>
  );
}

export function CouponUsageBookingTable({
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
  if (totalCount === 0) {
    return (
      <AdminEmptyState
        framed
        message="No booking or payment evidence is linked to this coupon."
        title="No coupon usage"
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / COUPON_USAGE_PAGE_SIZE));
  const activePage = Math.min(Math.max(1, page), totalPages);
  const pageStartIndex = (activePage - 1) * COUPON_USAGE_PAGE_SIZE;
  const pageFrom = pageStartIndex + 1;
  const pageTo = Math.min(totalCount, pageStartIndex + rows.length);

  return (
    <div className="coupon-usage-list booking-monitor">
      <AdminTableScroll ariaLabel="Coupon booking usage evidence" className="coupon-usage-table-scroll">
        <AdminDataTable
          className="vuexy-booking-table coupon-booking-usage-table"
          emptyMessage={null}
          headers={usageHeaders}
          rowCount={rows.length}
        >
          {rows.map((booking) => (
            <tr key={booking.bookingHref}>
              <td>
                <AdminTextLink href={booking.bookingHref} title="Open booking detail">
                  <Eye aria-hidden="true" size={14} />
                  {booking.bookingLabel}
                </AdminTextLink>
                <div className="muted">{booking.requestTimeLabel}</div>
              </td>
              <td>{booking.customerLabel}</td>
              <td>{booking.partnerLabel}</td>
              <td>{booking.serviceLabel}</td>
              <td>{booking.paymentLabel}</td>
              <td>
                {booking.amount === null ? (
                  <span className="muted">Not recorded</span>
                ) : (
                  <MoneyText amount={booking.amount} currency={booking.currency} />
                )}
              </td>
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
