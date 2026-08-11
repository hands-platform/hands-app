import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

import type { AdminPaymentDetail } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import PaymentDetailPage, { generateMetadata } from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('PaymentDetailPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'operator-current', roles: ['ADMIN'] } as never);
  });

  it('sets a non-empty payment-specific document title', async () => {
    await expect(generateMetadata({ params: Promise.resolve({ id: 'payment-1234567890' }) }))
      .resolves.toMatchObject({ title: { absolute: 'Payment payment- | HANDS Admin' } });
  });

  it('renders payment evidence sections with Vuexy operation panels', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: paymentDetail(), ok: true, status: 200 });

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
    mockedAdminGetResult.mockResolvedValue({ data: paymentDetail(), ok: true, status: 200 });

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

  it('submits a refund request for independent review without selecting an approver', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: paymentDetail(), ok: true, status: 200 });

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({ confirm: 'refund' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Request refund review for payment');
    expect(markup).toContain('Finance Approval Queue');
    expect(markup).toContain('Operator reason');
    expect(markup).toContain('admin-payment-actions-v1');
    expect(markup).toContain('idempotencyKey');
    expect(markup).not.toContain('Separate Finance approver');
    expect(markup).not.toContain('approvalAdminId');
    expect(mockedAdminGetResult).not.toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('renders non-cash fee settlement as not applicable', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { ...paymentDetail(), method: 'VNPAY' },
      ok: true,
      status: 200,
    });

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cash fee gate: </span>N/A');
    expect(markup).toContain('Cash collection and Partner fee settlement do not apply to this payment method.');
  });

  it('fails closed when payment detail cannot be loaded', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: null, ok: false, status: 503 });

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({ confirm: 'capture' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Payment detail unavailable');
    expect(markup).toContain('No payment action is available from fallback data.');
    expect(markup).not.toContain('Capture payment');
  });

  it('replaces a duplicate refund request action with the active refund case', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...paymentDetail(),
        refunds: [{
          amount: 300000,
          bookingId: 'booking-1',
          createdAt: '2026-08-09T08:00:00.000Z',
          currency: 'VND',
          id: 'refund-active-1',
          paymentId: 'payment-1',
          status: 'REQUESTED',
        }],
      },
      ok: true,
      status: 200,
    });

    const page = await PaymentDetailPage({
      params: Promise.resolve({ id: 'payment-1' }),
      searchParams: Promise.resolve({ confirm: 'refund' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Refund review pending');
    expect(markup).toContain('Open active refund');
    expect(markup).toContain('refund-active-1');
    expect(markup).toContain('/refunds?q=refund-active-1&amp;range=all&amp;review=open&amp;sort=oldest#refund-refund-active-1');
    expect(markup).not.toContain('Request refund review');
    expect(markup).not.toContain('payment-detail-refund-payment-1');
  });
});

function paymentDetail(): AdminPaymentDetail {
  return {
    actionDecisions: [
      {
        action: 'REQUEST_REFUND',
        policyVersion: 'admin-payment-actions-v1',
        reason: 'Captured funds require Finance Approval Queue review before refund execution.',
        reasonCode: 'REFUND_REVIEW_REQUIRED',
        recommended: true,
        requiredEvidence: ['operator reason', 'booking evidence'],
        state: 'REVIEW_REQUIRED',
        verifiedAt: '2026-06-09T10:11:00.000Z',
      },
    ],
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
    evidence: {
      label: 'Cash collection evidence',
      reason: 'Cash collection does not use a gateway callback.',
      state: 'NOT_APPLICABLE',
      verifiedAt: null,
    },
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
