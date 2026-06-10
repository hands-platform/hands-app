import { AdminCoupon, adminGet } from '../../lib/admin-api';
import { formatDateTime as formatDate } from '../../lib/admin-format';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import Link from 'next/link';
import { buildCouponToggleConfirmation, couponToggleConfirmHref } from './coupon-action-confirmation';
import { CouponsTableSection, type CouponTableRow } from './coupons-table-section';
import { createCoupon, toggleCoupon } from './actions';

type CouponsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CouponsPage({ searchParams }: { searchParams?: CouponsPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const coupons = await adminGet<AdminCoupon[]>('/admin/coupons', []);
  const orderedCoupons = [...coupons].sort((left, right) => couponPriority(right) - couponPriority(left));
  const liveCoupons = orderedCoupons.filter((coupon) => coupon.active && couponWindowState(coupon) === 'live');
  const activeCoupons = orderedCoupons.filter((coupon) => coupon.active && couponWindowState(coupon) !== 'expired');
  const scheduledCoupons = orderedCoupons.filter((coupon) => coupon.active && couponWindowState(coupon) === 'scheduled');
  const expiredCoupons = orderedCoupons.filter((coupon) => couponWindowState(coupon) === 'expired');
  const pausedCoupons = orderedCoupons.filter((coupon) => !coupon.active);
  const needsReview = orderedCoupons.filter((coupon) => couponNeedsReview(coupon));
  const campaignBoard = buildCampaignCommandBoard({
    liveCoupons,
    scheduledCoupons,
    expiredCoupons,
    pausedCoupons,
    needsReview,
  });
  const couponRows = buildCouponTableRows(orderedCoupons);
  const confirmation =
    readSingleParam(params.confirm) === 'toggle'
      ? buildCouponToggleConfirmation(orderedCoupons, readSingleParam(params.couponId))
      : null;

  return (
    <AdminPageTemplate
      description="Promotion control for customer booking checkout, campaign readiness, and expired code cleanup."
      metrics={[
        { label: 'Total', value: orderedCoupons.length, helper: 'Coupons loaded for admin review.' },
        { label: 'Live now', value: liveCoupons.length, helper: 'Can be used in customer checkout.' },
        { label: 'Active', value: activeCoupons.length, helper: 'Live or upcoming discounts.' },
        {
          label: 'Scheduled',
          value: scheduledCoupons.length,
          helper: 'Approved, but start time is still ahead.',
        },
        { label: 'Expired', value: expiredCoupons.length, helper: 'Candidates for pause or cleanup.' },
        {
          label: 'Needs review',
          value: needsReview.length,
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

      <section className="card" style={{ marginBottom: 20 }}>
        <AdminSectionHeader
          description="Promotion control for customer acquisition, booking conversion, and codes that should not accidentally remain visible in checkout."
          status={
            <span
            className={`pill ${
              needsReview.length > 0 || expiredCoupons.some((coupon) => coupon.active)
                ? 'pill-warn'
                : 'pill-success'
            }`}
          >
            {needsReview.length} review item(s)
          </span>
          }
          title="Campaign command board"
        />
        <div className="ops-task-grid">
          {campaignBoard.map((item) => (
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
        liveCount={liveCoupons.length}
        pausedCount={pausedCoupons.length}
        reviewCount={needsReview.length}
        rows={couponRows}
        scheduledCount={scheduledCoupons.length}
      />
    </AdminPageTemplate>
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

type CampaignCommandTone = 'warn' | 'info' | 'ok';

type CampaignCommandItem = {
  title: string;
  detail: string;
  status: string;
  operatorAction: string;
  href: string;
  tone: CampaignCommandTone;
  coupons: AdminCoupon[];
};

function buildCouponTableRows(coupons: readonly AdminCoupon[]): CouponTableRow[] {
  return coupons.map((coupon) => ({
    actions: [
      {
        description: coupon.active
          ? 'Review before removing this code from checkout.'
          : 'Review before making this code available to checkout.',
        href: couponToggleConfirmHref(coupon.id),
        kind: 'link',
        label: coupon.active ? 'Pause' : 'Activate',
        tone: coupon.active ? 'danger' : 'warning',
      },
    ],
    checkoutHint: couponCheckoutHint(coupon),
    code: coupon.code,
    description: coupon.description ?? '-',
    discountLabel: formatDiscount(coupon.discount),
    id: coupon.id,
    lowerCode: coupon.code.toLowerCase(),
    opsHint: couponOpsHint(coupon),
    statusClassName: couponStatusClass(coupon),
    statusLabel: couponStatusLabel(coupon),
    windowLabel: couponWindowLabel(coupon),
    windowSignal: couponWindowSignal(coupon),
  }));
}

function buildCampaignCommandBoard({
  liveCoupons,
  scheduledCoupons,
  expiredCoupons,
  pausedCoupons,
  needsReview,
}: {
  liveCoupons: AdminCoupon[];
  scheduledCoupons: AdminCoupon[];
  expiredCoupons: AdminCoupon[];
  pausedCoupons: AdminCoupon[];
  needsReview: AdminCoupon[];
}): CampaignCommandItem[] {
  return [
    {
      title: 'Live checkout codes',
      detail: 'Codes customers can use right now while booking. Monitor discount exposure and booking lift.',
      status: 'Live',
      operatorAction: 'Confirm each live code has an intended campaign owner and end condition.',
      href: '/coupons',
      tone: liveCoupons.length > 0 ? 'info' : 'ok',
      coupons: liveCoupons,
    },
    {
      title: 'Upcoming campaigns',
      detail: 'Scheduled codes should be ready before marketing pushes or partner demand planning.',
      status: 'Scheduled',
      operatorAction: 'Check start time, discount amount, and support briefing before launch.',
      href: '/coupons',
      tone: scheduledCoupons.length > 0 ? 'info' : 'ok',
      coupons: scheduledCoupons,
    },
    {
      title: 'Expired active codes',
      detail: 'Expired codes that remain active create customer confusion and checkout rejection noise.',
      status: 'Expired',
      operatorAction: 'Pause, replace, or archive these before the next campaign review.',
      href: '/coupons',
      tone: expiredCoupons.some((coupon) => coupon.active) ? 'warn' : 'ok',
      coupons: expiredCoupons.filter((coupon) => coupon.active),
    },
    {
      title: 'Paused or review queue',
      detail: 'Paused campaigns and review candidates need a deliberate activate, replace, or cleanup decision.',
      status: 'Needs decision',
      operatorAction: 'Decide whether each code should return, stay paused, or be replaced.',
      href: '/coupons',
      tone: needsReview.length > 0 || pausedCoupons.length > 0 ? 'warn' : 'ok',
      coupons: needsReview.length > 0 ? needsReview : pausedCoupons,
    },
  ];
}

function couponPriority(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (couponNeedsReview(coupon)) {
    return 6;
  }
  if (coupon.active && windowState === 'live') {
    return 5;
  }
  if (coupon.active && windowState === 'scheduled') {
    return 4;
  }
  if (coupon.active && windowState === 'expired') {
    return 3;
  }
  return 1;
}

function couponNeedsReview(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  return (coupon.active && windowState === 'expired') || !coupon.active;
}

function couponWindowState(coupon: AdminCoupon): 'draft' | 'scheduled' | 'live' | 'expired' {
  const now = Date.now();
  const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
  const endsAt = coupon.endsAt ? new Date(coupon.endsAt).getTime() : null;

  if (endsAt && endsAt < now) {
    return 'expired';
  }
  if (startsAt && startsAt > now) {
    return 'scheduled';
  }
  if (!coupon.active) {
    return 'draft';
  }
  return 'live';
}

function couponStatusLabel(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active) {
    return 'PAUSED';
  }
  if (windowState === 'scheduled') {
    return 'SCHEDULED';
  }
  if (windowState === 'expired') {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

function couponWindowSignal(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (windowState === 'scheduled') {
    return 'Waiting for start window.';
  }
  if (windowState === 'expired') {
    return 'Past end date.';
  }
  if (!coupon.active) {
    return 'Paused by admin.';
  }
  return 'Live for booking checkout.';
}

function couponWindowLabel(coupon: AdminCoupon) {
  const start = coupon.startsAt ? formatDate(coupon.startsAt) : 'Immediate';
  const end = coupon.endsAt ? formatDate(coupon.endsAt) : 'No end date';
  return `${start} -> ${end}`;
}

function couponOpsHint(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (windowState === 'expired') {
    return coupon.active ? 'Pause or replace this expired code.' : 'Ready for cleanup or replacement.';
  }
  if (windowState === 'scheduled') {
    return 'Leave active so it goes live on schedule.';
  }
  if (!coupon.active) {
    return 'Re-activate when the campaign should return.';
  }
  return 'Safe to use in customer checkout now.';
}

function couponCheckoutHint(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active) {
    return 'Checkout preview will reject this code until it is activated.';
  }
  if (windowState === 'scheduled') {
    return 'Checkout preview will reject this code until the start time.';
  }
  if (windowState === 'expired') {
    return 'Checkout preview will reject this code because the end time passed.';
  }
  return 'Checkout preview and booking payment authorization should apply this discount.';
}

function couponStatusClass(coupon: AdminCoupon) {
  const windowState = couponWindowState(coupon);
  if (!coupon.active || windowState === 'expired') {
    return 'signal signal-warn';
  }
  if (windowState === 'scheduled') {
    return 'signal signal-info';
  }
  return 'signal signal-ok';
}

function formatDiscount(discount: unknown) {
  if (!discount || typeof discount !== 'object') {
    return 'Unknown';
  }
  const input = discount as { type?: string; value?: number | string };
  const value = typeof input.value === 'string' ? Number(input.value) : input.value;
  if (input.type === 'percent' && Number.isFinite(value)) {
    return `${value}% off`;
  }
  return JSON.stringify(discount);
}

function campaignToneClass(tone: CampaignCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

function campaignToneLabel(tone: CampaignCommandTone) {
  if (tone === 'warn') {
    return 'Needs decision';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}
