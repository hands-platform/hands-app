import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingUnifiedDetail } from './booking-unified-detail';
import { BookingUnifiedDetailSection } from './booking-unified-detail-section';
import type { BookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';

describe('BookingUnifiedDetailSection', () => {
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
    expect(rendered).toContain('Partner Matched');
    expect(rendered).toContain('Partner base, Ha Noi');
    expect(rendered).toContain('2 Partners');
    expect(rendered).toContain('Cau Giay, Ha Noi');
    expect(rendered).toContain('500.000 VND');
    expect(markup).toContain('id="booking-customer-detail"');
    expect(markup).toContain('id="booking-matched-partner-detail"');
    expect(markup).toContain('id="booking-finance-system-detail"');
    expect(markup).toContain('booking-unified-participant-strip');
    expect(markup).toContain('aria-label="Participating Partners"');
    expect(markup).toContain('href="/customers/customer-profile-1"');
    expect(markup).toContain('href="/partners/partner-1"');
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
    customerPrice: '500.000 VND',
    feeCosts: '10.000 VND VAT / 20.000 VND other',
    netHandsFee: '80.000 VND',
    paymentMethod: 'CARD',
    platformFee: '100.000 VND',
    providerNet: '380.000 VND / PENDING',
    providerPayout: '400.000 VND',
    serviceOption: 'Aromatherapy Massage / 90 min / qty 1',
    walletLedger: 'No entry',
    withholding: '20.000 VND',
  } as ReturnType<typeof bookingFinanceTrace>;
}

function normalizedText(markup: string) {
  return markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
