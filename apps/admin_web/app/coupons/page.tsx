import { AdminCoupon, adminGet } from '../../lib/admin-api';
import { formatDateTime as formatDate } from '../../lib/admin-format';
import Link from 'next/link';
import { createCoupon, toggleCoupon } from './actions';

export default async function CouponsPage() {
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

  return (
    <>
      <h1>Coupons</h1>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <SummaryCard label="Total" value={String(orderedCoupons.length)} hint="Coupons loaded for admin review." />
        <SummaryCard label="Live now" value={String(liveCoupons.length)} hint="Can be used in customer checkout." />
        <SummaryCard label="Active" value={String(activeCoupons.length)} hint="Live or upcoming discounts." />
        <SummaryCard label="Scheduled" value={String(scheduledCoupons.length)} hint="Approved, but start time is still ahead." />
        <SummaryCard label="Expired" value={String(expiredCoupons.length)} hint="Candidates for pause or cleanup." />
        <SummaryCard label="Needs review" value={String(needsReview.length)} hint="Expired active codes or paused campaigns." />
      </section>
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="ops-section-header">
          <div>
            <h2>Campaign command board</h2>
            <p className="muted">
              Promotion control for customer acquisition, booking conversion, and codes that should not
              accidentally remain visible in checkout.
            </p>
          </div>
          <span
            className={`pill ${
              needsReview.length > 0 || expiredCoupons.some((coupon) => coupon.active)
                ? 'pill-warn'
                : 'pill-success'
            }`}
          >
            {needsReview.length} review item(s)
          </span>
        </div>
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
      <section className="card" style={{ marginTop: 20 }}>
        <div className="toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Checkout Campaigns</h2>
            <p className="muted">Use this board to confirm which codes are safe to expose in the customer booking flow.</p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">{liveCoupons.length} live</span>
            <span className="pill pill-info">{scheduledCoupons.length} scheduled</span>
            <span className="pill pill-warn">{needsReview.length} review</span>
            <span className="pill">{pausedCoupons.length} paused</span>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Discount</th>
              <th>Status</th>
              <th>Window</th>
              <th>Ops hint</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orderedCoupons.map((coupon) => (
              <tr key={coupon.id}>
                <td>
                  <strong>{coupon.code}</strong>
                  <div className="muted">Customer can enter {coupon.code.toLowerCase()} or {coupon.code}</div>
                </td>
                <td>{coupon.description ?? '-'}</td>
                <td>{formatDiscount(coupon.discount)}</td>
                <td>
                  <span className={couponStatusClass(coupon)}>{couponStatusLabel(coupon)}</span>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{couponWindowSignal(coupon)}</div>
                </td>
                <td>{couponWindowLabel(coupon)}</td>
                <td>
                  <div>{couponOpsHint(coupon)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {couponCheckoutHint(coupon)}
                  </div>
                </td>
                <td>
                  <form action={toggleCoupon}>
                    <input type="hidden" name="couponId" value={coupon.id} />
                    <input type="hidden" name="active" value={String(coupon.active)} />
                    <button type="submit">{coupon.active ? 'Pause' : 'Activate'}</button>
                  </form>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7}>No coupons loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <section className="card" style={{ marginTop: 0 }}>
      <div style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{value}</div>
      <div style={{ color: '#6b7280', marginTop: 8 }}>{hint}</div>
    </section>
  );
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
