import type { AdminCoupon, AdminCouponSummary, AdminCouponUsagePage } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import {
  AdminFormDateTime,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import {
  buildCouponDeleteConfirmation,
  buildCouponToggleConfirmation,
  type CouponToggleConfirmation,
} from './coupon-action-confirmation';
import { CouponsTableSection } from './coupons-table-section';
import { createCoupon, deleteCoupon, toggleCoupon, updateCoupon } from './actions';
import { buildCouponCreateNotice, buildCouponPageModel } from './coupon-page-model';

type CouponsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type ConfirmationHiddenInput = { readonly name: string; readonly value: boolean | number | string };
const COUPON_LIST_PAGE_SIZE = 10;
const COUPON_USAGE_PAGE_SIZE = 10;
const EMPTY_COUPON_SUMMARY: AdminCouponSummary = {
  expiredCount: 0,
  liveCount: 0,
  pausedCount: 0,
  scheduledCount: 0,
  totalCount: 0,
};

export default async function CouponsPage({ searchParams }: { searchParams?: CouponsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const createNotice = buildCouponCreateNotice({
    created: readSingleParam(params.created),
    failed: readSingleParam(params.failed),
    notice: readSingleParam(params.couponNotice),
  });
  const confirmAction = readSingleParam(params.confirm);
  const usageCouponId = readSingleParam(params.usageCouponId);
  const couponPage = readPositiveInteger(readSingleParam(params.couponPage));
  const couponSkip = (couponPage - 1) * COUPON_LIST_PAGE_SIZE;
  const usagePage = readPositiveInteger(readSingleParam(params.usagePage));
  const usageSkip = (usagePage - 1) * COUPON_USAGE_PAGE_SIZE;
  const couponListParams = new URLSearchParams({ take: String(COUPON_LIST_PAGE_SIZE) });
  if (couponSkip > 0) {
    couponListParams.set('skip', String(couponSkip));
  }
  const [coupons, couponSummary, usagePageResult] = await Promise.all([
    adminGet<AdminCoupon[]>(`/admin/coupons?${couponListParams.toString()}`, []),
    adminGet<AdminCouponSummary>('/admin/coupons/summary', EMPTY_COUPON_SUMMARY),
    usageCouponId
      ? adminGet<AdminCouponUsagePage>(
          `/admin/coupons/${encodeURIComponent(usageCouponId)}/usage?take=${COUPON_USAGE_PAGE_SIZE}&skip=${usageSkip}`,
          emptyCouponUsagePage(usageCouponId, usagePage),
        )
      : Promise.resolve<AdminCouponUsagePage | null>(null),
  ]);
  const couponModel = buildCouponPageModel(withCouponUsagePage(coupons, usagePageResult));
  const usageSearchParams = couponUsageSearchParams(params);
  const couponListSearchParams = couponListSearchParamsWithoutPaging(params);
  const couponTotalPages = Math.max(1, Math.ceil(couponSummary.totalCount / COUPON_LIST_PAGE_SIZE));
  const confirmation =
    confirmAction === 'toggle'
      ? buildCouponToggleConfirmation(couponModel.orderedCoupons, readSingleParam(params.couponId))
      : confirmAction === 'delete'
        ? buildCouponDeleteConfirmation(couponModel.orderedCoupons, readSingleParam(params.couponId))
      : null;
  const confirmationAction = confirmAction === 'delete' ? deleteCoupon : toggleCoupon;
  const confirmationInputs: ConfirmationHiddenInput[] =
    confirmation && isCouponToggleConfirmation(confirmation)
      ? [
          { name: 'couponId', value: confirmation.couponId },
          { name: 'active', value: confirmation.currentActive },
        ]
      : confirmation
        ? [{ name: 'couponId', value: confirmation.couponId }]
        : [];

  return (
    <AdminPageTemplate
      contentClassName="coupons-page"
      description="Coupon registration, active windows, discount control, and booking usage review."
      title="Coupons"
    >
      {confirmation ? (
        <ConfirmDialog
          action={confirmationAction}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmationInputs}
          id={`coupon-${confirmAction}-${confirmation.couponId}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <AdminFilterPanel
        className="coupons-create-panel"
        resultLabel={`${couponSummary.liveCount} running / ${couponSummary.scheduledCount} upcoming / ${
          couponSummary.expiredCount + couponSummary.pausedCount
        } expired`}
        resultTone="info"
        title="Create coupons"
      >
        {createNotice ? (
          <AdminInlineNotice className="coupon-create-notice" role="status" tone={createNotice.tone}>
            <strong>{createNotice.title}</strong>
            <span>{createNotice.detail}</span>
          </AdminInlineNotice>
        ) : null}
        <form className="coupon-create-form" action={createCoupon}>
          <AdminFormTextarea
            className="coupon-create-form-field coupon-create-form-field-wide"
            label="Coupon codes"
            name="codes"
            required
            rows={1}
          />
          <AdminFormInput
            className="coupon-create-form-field"
            label="Discount %"
            max="100"
            min="1"
            name="percent"
            placeholder="10"
            required
            type="number"
          />
          <AdminFormDateTime
            className="admin-date-filter-field"
            label="Starts"
            labelVisibility="visible"
            name="startsAt"
          />
          <AdminFormDateTime
            className="admin-date-filter-field"
            label="Ends"
            labelVisibility="visible"
            name="endsAt"
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Create coupons
          </AdminFormControlButton>
        </form>
      </AdminFilterPanel>
      <CouponsTableSection
        rows={couponModel.couponRows}
        updateAction={updateCoupon}
        usageCouponId={usageCouponId}
        usageHrefForPage={(couponId, page) => couponUsageHref(usageSearchParams, couponId, page)}
        usagePage={usagePage}
      />
      {couponTotalPages > 1 ? (
        <AdminRoundedPagination
          activePage={couponPage}
          ariaLabel="Coupon list pagination"
          className="vuexy-booking-pagination coupon-list-pagination"
          hrefForPage={(page) => couponListHref(couponListSearchParams, page)}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={couponTotalPages}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function isCouponToggleConfirmation(value: unknown): value is CouponToggleConfirmation {
  return Boolean(value && typeof value === 'object' && 'currentActive' in value);
}

function readPositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function couponUsageSearchParams(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'confirm' || key === 'couponId' || key === 'usageCouponId' || key === 'usagePage') {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item) {
        next.append(key, item);
      }
    }
  }

  return next;
}

function couponListSearchParamsWithoutPaging(params: Record<string, string | string[] | undefined>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (
      key === 'confirm' ||
      key === 'couponId' ||
      key === 'couponPage' ||
      key === 'usageCouponId' ||
      key === 'usagePage' ||
      key === 'couponNotice' ||
      key === 'created' ||
      key === 'failed'
    ) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item) {
        next.append(key, item);
      }
    }
  }

  return next;
}

function couponListHref(baseParams: URLSearchParams, page: number) {
  const next = new URLSearchParams(baseParams);
  if (page > 1) {
    next.set('couponPage', String(page));
  } else {
    next.delete('couponPage');
  }

  const query = next.toString();
  return query ? `/coupons?${query}` : '/coupons';
}

function couponUsageHref(baseParams: URLSearchParams, couponId: string, page: number) {
  const next = new URLSearchParams(baseParams);
  next.set('usageCouponId', couponId);
  if (page > 1) {
    next.set('usagePage', String(page));
  } else {
    next.delete('usagePage');
  }

  const query = next.toString();
  return query ? `/coupons?${query}` : '/coupons';
}

function emptyCouponUsagePage(couponId: string, page: number): AdminCouponUsagePage {
  return {
    couponId,
    rows: [],
    skip: (Math.max(1, page) - 1) * COUPON_USAGE_PAGE_SIZE,
    take: COUPON_USAGE_PAGE_SIZE,
    totalCount: 0,
  };
}

function withCouponUsagePage(
  coupons: readonly AdminCoupon[],
  usagePage: AdminCouponUsagePage | null,
): AdminCoupon[] {
  if (!usagePage) {
    return [...coupons];
  }

  return coupons.map((coupon) =>
    coupon.id === usagePage.couponId
      ? {
          ...coupon,
          usageBookingCount: usagePage.totalCount,
          usageBookings: usagePage.rows,
        }
      : coupon,
  );
}
