import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
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
    expect(markup).toContain('class="table vuexy-data-table vuexy-booking-table admin-data-table"');
    expect(markup).not.toContain('class="card" id="booking-evidence"');
    expect(markup).not.toContain('class="card" id="money-ledger"');
    expect(markup).not.toContain('class="card admin-mb-16" id="chat-payment-evidence"');
    expect(markup).not.toContain('class="card" id="payment-audit-log"');
    expect(markup).not.toContain('class="table"><thead><tr><th>Time</th>');
  });

  it('uses the shared Vuexy table panel wrapper for payment evidence sections', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
  });

  it('uses shared badge atoms for payment detail evidence labels', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-warn">Chat</span>');
    expect(source).not.toContain('<span className="pill pill-info">{label}</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{key}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{formatDate(message.createdAt)}</span>');
  });

  it('uses the shared Vuexy stage item atom for payment detail row surfaces', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).not.toContain('<div className="setup-stage-list');
    expect(source).not.toContain('className="setup-stage-item"');
  });

  it('uses the shared DateTimeText atom for visible payment evidence timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<StatusBadge tone="info">{formatDate(message.createdAt)}</StatusBadge>');
    expect(source).not.toContain('<td>{formatDate(row.createdAt)}</td>');
  });

  it('uses the shared MoneyText atom for visible payment ledger amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('paymentMoney');
    expect(source).toContain('Partner owes <MoneyText amount={amount} currency={payment.currency} />');
    expect(source).toContain('Booked <MoneyText amount={item?.price} currency={payment.currency} />');
    expect(source).not.toContain("value={money(earning?.grossAmount ?? payment.amount, payment.currency)}");
    expect(source).not.toContain("value={money(earning?.platformFee, earning?.currency ?? payment.currency)}");
    expect(source).not.toContain("value={money(earning?.withholdingAmount, earning?.currency ?? payment.currency)}");
    expect(source).not.toContain("value={money(earning?.netAmount, earning?.currency ?? payment.currency)}");
    expect(source).not.toContain('return `Partner owes ${money(amount, payment.currency)}');
    expect(source).not.toContain('`Booked ${money(item?.price, payment.currency)}`');
  });

  it('uses shared atoms for visible payment refund summary rows', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('<MoneyText amount={refund.amount} currency={payment.currency} />');
    expect(source).toContain('<DateTimeText value={refund.createdAt} />');
    expect(source).not.toContain(
      '`${refund.status} ${money(refund.amount, payment.currency)} ${formatDate(refund.createdAt)}`',
    );
  });

  it('uses the shared Vuexy form control link for button-style payment actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('uses the shared Vuexy text link atom for payment detail record links', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('uses shared grid wrappers for payment metrics and evidence panels', async () => {
    mockedAdminGet.mockResolvedValue(paymentDetail());

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(markup).toContain('admin-metric-grid admin-mb-16');
    expect(markup).toContain('detail-grid admin-mb-16');
    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<section className="grid admin-mb-16">');
  });

  it('uses the shared inline fallback atom for missing callback payloads', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/[id]/page.tsx'), 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('<span className="muted">No payload saved.</span>');
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
