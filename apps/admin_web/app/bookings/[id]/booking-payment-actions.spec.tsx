import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { BookingPaymentAction } from './booking-payment-actions';

describe('Booking payment actions', () => {
  it('uses shared Vuexy badge atoms instead of raw payment action pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-payment-actions.tsx', 'utf8');

    expect(source).toContain('AdminActionFormCard');
    expect(source).toContain('MoneyText');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('const debtAmount = formatMoney(Math.abs(earning.netAmount), earning.currency);');
    expect(source).not.toContain('<form action={action} className={`action-button-card');
    expect(source).not.toContain('<form action={settleBookingCashDebt} className="action-button-card');
    expect(source).not.toContain(
      "<span className={`pill ${readout?.pillClass ?? (disabled ? 'pill-neutral' : 'pill-info')}`}>",
    );
    expect(source).not.toContain('<span className="pill pill-danger">Settlement needed</span>');
  });

  it('uses a separate Finance approver select for booking refunds', () => {
    const markup = renderToStaticMarkup(
      <BookingPaymentAction
        action={async () => undefined}
        bookingId="booking-1"
        financeApproverOptions={[{ label: 'Finance Approver · approver@example.com', value: 'approver-2' }]}
        label="Refund"
        paymentId="payment-1"
        requiresApproval
      />,
    );

    expect(markup).toContain('Separate Finance approver');
    expect(markup).toContain('Finance Approver · approver@example.com');
    expect(markup).not.toContain('Different admin user id');
    expect(markup).not.toContain('No other Finance approver is available');
  });

  it('disables booking refund execution when no separate Finance approver exists', () => {
    const markup = renderToStaticMarkup(
      <BookingPaymentAction
        action={async () => undefined}
        bookingId="booking-1"
        label="Refund"
        paymentId="payment-1"
        requiresApproval
      />,
    );

    expect(markup).toContain('No other Finance approver is available');
    expect(markup).toContain('<select disabled="" name="approvalAdminId" required="">');
    expect(markup).toContain('class="admin-form-control-button button button-primary" disabled="" type="submit"');
  });
});
