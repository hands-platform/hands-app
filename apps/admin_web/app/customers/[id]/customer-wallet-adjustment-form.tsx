'use client';

import type { ChangeEvent, MouseEvent } from 'react';
import { useState } from 'react';
import { ArrowUpFromLine } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminNotePanel } from '../../../components/admin-surface';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge } from '../../../components/status-badge';
import { createManualWalletAdjustment } from '../../wallet-adjustments/actions';
import { formatMoney } from '../../../lib/admin-format';
import type { AdminManualWalletAdjustmentOpenPeriod } from '../../../lib/admin-api';

const CUSTOMER_WALLET_DIRECTION_OPTIONS = [
  { label: 'Add balance (Credit)', value: 'CREDIT' },
  { label: 'Remove balance (Debit)', value: 'DEBIT' },
] as const;

const CUSTOMER_WALLET_ADJUSTMENT_TYPE_OPTIONS = [
  { label: 'Promotion credit', value: 'PROMOTION_CREDIT' },
  { label: 'Customer compensation', value: 'CUSTOMER_COMPENSATION' },
  { label: 'Referral correction', value: 'REFERRAL_CORRECTION' },
  { label: 'Error correction', value: 'ERROR_CORRECTION' },
] as const;

type CustomerWalletAdjustmentFormProps = {
  readonly currentBalance: number;
  readonly customerId: string;
  readonly customerLabel: string;
  readonly operatorLabel: string;
  readonly openPeriods: readonly AdminManualWalletAdjustmentOpenPeriod[];
  readonly returnTo: string;
};

export function CustomerWalletAdjustmentForm({
  currentBalance,
  customerId,
  customerLabel,
  operatorLabel,
  openPeriods,
  returnTo,
}: CustomerWalletAdjustmentFormProps) {
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState('');
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());
  const [reviewed, setReviewed] = useState(false);
  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const signedAmount = direction === 'CREDIT' ? validAmount : -validAmount;
  const afterBalance = currentBalance + signedAmount;

  function resetReview() {
    setReviewed(false);
  }

  function handleDirectionChange(event: ChangeEvent<HTMLSelectElement>) {
    setDirection(event.target.value === 'DEBIT' ? 'DEBIT' : 'CREDIT');
    resetReview();
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(event.target.value);
    resetReview();
  }

  function handlePrepareReview(event: MouseEvent<HTMLButtonElement>) {
    if (!event.currentTarget.form?.reportValidity()) return;
    setReviewed(true);
  }

  return (
    <AdminFormGrid action={createManualWalletAdjustment} className="customer-wallet-adjustment-form">
      <input name="ownerType" type="hidden" value="CUSTOMER" />
      <input name="ownerId" type="hidden" value={customerId} />
      <input name="redirectTo" type="hidden" value={returnTo} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <AdminFormInput
        disabled
        label="Customer"
        labelVisibility="visible"
        name="customerLabel"
        value={customerLabel}
      />
      <AdminFormSelect
        label="Balance action"
        labelVisibility="visible"
        name="direction"
        onChange={handleDirectionChange}
        options={CUSTOMER_WALLET_DIRECTION_OPTIONS}
        required
        value={direction}
      />
      <AdminFormSelect
        defaultValue="CUSTOMER_COMPENSATION"
        label="Adjustment type"
        labelVisibility="visible"
        name="adjustmentType"
        onChange={resetReview}
        options={CUSTOMER_WALLET_ADJUSTMENT_TYPE_OPTIONS}
        required
      />
      <AdminFormInput
        label="Amount (VND)"
        labelVisibility="visible"
        min={1}
        name="amount"
        onChange={handleAmountChange}
        placeholder="100000"
        required
        step={1}
        type="number"
        value={amount}
      />
      <AdminFormSelect
        defaultValue={openPeriods[0]?.period ?? ''}
        label="Accounting month"
        labelVisibility="visible"
        name="monthlyPeriod"
        onChange={resetReview}
        options={openPeriods.map((period) => ({
          label: `${period.period} · ${period.status === 'DRAFT' ? 'Draft' : 'Reviewed'}`,
          value: period.period,
        }))}
        required
      />
      <AdminFormInput
        accept="application/pdf,image/jpeg,image/png,image/webp"
        label="Evidence file"
        labelVisibility="visible"
        name="attachmentFile"
        onChange={resetReview}
        type="file"
      />
      <p className="muted admin-grid-span-2 customer-wallet-evidence-rule">
        PDF, JPEG, PNG, or WebP up to 10 MB. Evidence is required from 10,000,000 VND.
      </p>
      <AdminFormInput
        label="Operational cause"
        labelVisibility="visible"
        name="operationalCause"
        onChange={resetReview}
        required
      />
      <AdminFormInput
        label="Expected correction"
        labelVisibility="visible"
        name="expectedCorrection"
        onChange={resetReview}
        required
      />
      <AdminFormInput
        className="admin-grid-span-2"
        label="Case / incident reference"
        labelVisibility="visible"
        name="caseReference"
        onChange={resetReview}
        placeholder="Optional case ID"
      />
      <AdminFormTextarea
        className="admin-grid-span-2"
        label="Reason"
        labelVisibility="visible"
        maxLength={500}
        minLength={12}
        name="reason"
        onChange={resetReview}
        placeholder="State the operational reason for the immutable audit record"
        required
        rows={3}
      />

      <AdminNotePanel
        className={`admin-grid-span-2 customer-wallet-balance-preview ops-task-${
          afterBalance < 0 ? 'warning' : reviewed ? 'success' : 'info'
        }`}
      >
        <div>
          <span>Before</span>
          <strong>
            <MoneyText amount={currentBalance} />
          </strong>
        </div>
        <div>
          <span>{direction === 'CREDIT' ? 'Credit' : 'Debit'}</span>
          <strong>
            {signedAmount >= 0 ? '+' : '-'}
            <MoneyText amount={Math.abs(signedAmount)} />
          </strong>
        </div>
        <div>
          <span>After</span>
          <strong>
            <MoneyText amount={afterBalance} />
          </strong>
        </div>
        <StatusBadge tone={reviewed ? 'success' : afterBalance < 0 ? 'warning' : 'neutral'}>
          {reviewed ? 'Ready to request' : afterBalance < 0 ? 'Negative balance' : 'Review required'}
        </StatusBadge>
      </AdminNotePanel>

      <div className="actions form-grid-wide customer-wallet-adjustment-actions">
        <span className="muted">
          Requested by {operatorLabel}. A different finance approver must review the request before any
          wallet ledger or accounting journal is created.
        </span>
        <AdminFormControlButton
          className={reviewed ? undefined : 'button-secondary'}
          onClick={reviewed ? undefined : handlePrepareReview}
          type={reviewed ? 'submit' : 'button'}
        >
          <ArrowUpFromLine aria-hidden="true" size={16} />
          {reviewed
            ? `Create approval request for ${formatMoney(validAmount)}`
            : 'Review balance change'}
        </AdminFormControlButton>
      </div>
    </AdminFormGrid>
  );
}
