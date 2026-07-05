import { AdminFormControlButton, AdminFormInput } from '../../../components/admin-form-controls';
import { AdminActionFormCard } from '../../../components/admin-surface';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import type { AdminBookingDetail } from '../../../lib/admin-api';
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
  requiresApproval = false,
}: {
  action: (...args: [FormData]) => Promise<void>;
  bookingId: string;
  paymentId: string;
  label: string;
  disabled?: boolean;
  readout?: BookingPaymentActionReadout;
  evidenceHint?: string;
  ruleHint?: string;
  requiresApproval?: boolean;
}) {
  return (
    <AdminActionFormCard action={action} className={readout?.className}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <StatusBadge
          tone={statusBadgeToneFromPillClass(readout?.pillClass ?? (disabled ? 'pill-neutral' : 'pill-info'))}
        >
          {readout?.status ?? (disabled ? 'Locked' : 'Available')}
        </StatusBadge>
        <strong>{label}</strong>
        <p className="muted">
          {evidenceHint ?? readout?.evidence ?? 'Payment action state is derived from the booking.'}
        </p>
      </div>
      {requiresApproval ? (
        <AdminFormInput
          label="Approving admin id"
          name="approvalAdminId"
          placeholder="Different admin user id"
          required
        />
      ) : null}
      <AdminFormControlButton disabled={disabled} type="submit">
        {label}
      </AdminFormControlButton>
      <small>{ruleHint ?? readout?.operatorRule ?? 'Use retained booking evidence before changing payment state.'}</small>
    </AdminActionFormCard>
  );
}

export function BookingCashDebtSettlementForm({ booking }: { booking: AdminBookingDetail }) {
  const earning = booking.earning;
  if (!earning) {
    return null;
  }

  const settlementRef = `HANDS-CASH-${shortId(booking.id).toUpperCase()}`;
  const debtAmountValue = Math.abs(earning.netAmount);
  const debtAmountLabel = formatMoney(debtAmountValue, earning.currency);

  return (
    <AdminActionFormCard action={settleBookingCashDebt} className="ops-task-blocked">
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="earningId" value={earning.id} />
      <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
      <div>
        <StatusBadge tone="danger">Settlement needed</StatusBadge>
        <strong>Settle cash fee debt</strong>
        <p className="muted">
          Partner cash collection created a negative wallet fee. Confirm deposit or admin offset evidence.
        </p>
        <p className="muted">
          Cash fee debt <MoneyText amount={debtAmountValue} currency={earning.currency} />
        </p>
      </div>
      <AdminFormInput
        label="Cash debt settlement reference"
        name="settlementRef"
        defaultValue={settlementRef}
        placeholder={settlementRef}
      />
      <AdminFormInput
        label="Cash debt settlement notes"
        name="settlementNotes"
        defaultValue={`Partner deposited ${debtAmountLabel} with ${settlementRef}`}
        placeholder={`Partner deposited ${debtAmountLabel}`}
      />
      <AdminFormControlButton type="submit">Settle cash debt</AdminFormControlButton>
    </AdminActionFormCard>
  );
}
