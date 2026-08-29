import { Plus, RefreshCw } from 'lucide-react';

import type {
  AdminCoupon,
  AdminCouponSummary,
  AdminCouponUsagePage,
  AdminGetResult,
} from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { AdminTablePaginationFooter } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminNoticeCard } from '../../components/admin-surface';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { StatusBadge } from '../../components/status-badge';
import { couponLaunchEnabled } from '../../lib/launch-features';
import { activateCoupon, deleteCoupon, pauseCoupon, updateCoupon } from './actions';
import {
  buildCouponDeleteConfirmation,
  buildCouponToggleConfirmation,
  couponDeleteConfirmHref,
  couponToggleConfirmHref,
  type CouponToggleConfirmation,
} from './coupon-action-confirmation';
import { CouponCreateDrawer } from './coupon-create-drawer';
import { CouponDrawerShell } from './coupon-drawer-shell';
import { CouponFilterBoard } from './coupon-filter-board';
import { couponApiState, parseCouponListFilters } from './coupon-filters';
import { CouponManagementDrawer } from './coupon-management-drawer';
import { formatCouponIctDateTime } from './coupon-ict-time';
import { buildCouponCreateNotice, buildCouponPageModel } from './coupon-page-model';
import { couponReturnTo, sanitizeCouponReturnTo } from './coupon-return-context';
import { CouponsTableSection } from './coupons-table-section';

type CouponsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type ConfirmationHiddenInput = { readonly name: string; readonly value: boolean | number | string };
const COUPON_LIST_PAGE_SIZE = 10;
const COUPON_USAGE_PAGE_SIZE = 10;
const EMPTY_COUPON_SUMMARY: AdminCouponSummary = {
  expiredCount: 0,
  filteredCount: 0,
  liveCount: 0,
  pausedCount: 0,
  scheduledCount: 0,
  totalCount: 0,
};

export default async function CouponsPage({ searchParams }: { searchParams?: CouponsPageSearchParams }) {
  if (!couponLaunchEnabled()) {
    return (
      <AdminPageTemplate
        contentClassName="coupons-page"
        description="Coupon creation, activation, checkout preview, and redemption are disabled for the current launch. Historical finance and audit records remain retained."
        title="Coupons"
      >
        <AdminNoticeCard tone="warning">
          <strong>Not active for current launch</strong>
          <p>Coupon operations require a separate launch approval and an enabled server feature gate.</p>
        </AdminNoticeCard>
      </AdminPageTemplate>
    );
  }

  const params = searchParams ? await searchParams : {};
  const filters = parseCouponListFilters(params);
  const couponPage = readPositiveInteger(readSingleParam(params.couponPage));
  const usagePage = readPositiveInteger(readSingleParam(params.usagePage));
  const confirmAction = readSingleParam(params.confirm);
  const confirmCouponId = readSingleParam(params.couponId);
  const editCouponId = readSingleParam(params.editCouponId);
  const usageCouponId = readSingleParam(params.usageCouponId);
  const drawer = readSingleParam(params.drawer);
  const targetCouponId = confirmCouponId || editCouponId || usageCouponId;
  const returnTo = readSingleParam(params.returnTo)
    ? sanitizeCouponReturnTo(readSingleParam(params.returnTo))
    : couponReturnTo(params);
  const couponSkip = (couponPage - 1) * COUPON_LIST_PAGE_SIZE;
  const usageSkip = (usagePage - 1) * COUPON_USAGE_PAGE_SIZE;
  const couponListParams = new URLSearchParams({ take: String(COUPON_LIST_PAGE_SIZE) });
  const couponState = couponApiState(filters.view);
  if (couponState) couponListParams.set('state', couponState);
  if (filters.q) couponListParams.set('q', filters.q);
  if (filters.sort !== 'code') couponListParams.set('sort', filters.sort);
  if (couponSkip > 0) couponListParams.set('skip', String(couponSkip));

  const couponSummaryParams = new URLSearchParams();
  if (couponState) couponSummaryParams.set('state', couponState);
  if (filters.q) couponSummaryParams.set('q', filters.q);
  const couponSummaryHref = couponSummaryParams.size > 0
    ? `/admin/coupons/summary?${couponSummaryParams.toString()}`
    : '/admin/coupons/summary';

  const [couponListResult, couponSummaryResult, targetCouponResult, usageResult] = await Promise.all([
    adminGetResult<AdminCoupon[]>(`/admin/coupons?${couponListParams.toString()}`, []),
    adminGetResult<AdminCouponSummary>(couponSummaryHref, EMPTY_COUPON_SUMMARY),
    targetCouponId
      ? adminGetResult<AdminCoupon | null>(`/admin/coupons/${encodeURIComponent(targetCouponId)}`, null)
      : resolvedAdminResult<AdminCoupon | null>(null),
    usageCouponId
      ? adminGetResult<AdminCouponUsagePage | null>(
          `/admin/coupons/${encodeURIComponent(usageCouponId)}/usage?take=${COUPON_USAGE_PAGE_SIZE}&skip=${usageSkip}`,
          null,
        )
      : resolvedAdminResult<AdminCouponUsagePage | null>(null),
  ]);

  const summary = couponSummaryResult.data;
  const mutationsEnabled = couponListResult.ok && couponSummaryResult.ok;
  const targetCoupon = withCouponUsage(targetCouponResult.data, usageResult.ok ? usageResult.data : null);
  const couponModel = buildCouponPageModel(couponListResult.data);
  const targetRow = targetCoupon ? buildCouponPageModel([targetCoupon]).couponRows[0] ?? null : null;
  const filteredCouponCount = couponSummaryResult.ok
    ? summary.filteredCount ?? filteredCountForView(summary, filters.view)
    : 0;
  const couponTotalPages = Math.max(1, Math.ceil(filteredCouponCount / COUPON_LIST_PAGE_SIZE));
  const couponListFrom =
    filteredCouponCount === 0 || couponModel.couponRows.length === 0
      ? 0
      : (couponPage - 1) * COUPON_LIST_PAGE_SIZE + 1;
  const couponListTo =
    filteredCouponCount === 0 || couponModel.couponRows.length === 0
      ? 0
      : Math.min(filteredCouponCount, couponSkip + couponModel.couponRows.length);
  const createNotice = buildCouponCreateNotice({
    created: readSingleParam(params.created),
    failed: readSingleParam(params.failed),
    notice: readSingleParam(params.couponNotice),
  });
  const confirmation = targetCouponResult.ok && targetCoupon
    ? confirmAction === 'toggle'
      ? buildCouponToggleConfirmation([targetCoupon], confirmCouponId, returnTo)
      : confirmAction === 'delete'
        ? buildCouponDeleteConfirmation([targetCoupon], confirmCouponId, returnTo)
        : null
    : null;
  const confirmationRequested = confirmAction === 'toggle' || confirmAction === 'delete';
  const confirmationAction = confirmAction === 'delete'
    ? deleteCoupon
    : isCouponToggleConfirmation(confirmation) && confirmation.currentActive
      ? pauseCoupon
      : activateCoupon;
  const confirmationInputs: ConfirmationHiddenInput[] = confirmation
    ? [
        { name: 'couponId', value: confirmation.couponId },
        { name: 'returnTo', value: returnTo },
      ]
    : [];
  const panelParams = new URL(returnTo, 'https://admin.hands.vn').searchParams;
  const generatedAtLabel = couponSummaryResult.ok && summary.generatedAt
    ? formatCouponIctDateTime(summary.generatedAt)
    : null;

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink className="button-secondary" href={returnTo}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh now
          </AdminFormControlLink>
          {mutationsEnabled ? (
            <AdminFormControlLink className="button-primary" href={couponPanelHref(returnTo, 'drawer', 'create')}>
              <Plus aria-hidden="true" size={16} />
              Create coupon
            </AdminFormControlLink>
          ) : (
            <StatusBadge tone="neutral">Create unavailable</StatusBadge>
          )}
        </>
      }
      contentClassName="coupons-page"
      description={
        <>
          Growth campaign windows and booking usage. All times use ICT (UTC+7).
          {generatedAtLabel ? ` Updated ${generatedAtLabel}.` : ' Freshness unavailable.'}
        </>
      }
      metrics={couponSummaryResult.ok ? [
        {
          helper: 'Coupons available in customer checkout now.',
          kind: 'live',
          label: 'Live checkout codes',
          scope: 'Current',
          value: summary.liveCount,
        },
        {
          helper: 'Active coupons waiting for their ICT start time.',
          kind: 'action',
          label: 'Scheduled launches',
          scope: 'Current',
          value: summary.scheduledCount,
        },
        {
          helper: 'Paused and expired coupons retained for operations and audit.',
          kind: 'record',
          label: 'Inactive records',
          scope: 'Current',
          value: summary.expiredCount + summary.pausedCount,
        },
      ] : []}
      title="Coupons"
    >
      {confirmationRequested ? (
        confirmation ? (
          <ConfirmDialog
            action={confirmationAction}
            cancelHref={confirmation.cancelHref}
            confirmLabel={confirmation.confirmLabel}
            description={confirmation.description}
            disabled={!mutationsEnabled || (isCouponToggleConfirmation(confirmation) && confirmation.disabled)}
            hiddenInputs={confirmationInputs}
            id={`coupon-${confirmAction}-${confirmation.couponId}`}
            requireValidForm={isCouponToggleConfirmation(confirmation)}
            supportingLinks={isCouponToggleConfirmation(confirmation) && confirmation.supportingHref
              ? [{ href: confirmation.supportingHref, label: 'Update coupon window' }]
              : []}
            textInputs={isCouponToggleConfirmation(confirmation)
              ? [{ label: 'Operational reason', maxLength: 500, name: 'reason', required: true }]
              : []}
            title={confirmation.title}
            tone={confirmation.tone}
          />
        ) : (
          <ConfirmDialog
            action={confirmationAction}
            cancelHref={returnTo}
            confirmLabel="Action unavailable"
            description="The exact coupon record could not be loaded. No campaign change is available."
            disabled
            id="coupon-confirmation-unavailable"
            supportingLinks={[{ href: returnTo, label: 'Retry coupon list' }]}
            title="Coupon confirmation unavailable"
            tone="danger"
          />
        )
      ) : null}

      {createNotice ? (
        <AdminInlineNotice className="coupon-create-notice" role="status" tone={createNotice.tone}>
          <strong>{createNotice.title}</strong>
          <span>{createNotice.detail}</span>
        </AdminInlineNotice>
      ) : null}

      {!couponSummaryResult.ok ? (
        <SourceFailureNotice
          href={returnTo}
          label="Coupon summary unavailable"
          status={couponSummaryResult.status}
        />
      ) : null}
      {!couponListResult.ok ? (
        <SourceFailureNotice
          href={returnTo}
          label="Coupon list unavailable"
          status={couponListResult.status}
        />
      ) : null}

      <CouponFilterBoard
        filters={filters}
        matchingCount={couponSummaryResult.ok ? filteredCouponCount : undefined}
        summary={summary}
        summaryLoaded={couponSummaryResult.ok}
      />

      <CouponsTableSection
        actionsEnabled={mutationsEnabled}
        deleteHrefForCoupon={(couponId) => couponDeleteConfirmHref(couponId, returnTo)}
        editHrefForCoupon={(couponId) => couponPanelHref(returnTo, 'editCouponId', couponId)}
        listLoaded={couponListResult.ok}
        rows={couponModel.couponRows}
        toggleHrefForCoupon={(couponId) => couponToggleConfirmHref(couponId, returnTo)}
        usageHrefForCoupon={(couponId) => couponUsageHref(panelParams, couponId, 1)}
      />

      {couponSummaryResult.ok && couponListResult.ok && couponTotalPages > 1 ? (
        <AdminTablePaginationFooter
          activePage={couponPage}
          ariaLabel="Coupon list pagination"
          className="coupon-list-pagination"
          from={couponListFrom}
          hrefForPage={(page) => couponListHref(panelParams, page)}
          to={couponListTo}
          totalPages={couponTotalPages}
          totalRows={filteredCouponCount}
        />
      ) : null}

      {drawer === 'create' ? (
        mutationsEnabled ? (
          <CouponCreateDrawer closeHref={returnTo} />
        ) : (
          <UnavailableCouponDrawer closeHref={returnTo} title="Coupon creation unavailable" />
        )
      ) : null}

      {editCouponId || usageCouponId ? (
        <CouponManagementDrawer
          closeHref={returnTo}
          hrefForUsagePage={(page) => couponUsageHref(panelParams, usageCouponId || targetCouponId, page)}
          mode={editCouponId ? 'edit' : 'usage'}
          mutationsEnabled={mutationsEnabled}
          returnTo={returnTo}
          row={targetRow}
          targetLoaded={targetCouponResult.ok}
          updateAction={updateCoupon}
          usageLoaded={!usageCouponId || usageResult.ok}
          usagePage={usagePage}
        />
      ) : null}
    </AdminPageTemplate>
  );
}

function SourceFailureNotice({ href, label, status }: { readonly href: string; readonly label: string; readonly status: number | null }) {
  const authFailure = status === 401 || status === 403;
  return (
    <AdminInlineNotice className="coupon-source-failure" role="alert" tone="danger">
      <strong>{label}</strong>
      <span>
        {authFailure
          ? 'Admin authorization could not be verified. Sign in again before changing campaign state.'
          : 'Retry before using this page for campaign decisions.'}
      </span>
      <AdminFormControlLink className="button-secondary" href={href}>Retry</AdminFormControlLink>
    </AdminInlineNotice>
  );
}

function UnavailableCouponDrawer({ closeHref, title }: { readonly closeHref: string; readonly title: string }) {
  return (
    <CouponDrawerShell
      closeHref={closeHref}
      eyebrow="Data safety"
      title={title}
      titleId="coupon-unavailable-drawer-title"
    >
      <AdminNoticeCard role="alert" tone="danger">
        <strong>Coupon sources are unavailable</strong>
        <p className="muted">Retry the list and summary before creating or changing coupons.</p>
        <AdminFormControlLink className="button-secondary" href={closeHref}>Retry coupons</AdminFormControlLink>
      </AdminNoticeCard>
    </CouponDrawerShell>
  );
}

function filteredCountForView(summary: AdminCouponSummary, view: ReturnType<typeof parseCouponListFilters>['view']) {
  if (view === 'live') return summary.liveCount;
  if (view === 'scheduled') return summary.scheduledCount;
  if (view === 'paused') return summary.pausedCount;
  if (view === 'expired') return summary.expiredCount;
  if (view === 'records') return summary.expiredCount + summary.pausedCount;
  return summary.totalCount;
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

function couponPanelHref(returnTo: string, key: 'drawer' | 'editCouponId', value: string) {
  const parsed = new URL(returnTo, 'https://admin.hands.vn');
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

function couponListHref(baseParams: URLSearchParams, page: number) {
  const next = new URLSearchParams(baseParams);
  next.delete('usagePage');
  next.delete('usageCouponId');
  if (page > 1) next.set('couponPage', String(page));
  else next.delete('couponPage');
  const query = next.toString();
  return query ? `/coupons?${query}` : '/coupons';
}

function couponUsageHref(baseParams: URLSearchParams, couponId: string, page: number) {
  const next = new URLSearchParams(baseParams);
  next.set('usageCouponId', couponId);
  if (page > 1) next.set('usagePage', String(page));
  else next.delete('usagePage');
  return `/coupons?${next.toString()}`;
}

function withCouponUsage(coupon: AdminCoupon | null, usagePage: AdminCouponUsagePage | null) {
  if (!coupon || !usagePage || coupon.id !== usagePage.couponId) return coupon;
  return {
    ...coupon,
    usageBookingCount: usagePage.totalCount,
    usageBookings: usagePage.rows,
  };
}

function resolvedAdminResult<T>(data: T): Promise<AdminGetResult<T>> {
  return Promise.resolve({ data, ok: true, status: 200 });
}
