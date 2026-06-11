import type { AdminCoupon } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import Link from 'next/link';
import { buildCouponToggleConfirmation } from './coupon-action-confirmation';
import { CouponsTableSection } from './coupons-table-section';
import { createCoupon, toggleCoupon } from './actions';
import {
  buildCouponPageModel,
  campaignToneClass,
  campaignToneLabel,
  couponStatusLabel,
} from './coupon-page-model';
import { formatDiscount } from './coupon-page-presenters';

type CouponsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CouponsPage({ searchParams }: { searchParams?: CouponsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const coupons = await adminGet<AdminCoupon[]>('/admin/coupons', []);
  const couponModel = buildCouponPageModel(coupons);
  const confirmation =
    readSingleParam(params.confirm) === 'toggle'
      ? buildCouponToggleConfirmation(couponModel.orderedCoupons, readSingleParam(params.couponId))
      : null;

  return (
    <AdminPageTemplate
      description="Promotion control for customer booking checkout, campaign readiness, and expired code cleanup."
      metrics={[
        { label: 'Total', value: couponModel.orderedCoupons.length, helper: 'Coupons loaded for admin review.' },
        { label: 'Live now', value: couponModel.liveCoupons.length, helper: 'Can be used in customer checkout.' },
        { label: 'Active', value: couponModel.activeCoupons.length, helper: 'Live or upcoming discounts.' },
        {
          label: 'Scheduled',
          value: couponModel.scheduledCoupons.length,
          helper: 'Approved, but start time is still ahead.',
        },
        { label: 'Expired', value: couponModel.expiredCoupons.length, helper: 'Candidates for pause or cleanup.' },
        {
          label: 'Needs review',
          value: couponModel.needsReview.length,
          helper: 'Expired active codes or paused campaigns.',
        },
      ]}
      title="Coupons"
    >
      {confirmation ? (
        <ConfirmDialog
          action={toggleCoupon}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={[
            { name: 'couponId', value: confirmation.couponId },
            { name: 'active', value: confirmation.currentActive },
          ]}
          id={`coupon-toggle-${confirmation.couponId}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <section className="card admin-mb-20">
        <AdminSectionHeader
          description="Promotion control for customer acquisition, booking conversion, and codes that should not accidentally remain visible in checkout."
          status={
            <span
              className={`pill ${
                couponModel.needsReview.length > 0 || couponModel.expiredCoupons.some((coupon) => coupon.active)
                  ? 'pill-warn'
                  : 'pill-success'
              }`}
            >
              {couponModel.needsReview.length} review item(s)
            </span>
          }
          title="Campaign command board"
        />
        <div className="ops-task-grid">
          {couponModel.campaignBoard.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.title}>
              <span className={`signal ${campaignToneClass(item.tone)}`}>{campaignToneLabel(item.tone)}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.status}</span>
                <span className="pill">{item.coupons.length} code(s)</span>
              </div>
              {item.coupons.length > 0 ? (
                <div className="stack">
                  {item.coupons.slice(0, 3).map((coupon) => (
                    <span className="muted" key={`${item.title}-${coupon.id}`}>
                      {coupon.code} / {formatDiscount(coupon.discount)} / {couponStatusLabel(coupon)}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{item.operatorAction}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Create Coupon</h2>
        <p className="muted">
          Codes are normalized to uppercase and customer checkout accepts either uppercase or lowercase input.
        </p>
        <form className="form-row" action={createCoupon}>
          <input name="code" placeholder="WELCOME10" />
          <input name="description" placeholder="Description" />
          <input name="percent" type="number" min="1" max="100" placeholder="%" />
          <input name="startsAt" type="datetime-local" />
          <input name="endsAt" type="datetime-local" />
          <button type="submit">Create</button>
        </form>
      </section>
      <CouponsTableSection
        liveCount={couponModel.liveCoupons.length}
        pausedCount={couponModel.pausedCoupons.length}
        reviewCount={couponModel.needsReview.length}
        rows={couponModel.couponRows}
        scheduledCount={couponModel.scheduledCoupons.length}
      />
    </AdminPageTemplate>
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
