import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormInput,
} from '../../components/admin-form-controls';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminMiniMetricStrip } from '../../components/admin-overview-card';
import { AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { formatMoney } from '../../lib/admin-format';
import type { CouponTableRow } from './coupons-table-section';
import { CouponUsageBookingTable } from './coupons-table-section';
import { CouponDrawerShell } from './coupon-drawer-shell';

type CouponManagementDrawerProps = {
  readonly closeHref: string;
  readonly hrefForUsagePage: (page: number) => string;
  readonly mode: 'edit' | 'usage';
  readonly mutationsEnabled: boolean;
  readonly returnTo: string;
  readonly row: CouponTableRow | null;
  readonly targetLoaded: boolean;
  readonly updateAction: (formData: FormData) => Promise<void>;
  readonly usageLoaded: boolean;
  readonly usagePage: number;
};

export function CouponManagementDrawer({
  closeHref,
  hrefForUsagePage,
  mode,
  mutationsEnabled,
  returnTo,
  row,
  targetLoaded,
  updateAction,
  usageLoaded,
  usagePage,
}: CouponManagementDrawerProps) {
  const title = mode === 'edit' ? `Edit ${row?.code ?? 'coupon'}` : `${row?.code ?? 'Coupon'} usage`;

  return (
    <CouponDrawerShell
      closeHref={closeHref}
      eyebrow={mode === 'edit' ? 'Campaign configuration' : 'Booking and payment evidence'}
      subtitle={mode === 'edit' ? 'Times are shown and edited in ICT (UTC+7).' : 'Usage is loaded independently from the current coupon list page.'}
      title={title}
      titleId={`coupon-${mode}-drawer-title`}
    >
      {!targetLoaded || !row ? (
        <AdminNoticeCard role="alert" tone="danger">
          <strong>Coupon detail unavailable</strong>
          <p className="muted">The exact coupon could not be loaded. No campaign change is available.</p>
          <AdminFormControlLink className="button-secondary" href={returnTo}>
            Return to coupons
          </AdminFormControlLink>
        </AdminNoticeCard>
      ) : mode === 'edit' ? (
        mutationsEnabled ? (
          <CouponEditForm closeHref={closeHref} returnTo={returnTo} row={row} updateAction={updateAction} />
        ) : (
          <AdminNoticeCard role="alert" tone="danger">
            <strong>Editing unavailable</strong>
            <p className="muted">Coupon list or summary data is unavailable. Retry before changing this campaign.</p>
            <AdminFormControlLink className="button-secondary" href={returnTo}>
              Retry coupons
            </AdminFormControlLink>
          </AdminNoticeCard>
        )
      ) : (
        <CouponUsageWorkspace
          hrefForPage={hrefForUsagePage}
          row={row}
          usageLoaded={usageLoaded}
          usagePage={usagePage}
        />
      )}
    </CouponDrawerShell>
  );
}

function CouponEditForm({
  closeHref,
  returnTo,
  row,
  updateAction,
}: {
  readonly closeHref: string;
  readonly returnTo: string;
  readonly row: CouponTableRow;
  readonly updateAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <>
      <AdminInlineNotice className="coupon-edit-status" tone="info">
        <StatusBadgeFromPillClass pillClass={row.statusClassName}>{row.statusLabel}</StatusBadgeFromPillClass>
        <span>Pause or activate from the list so lifecycle changes always receive a separate confirmation.</span>
      </AdminInlineNotice>
      <AdminDrawerFormGrid action={updateAction} className="coupon-drawer-form admin-mt-16">
        <input name="couponId" type="hidden" value={row.id} />
        <input name="returnTo" type="hidden" value={returnTo} />
        <input name="startsAtOriginal" type="hidden" value={row.startsAtIso} />
        <input name="endsAtOriginal" type="hidden" value={row.endsAtIso} />
        <AdminFormInput
          className="admin-form-control-fluid admin-grid-span-2"
          defaultValue={row.description === '-' ? '' : row.description}
          label="Campaign description"
          labelVisibility="visible"
          maxLength={500}
          name="description"
        />
        <AdminFormInput
          className="admin-form-control-fluid"
          defaultValue={row.percentValue}
          label="Discount percent"
          labelVisibility="visible"
          max="100"
          min="1"
          name="percent"
          required
          type="number"
        />
        <div className="coupon-ict-helper">
          <strong>Checkout status</strong>
          <span className="muted">{row.checkoutHint}</span>
        </div>
        <AdminFormDateTime
          className="admin-form-control-fluid"
          defaultValue={row.startsAtInputValue}
          label="Starts (ICT)"
          labelVisibility="visible"
          name="startsAt"
        />
        <AdminFormDateTime
          className="admin-form-control-fluid"
          defaultValue={row.endsAtInputValue}
          label="Ends (ICT)"
          labelVisibility="visible"
          name="endsAt"
        />
        <AdminFormCheckbox
          className="admin-grid-span-2 coupon-no-end-date"
          defaultChecked={!row.endsAtIso}
          label="No end date"
          name="noEndDate"
        >
          <span>No end date</span>
        </AdminFormCheckbox>
        <AdminDrawerActionFooter className="admin-grid-span-2">
          <AdminFormControlLink className="button-secondary" href={closeHref}>
            Cancel
          </AdminFormControlLink>
          <AdminFormControlButton className="button-primary" type="submit">
            Save configuration
          </AdminFormControlButton>
        </AdminDrawerActionFooter>
      </AdminDrawerFormGrid>
    </>
  );
}

function CouponUsageWorkspace({
  hrefForPage,
  row,
  usageLoaded,
  usagePage,
}: {
  readonly hrefForPage: (page: number) => string;
  readonly row: CouponTableRow;
  readonly usageLoaded: boolean;
  readonly usagePage: number;
}) {
  if (!usageLoaded) {
    return (
      <AdminNoticeCard role="alert" tone="danger">
        <strong>Usage unavailable</strong>
        <p className="muted">Booking and payment evidence could not be loaded. Retry before using this view for campaign decisions.</p>
        <AdminFormControlLink className="button-secondary" href={hrefForPage(usagePage)}>
          Retry usage
        </AdminFormControlLink>
      </AdminNoticeCard>
    );
  }

  if (row.usageBookingCount === 0) {
    return (
      <AdminEmptyState
        framed
        message="No booking or payment evidence is linked to this coupon."
        title="No coupon usage"
      />
    );
  }

  const visiblePaid = row.usageBookings.reduce((sum, booking) => sum + (booking.amount ?? 0), 0);
  const visibleDiscount = row.usageBookings.reduce((sum, booking) => sum + (booking.discountAmount ?? 0), 0);
  const visibleReversed = row.usageBookings.filter((booking) => booking.reversalStatusLabel === 'REVERSED').length;
  const currency = row.usageBookings[0]?.currency ?? 'VND';

  return (
    <>
      <AdminMiniMetricStrip
        ariaLabel={`${row.code} coupon usage summary`}
        className="coupon-usage-summary"
        metrics={[
          { key: 'booking-count', label: 'All linked bookings', value: row.usageBookingCount },
          { key: 'visible-paid', label: 'Customer paid · visible page', value: formatMoney(visiblePaid, currency) },
          { key: 'visible-discount', label: 'Discount · visible page', value: formatMoney(visibleDiscount, currency) },
          { key: 'visible-reversed', label: 'Reversed · visible page', value: visibleReversed },
        ]}
      />
      <CouponUsageBookingTable
        hrefForPage={hrefForPage}
        page={usagePage}
        rows={row.usageBookings}
        totalCount={row.usageBookingCount}
      />
    </>
  );
}
