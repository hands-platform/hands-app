import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingUnifiedDetail } from './booking-unified-detail';
import { BookingUnifiedDetailSection } from './booking-unified-detail-section';
import type { BookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';

describe('BookingUnifiedDetailSection', () => {
  it('uses shared Vuexy badge atoms instead of raw unified detail pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-unified-detail-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('actions={<span className={`pill ${unifiedDetail.statusTone}`}>{unifiedDetail.statusLabel}</span>}');
    expect(source).not.toContain('<span className="pill pill-neutral">{countLabel(rows.length, \'field\')}</span>');
    expect(source).not.toMatch(/className=(?:\{)?["'`][^"'`]*\btext-link\b/);
  });

  it('renders one booking detail around customer, matched Partner, finance, and updates', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture(),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: {
        id: 'location-1',
        lat: 21.032,
        lng: 105.79,
        providerProfileId: 'partner-1',
        recordedAt: '2026-06-19T07:15:00.000Z',
      } as AdminLocationSnapshot,
      messageCount: 3,
    });

    const markup = renderToStaticMarkup(<BookingUnifiedDetailSection unifiedDetail={unifiedDetail} />);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Unified booking detail');
    expect(rendered).toContain('Customer detail');
    expect(rendered).toContain('Matched Partner detail');
    expect(rendered).toContain('Finance and system detail');
    expect(rendered).toContain('6 fields');
    expect(rendered).toContain('9 fields');
    expect(rendered).toContain('Customer profile, service address, live location, and service request.');
    expect(rendered).toContain('Request time');
    expect(rendered).toContain('Customer booking request opened.');
    expect(rendered).toContain('Service address');
    expect(rendered).toContain('Live customer location');
    expect(rendered).toContain('Service request');
    expect(rendered).toContain('Requested, matched, participating Partner, and location checkpoints.');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Matched');
    expect(rendered).toContain('Profile');
    expect(rendered).toContain('Partner Matched');
    expect(rendered).toContain('Matching location');
    expect(rendered).toContain('Completion location');
    expect(rendered).toContain('Cancellation location');
    expect(rendered).toContain('Not applicable');
    expect(rendered).toContain('Only shown for post-match cancellation review.');
    expect(rendered).toContain('Location address not recorded');
    expect(rendered).toContain('Participating');
    expect(rendered).toContain('Latest location');
    expect(rendered).toContain('2 Partners');
    expect(rendered).toContain('Cau Giay, Ha Noi');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('Payment record');
    expect(rendered).toContain('Pricing basis');
    expect(rendered).toContain('Partner earning');
    expect(rendered).toContain('HANDS fee and costs');
    expect(rendered).toContain('Tax withholding');
    expect(rendered).toContain('Wallet ledger');
    expect(rendered).toContain('Service payout matrix');
    expect(rendered).toContain('3 chat messages');
    expect(rendered).toContain('500.000 VND customer -&gt; 400.000 VND Partner');
    expect(rendered).not.toMatch(/\d{2}\.\d{4},\s*\d{3}\.\d{4}/);
    expect(rendered.indexOf('Payment record')).toBeLessThan(rendered.indexOf('Service state'));
    expect(rendered.indexOf('Partner earning')).toBeLessThan(rendered.indexOf('Service state'));
    expect(rendered.indexOf('HANDS fee and costs')).toBeLessThan(rendered.indexOf('Service state'));
    expect(markup).toContain('id="booking-customer-detail"');
    expect(markup).toContain('id="booking-matched-partner-detail"');
    expect(markup).toContain('id="booking-finance-system-detail"');
    expect(markup).toContain('card admin-section admin-mb-16 booking-unified-summary-card');
    expect(markup.match(/card admin-section admin-mb-16 booking-unified-detail-card/g)).toHaveLength(3);
    expect(markup).toContain('booking-unified-participant-strip');
    expect(markup).toContain('aria-label="Participating Partners"');
    expect(markup).toContain('href="/customers/customer-profile-1"');
    expect(markup).toContain('href="/partners/partner-1"');
    expect(markup).toContain('booking-unified-info-card is-inactive');
    expect(markup).toContain('booking-unified-finance-summary');
    expect(markup).toContain('booking-unified-finance-ledger');
    expect(markup).toContain('booking-unified-finance-ledger-row');
    expect(markup.match(/is-finance-highlight/g)).toHaveLength(3);
    expect(markup.match(/booking-unified-finance-ledger-row/g)).toHaveLength(6);
    expect(markup.match(/is-secondary/g)).toHaveLength(7);
  });

  it('summarizes live customer location against the reservation address snapshot', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture({
        addressSnapshot: {
          bookingId: 'booking-1',
          customerProfileId: 'customer-profile-1',
          id: 'address-snapshot-1',
          latitude: 21.036,
          longitude: 105.782,
        },
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: null,
      messageCount: 3,
    });

    const liveLocationRow = unifiedDetail.customerRows.find((row) => row.label === 'Live customer location');

    expect(liveLocationRow).toMatchObject({
      detail: 'Within 0 m of the reservation address. Raw coordinates are hidden in the admin UI.',
      value: 'Live customer location captured',
    });
  });

  it('labels post-match cancellation review as one booking detail state', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'District 1, Ho Chi Minh City',
      addressPin: '10.7750, 106.7000',
      booking: bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedReason: 'partner_cancelled',
        matchedAt: '2026-06-19T08:00:00.000Z',
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: null,
      messageCount: 5,
    });

    expect(unifiedDetail.statusLabel).toBe('Post-match cancellation review');
    expect(unifiedDetail.summaryCards.at(-1)?.helper).toBe('Post-match cancellation review / CANCELLED');
  });

  it('resolves Partner location checkpoints from selected Partner snapshots', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture({
        closedAt: '2026-06-19T07:50:00.000Z',
        closedReason: 'partner_cancelled',
        matchedAt: '2026-06-19T07:20:00.000Z',
        snapshots: [
          {
            id: 'snapshot-match',
            bookingId: 'booking-1',
            lat: 21.036,
            lng: 105.782,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T07:18:00.000Z',
          },
          {
            id: 'snapshot-cancel',
            bookingId: 'booking-1',
            lat: 21.0362,
            lng: 105.7822,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T07:49:00.000Z',
          },
        ],
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T07:50:00.000Z',
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: {
        id: 'latest-general-location',
        lat: 10.7769,
        lng: 106.7009,
        providerProfileId: 'partner-1',
        recordedAt: '2026-06-19T07:49:30.000Z',
      } as AdminLocationSnapshot,
      messageCount: 7,
    });

    const requested = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Requested');
    const matching = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Matching location');
    const cancellation = unifiedDetail.matchedPartnerRows.find(
      (row) => row.label === 'Cancellation location',
    );

    expect(requested).toMatchObject({ value: 'Partner Matched' });
    expect(matching).toMatchObject({ value: 'Cau Giay, Ha Noi' });
    expect(matching?.detail).toContain('Captured');
    expect(cancellation).toMatchObject({ value: 'Cau Giay, Ha Noi' });
    expect(cancellation?.detail).toContain('Action');
    expect(cancellation?.detail).toContain('State');
  });

  it('prefers booking action location snapshots over generic Partner locations around closeout', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture({
        closedAt: '2026-06-19T07:50:00.000Z',
        matchedAt: '2026-06-19T07:20:00.000Z',
        snapshots: [
          {
            id: 'snapshot-action-after-closeout',
            addressText: 'Ng. 91 P. Chua Lang, Lang, Ha Noi, Vietnam',
            bookingId: 'booking-1',
            lat: 21.0245,
            lng: 105.8067,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T07:50:30.000Z',
          },
        ],
        selectedProvider: {
          displayName: 'Partner Matched',
          currentLat: 21.036,
          currentLng: 105.782,
          id: 'partner-1',
          residentialAddress: 'Partner base, Ha Noi, Vietnam',
          status: 'APPROVED',
          user: { phone: '+84911111111' },
        },
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T07:50:00.000Z',
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: {
        id: 'generic-location-before-closeout',
        addressText: '33 Nguyen Dinh Chieu, Sai Gon, Ho Chi Minh City, Vietnam',
        lat: 10.7823,
        lng: 106.6978,
        providerProfileId: 'partner-1',
        recordedAt: '2026-06-19T07:49:50.000Z',
      } as AdminLocationSnapshot,
      messageCount: 7,
    });

    const completion = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Completion location');

    expect(completion).toMatchObject({ value: 'Lang, Ha Noi' });
    expect(completion?.detail).toContain('Action');
  });

  it('does not reuse a later closeout action snapshot as the matching location', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture({
        matchedAt: '2026-06-19T07:20:00.000Z',
        snapshots: [
          {
            id: 'snapshot-action-after-closeout',
            addressText: 'Ng. 91 P. Chua Lang, Lang, Ha Noi, Vietnam',
            bookingId: 'booking-1',
            lat: 21.0245,
            lng: 105.8067,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T07:50:30.000Z',
          },
        ],
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T07:50:00.000Z',
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: null,
      messageCount: 7,
    });

    const matching = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Matching location');
    const completion = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Completion location');

    expect(matching).toMatchObject({ value: 'Location address not recorded' });
    expect(matching?.detail).toContain('No linked Partner location');
    expect(completion).toMatchObject({ value: 'Lang, Ha Noi' });
  });

  it('does not show a Partner profile address as an action location when the snapshot has no address', () => {
    const unifiedDetail = bookingUnifiedDetail({
      addressLine: 'Cau Giay, Ha Noi',
      addressPin: '21.0360, 105.7820',
      booking: bookingFixture({
        closedAt: '2026-06-19T07:50:00.000Z',
        matchedAt: '2026-06-19T07:20:00.000Z',
        snapshots: [
          {
            id: 'snapshot-action-without-address',
            bookingId: 'booking-1',
            lat: 10.7823,
            lng: 106.6978,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T07:50:10.000Z',
          },
        ],
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T07:50:00.000Z',
      }),
      financeTrace: financeTraceFixture(),
      finalPartnerSummary: finalPartnerSummaryFixture(),
      latestLocation: null,
      messageCount: 7,
    });

    const completion = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Completion location');
    const latest = unifiedDetail.matchedPartnerRows.find((row) => row.label === 'Latest location');

    expect(completion).toMatchObject({ value: 'Location address not recorded' });
    expect(completion?.detail).toContain('Action');
    expect(completion?.detail).not.toContain('Partner base');
    expect(latest).toMatchObject({ value: 'Location address not recorded' });
    expect(latest?.detail).not.toContain('Partner base');
  });
});

function bookingFixture(input: Partial<AdminBookingDetail> = {}): AdminBookingDetail {
  return {
    id: 'booking-1',
    createdAt: '2026-06-19T07:00:00.000Z',
    customerProfileId: 'customer-profile-1',
    customerProfile: {
      id: 'customer-profile-1',
      user: {
        appSessions: [{ deviceLanguage: 'vi-VN' }],
        fullName: 'Customer Nguyen',
        phone: '+84900000000',
      },
    },
    lat: 21.036,
    lng: 105.782,
    matchedAt: '2026-06-19T07:10:00.000Z',
    matchSource: 'CUSTOMER_SELECTED_PARTNER',
    notes: 'Quiet room requested',
    participants: [
      {
        id: 'participant-1',
        providerProfileId: 'partner-1',
        providerProfile: {
          displayName: 'Partner Matched',
          id: 'partner-1',
          residentialAddress: 'Partner base, Ha Noi, Vietnam',
          user: { phone: '+84911111111' },
        },
        status: 'ACCEPTED',
      },
      {
        id: 'participant-2',
        providerProfileId: 'partner-2',
        providerProfile: {
          displayName: 'Partner Backup',
          id: 'partner-2',
          user: { phone: '+84922222222' },
        },
        status: 'JOINED',
      },
    ],
    payment: {
      amount: 500000,
      currency: 'VND',
      id: 'payment-1',
      method: 'CARD',
      status: 'CAPTURED',
    },
    preferredProvider: {
      displayName: 'Partner Matched',
      id: 'partner-1',
      residentialAddress: 'Partner base, Ha Noi, Vietnam',
      user: { phone: '+84911111111' },
    },
    preferredProviderId: 'partner-1',
    selectedProvider: {
      displayName: 'Partner Matched',
      id: 'partner-1',
      residentialAddress: 'Partner base, Ha Noi, Vietnam',
      status: 'APPROVED',
      user: { phone: '+84911111111' },
    },
    selectedProviderId: 'partner-1',
    services: [
      {
        price: 500000,
        quantity: 1,
        service: {
          basePrice: 500000,
          durationMin: 90,
          name: 'Aromatherapy Massage',
        },
      },
    ],
    status: 'IN_SERVICE',
    statusChangedAt: '2026-06-19T07:20:00.000Z',
    updatedAt: '2026-06-19T07:20:00.000Z',
    ...input,
  } as AdminBookingDetail;
}

function finalPartnerSummaryFixture(): BookingFinalPartnerSummary {
  return {
    href: '/partners/partner-1',
    id: 'partner-1',
    label: 'Partner Matched',
    selected: true,
  };
}

function financeTraceFixture(): ReturnType<typeof bookingFinanceTrace> {
  return {
    companyFeeAfterTax: '70.000 VND',
    adminMinimum: '500.000 VND',
    customerPrice: '500.000 VND',
    feeCosts: '10.000 VND VAT / 20.000 VND other',
    netHandsFee: '80.000 VND',
    paymentMethod: 'CARD',
    platformFee: '100.000 VND',
    payoutRuleLine: '500.000 VND customer -> 400.000 VND Partner',
    pricingSource: 'Service payout matrix',
    providerNet: '380.000 VND / PENDING',
    providerPayout: '400.000 VND',
    serviceOption: 'Aromatherapy Massage / 90 min / qty 1',
    walletLedger: 'No entry',
    withholding: '20.000 VND',
  } as ReturnType<typeof bookingFinanceTrace>;
}

function normalizedText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
