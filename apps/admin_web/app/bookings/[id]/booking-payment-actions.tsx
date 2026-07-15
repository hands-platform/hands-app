import { AdminFormControlButton, AdminFormInput, AdminFormSelect } from '../../../components/admin-form-controls';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminActionFormCard } from '../../../components/admin-surface';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatMoney, shortId } from '../../../lib/admin-format';
import type { FinanceApproverOption } from '../../finance-tax/finance-approver-options';
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
  financeApproverOptions = [],
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
  financeApproverOptions?: readonly FinanceApproverOption[];
}) {
  const approvalUnavailable = requiresApproval && financeApproverOptions.length === 0;

  return (
    <AdminActionFormCard action={action} className={readout?.className}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <StatusBadgeFromPillClass pillClass={readout?.pillClass ?? (disabled ? 'pill-neutral' : 'pill-info')}>
          {readout?.status ?? (disabled ? 'Locked' : 'Available')}
        </StatusBadgeFromPillClass>
        <strong>{label}</strong>
        <p className="muted">
          {evidenceHint ?? readout?.evidence ?? 'Payment action state is derived from the booking.'}
        </p>
      </div>
      {requiresApproval ? (
        <AdminFormSelect
          disabled={approvalUnavailable}
          label="Separate Finance approver"
          name="approvalAdminId"
          options={[{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]}
          required
        />
      ) : null}
      {approvalUnavailable ? (
        <AdminInlineNotice role="alert" tone="warning">
          No other Finance approver is available. Refund execution is disabled.
        </AdminInlineNotice>
      ) : null}
      <AdminFormControlButton disabled={disabled || approvalUnavailable} type="submit">
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
