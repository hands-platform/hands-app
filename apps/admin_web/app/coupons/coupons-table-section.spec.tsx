import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import {
  CouponsTableSection,
  CouponUsageBookingTable,
  type CouponTableRow,
} from './coupons-table-section';

const sectionSource = readFileSync(new URL('./coupons-table-section.tsx', import.meta.url), 'utf8');

describe('CouponsTableSection', () => {
  it('renders one dense operations table with lifecycle actions and preserved links', () => {
    const markup = renderToStaticMarkup(
      <CouponsTableSection
        deleteHrefForCoupon={(id) => `/coupons?confirm=delete&couponId=${id}&returnTo=records`}
        editHrefForCoupon={(id) => `/coupons?view=records&editCouponId=${id}`}
        rows={[buildRow()]}
        toggleHrefForCoupon={(id) => `/coupons?confirm=toggle&couponId=${id}&returnTo=records`}
        usageHrefForCoupon={(id) => `/coupons?view=records&usageCouponId=${id}`}
      />,
    );

    expect(markup).toContain('Coupon list');
    expect(markup).toContain('Coupon operations table');
    expect(markup).toContain('WELCOME10');
    expect(markup).toContain('10% off');
    expect(markup).toContain('Checkout window (ICT)');
    expect(markup).toContain('Pause');
    expect(markup).toContain('Edit');
    expect(markup).toContain('1 bookings');
    expect(markup).toContain('More actions for WELCOME10');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Delete coupon');
    expect(markup).toContain('/coupons?view=records&amp;editCouponId=coupon-1');
    expect(markup).toContain('/coupons?view=records&amp;usageCouponId=coupon-1');
    expect(sectionSource).toContain('ActionMenu');
    expect(sectionSource).toContain('managedDropdown');
    expect(sectionSource).toContain('variant="dropdown"');
    expect(sectionSource).not.toContain('AdminDisclosure');
    expect(sectionSource).not.toContain('coupon-edit-form');
    expect(sectionSource).not.toContain('couponSections(');
  });

  it('replaces delete with a pause-only explanation when usage is known', () => {
    const row = { ...buildRow(), usageBookingCount: 2, usageCountKnown: true };
    const markup = renderToStaticMarkup(
      <CouponsTableSection
        deleteHrefForCoupon={() => '/delete'}
        editHrefForCoupon={() => '/edit'}
        rows={[row]}
        toggleHrefForCoupon={() => '/toggle'}
        usageHrefForCoupon={() => '/usage'}
      />,
    );

    expect(markup).toContain('More actions for WELCOME10');
    expect(sectionSource).toContain('Pause only · usage retained');
    expect(sectionSource).toContain('Used coupons are retained for audit');
  });

  it('disables campaign mutations when a required source is unavailable', () => {
    const markup = renderToStaticMarkup(
      <CouponsTableSection
        actionsEnabled={false}
        deleteHrefForCoupon={() => '/delete'}
        editHrefForCoupon={() => '/edit'}
        rows={[buildRow()]}
        toggleHrefForCoupon={() => '/toggle'}
        usageHrefForCoupon={() => '/usage'}
      />,
    );

    expect(markup).toContain('Actions unavailable');
    expect(markup).not.toContain('href="/toggle"');
    expect(markup).not.toContain('href="/edit"');
    expect(markup).toContain('href="/usage"');
  });

  it('distinguishes true empty from unavailable coupon data', () => {
    const empty = renderToStaticMarkup(
      <CouponsTableSection
        deleteHrefForCoupon={() => '/delete'}
        editHrefForCoupon={() => '/edit'}
        rows={[]}
        toggleHrefForCoupon={() => '/toggle'}
        usageHrefForCoupon={() => '/usage'}
      />,
    );
    const unavailable = renderToStaticMarkup(
      <CouponsTableSection
        deleteHrefForCoupon={() => '/delete'}
        editHrefForCoupon={() => '/edit'}
        listLoaded={false}
        rows={[]}
        toggleHrefForCoupon={() => '/toggle'}
        usageHrefForCoupon={() => '/usage'}
      />,
    );

    expect(empty).toContain('No coupons match the current view and search.');
    expect(unavailable).toContain('Coupon list unavailable');
    expect(unavailable).not.toContain('<table');
  });

  it('does not render a wide usage table for a true empty result', () => {
    const markup = renderToStaticMarkup(
      <CouponUsageBookingTable hrefForPage={() => '/usage'} page={1} rows={[]} totalCount={0} />,
    );

    expect(markup).toContain('No coupon usage');
    expect(markup).not.toContain('<table');
  });

  it('labels booking, payment, paid amount, and reversal as separate evidence', () => {
    const row = buildRow().usageBookings[0]!;
    const markup = renderToStaticMarkup(
      <CouponUsageBookingTable hrefForPage={() => '/usage'} page={1} rows={[row]} totalCount={1} />,
    );

    expect(markup).toContain('Booking state');
    expect(markup).toContain('Payment');
    expect(markup).toContain('Customer paid');
    expect(markup).toContain('Reversal');
    expect(markup).toContain('REVERSED');
    expect(markup).toContain('270.000');
  });
});

function buildRow(): CouponTableRow {
  return {
    active: true,
    checkoutHint: 'Available at checkout now.',
    code: 'WELCOME10',
    description: 'Welcome campaign',
    discountLabel: '10% off',
    endsAtInputValue: '',
    endsAtIso: '',
    grossBudgetAmount: 10_000_000,
    id: 'coupon-1',
    lowerCode: 'welcome10',
    maxRedemptions: 100,
    maximumDiscountAmount: 100_000,
    minimumOrderAmount: 0,
    opsHint: '',
    perCustomerRedemptionLimit: 1,
    percentValue: '10',
    startsAtInputValue: '',
    startsAtIso: '',
    statusClassName: 'signal signal-ok',
    statusLabel: 'ACTIVE',
    usageBookingCount: 1,
    usageBookings: [
      {
        amount: 270_000,
        bookingHref: '/bookings/booking-1',
        bookingLabel: 'booking...',
        currency: 'VND',
        customerLabel: 'Demo Customer',
        discountAmount: 30_000,
        discountLabel: '30,000 VND',
        partnerLabel: 'Smoke Partner',
        paymentLabel: 'MOMO / REFUNDED',
        requestTimeLabel: '12 Jun 2026, 16:00 ICT',
        reversalStatusLabel: 'REVERSED',
        serviceLabel: 'Massage / 60 min',
        statusLabel: 'REFUNDED',
      },
    ],
    usageCountKnown: true,
    windowLabel: 'Starts immediately · No end date',
    windowSignal: 'Live for booking checkout.',
    windowState: 'live',
  };
}
