import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
} from '../../components/admin-form-controls';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import type { AdminCouponSummary } from '../../lib/admin-api';
import {
  buildCouponFilterHref,
  couponViewLabel,
  type CouponListFilters,
  type CouponListView,
} from './coupon-filters';

type CouponFilterBoardProps = {
  readonly filters: CouponListFilters;
  readonly matchingCount?: number;
  readonly summary: AdminCouponSummary;
  readonly summaryLoaded?: boolean;
};

export function CouponFilterBoard({
  filters,
  matchingCount,
  summary,
  summaryLoaded = true,
}: CouponFilterBoardProps) {
  return (
    <AdminFilterPanel
      className="coupon-filter-panel"
      id="coupon-list-controls"
      resultLabel={summaryLoaded && matchingCount !== undefined ? `${matchingCount} matching` : 'Count unavailable'}
      title="Coupon filters"
      footer={
        filters.q ? (
          <div className="coupon-filter-footer">
            <span className="muted">Search: {filters.q}</span>
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href={buildCouponFilterHref(filters, { q: '' })}
            >
              Clear search
            </AdminFormControlLink>
          </div>
        ) : undefined
      }
    >
      <div className="coupon-filter-view-bar" aria-label="Coupon operational views">
        <span className="coupon-filter-group-label">Operational view</span>
        <AdminSegmentedControl
          activeValue={filters.view}
          ariaLabel="Coupon operational view"
          className="coupon-filter-view-buttons"
          options={couponViews.map((view) => ({
            href: buildCouponFilterHref(filters, { view }),
            label: summaryLoaded ? `${couponViewLabel(view)} ${couponViewCount(view, summary)}` : couponViewLabel(view),
            value: view,
          }))}
        />
      </div>

      <AdminDirectoryFilterForm action="/coupons" className="coupon-filter-form">
        <input name="view" type="hidden" value={filters.view} />
        <div className="admin-directory-filter-grid">
          <div className="admin-directory-filter-group is-primary">
            <AdminFormSearch
              className="admin-directory-filter-search"
              defaultValue={filters.q}
              label="Search coupons"
              name="q"
              placeholder="Coupon code or campaign description"
            />
          </div>
          <div className="admin-directory-filter-actions">
            <AdminFormControlButton className="admin-directory-filter-button" type="submit">
              Apply filters
            </AdminFormControlButton>
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href="/coupons"
            >
              Reset
            </AdminFormControlLink>
          </div>
        </div>
      </AdminDirectoryFilterForm>
    </AdminFilterPanel>
  );
}

const couponViews: readonly CouponListView[] = ['live', 'scheduled', 'records', 'all'];

function couponViewCount(view: CouponListView, summary: AdminCouponSummary) {
  if (view === 'live') return summary.liveCount;
  if (view === 'scheduled') return summary.scheduledCount;
  if (view === 'records') return summary.expiredCount + summary.pausedCount;
  return summary.totalCount;
}
