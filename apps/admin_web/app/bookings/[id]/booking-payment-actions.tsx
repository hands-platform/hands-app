import { AdminBookingDetail } from '../../../lib/admin-api';
import { formatMoney, shortId } from '../../../lib/admin-format';
import { settleBookingCashDebt } from './actions';

type BookingPaymentActionReadout = {
  className: string;
  pillClass: string;
  status: string;
  evidence: string;
  operatorRule: string;
};

export function BookingPaymentAction({
  action,
  bookingId,
  paymentId,
  label,
  disabled,
  readout,
  evidenceHint,
  ruleHint,
}: {
  action: (...args: [FormData]) => Promise<void>;
  bookingId: string;
  paymentId: string;
  label: string;
  disabled?: boolean;
  readout?: BookingPaymentActionReadout;
  evidenceHint?: string;
  ruleHint?: string;
}) {
  return (
    <form action={action} className={`action-button-card ${readout?.className ?? ''}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <span className={`pill ${readout?.pillClass ?? (disabled ? 'pill-neutral' : 'pill-info')}`}>
          {readout?.status ?? (disabled ? 'Locked' : 'Available')}
        </span>
        <strong>{label}</strong>
        <p className="muted">
          {evidenceHint ?? readout?.evidence ?? 'Payment action state is derived from the booking.'}
        </p>
      </div>
      <button type="submit" disabled={disabled}>
        {label}
      </button>
      <small>{ruleHint ?? readout?.operatorRule ?? 'Use retained booking evidence before changing payment state.'}</small>
    </form>
  );
}

export function BookingCashDebtSettlementForm({ booking }: { booking: AdminBookingDetail }) {
  const earning = booking.earning;
  if (!earning) {
    return null;
  }

  const settlementRef = `HANDS-CASH-${shortId(booking.id).toUpperCase()}`;
  const debtAmount = formatMoney(Math.abs(earning.netAmount), earning.currency);

  return (
    <form action={settleBookingCashDebt} className="action-button-card ops-task-blocked">
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="earningId" value={earning.id} />
      <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
      <div>
        <span className="pill pill-danger">Settlement needed</span>
        <strong>Settle cash fee debt</strong>
        <p className="muted">
          Partner cash collection created a negative wallet fee. Confirm deposit or admin offset evidence.
        </p>
      </div>
      <input
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
        aria-label="Cash debt settlement reference"
      />
      <input
        name="settlementNotes"
        defaultValue={`Partner deposited ${debtAmount} with ${settlementRef}`}
        placeholder={`Partner deposited ${debtAmount}`}
        aria-label="Cash debt settlement notes"
      />
      <button type="submit">Settle cash debt</button>
    </form>
  );
}
