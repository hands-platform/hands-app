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

  it('submits booking refunds as queue requests without exposing approver selection', () => {
    const markup = renderToStaticMarkup(
      <BookingPaymentAction
        action={async () => undefined}
        bookingId="booking-1"
        label="Request refund"
        paymentId="payment-1"
      />,
    );

    expect(markup).toContain('Request refund');
    expect(markup).not.toContain('Separate Finance approver');
    expect(markup).not.toContain('approvalAdminId');
    expect(markup).not.toContain('Different admin user id');
  });
});
