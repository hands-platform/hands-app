import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminPaymentDetail } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import PaymentDetailPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('PaymentDetailPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders payment evidence sections with Vuexy operation panels', async () => {
    mockedAdminGet.mockResolvedValue(paymentDetail());

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Payment operation detail');
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section" id="booking-evidence"',
    );
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section" id="money-ledger"',
    );
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section" id="chat-payment-evidence"',
    );
    expect(markup).toContain(
      'class="card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section" id="payment-audit-log"',
    );
    expect(markup).toContain('class="table vuexy-data-table vuexy-booking-table"');
    expect(markup).not.toContain('class="card" id="booking-evidence"');
    expect(markup).not.toContain('class="card" id="money-ledger"');
    expect(markup).not.toContain('class="card admin-mb-16" id="chat-payment-evidence"');
    expect(markup).not.toContain('class="card" id="payment-audit-log"');
    expect(markup).not.toContain('class="table"><thead><tr><th>Time</th>');
  });
});

function paymentDetail(): AdminPaymentDetail {
  return {
    amount: 300000,
    auditLogs: [
      {
        action: 'PAYMENT_REVIEWED',
        actor: { fullName: 'Ops Admin' },
        createdAt: '2026-06-09T10:10:00.000Z',
        id: 'audit-1',
        metadata: { reason: 'manual check' },
        target: 'payment-1',
      },
    ],
    bookingId: 'booking-1',
    callbackAttempts: [],
    currency: 'VND',
    id: 'payment-1',
    method: 'CASH',
    providerRef: 'gateway-ref-1',
    refunds: [],
    status: 'CAPTURED',
    booking: {
      addressSnapshot: {
        addressText: 'Cau Giay, Hanoi',
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
        id: 'address-1',
        latitude: 21.03,
        longitude: 105.78,
      },
      chatRoom: {
        id: 'room-1',
        messages: [
          {
            body: 'Customer confirmed cash payment.',
            createdAt: '2026-06-09T10:05:00.000Z',
            id: 'message-1',
            sender: { fullName: 'Demo Customer', id: 'user-1' },
          },
        ],
      },
      customerProfile: {
        id: 'customer-1',
        user: {
          fullName: 'Demo Customer',
          phone: '+84900000001',
        },
      },
      customerProfileId: 'customer-1',
      earning: {
        bookingId: 'booking-1',
        currency: 'VND',
        grossAmount: 300000,
        id: 'earning-1',
        netAmount: 220000,
        platformFee: 60000,
        providerProfileId: 'partner-1',
        settlementRef: 'SETTLED-1',
        status: 'PAID',
        withholdingAmount: 20000,
      },
      id: 'booking-1',
      selectedProvider: {
        displayName: 'Demo Partner',
        id: 'partner-1',
        user: {
          fullName: 'Demo Partner',
          phone: '+84900000002',
        },
      },
      selectedProviderId: 'partner-1',
      services: [
        {
          price: 300000,
          quantity: 1,
          service: {
            basePrice: 300000,
            durationMin: 60,
            name: 'Massage',
            priceStep: 100000,
          },
        },
      ],
      status: 'COMPLETED',
    },
  };
}
