'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';

import { AdminDetails } from '../../components/admin-details';
import { CommandCopyButton } from '../../components/command-copy-button';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type {
  AdminManualWalletAdjustmentOpenPeriod,
  AdminManualWalletAdjustmentPolicy,
  AdminManualWalletAdjustmentRequest,
} from '../../lib/admin-api';
import {
  previewManualWalletAdjustment,
  submitManualWalletAdjustmentRequest,
  type WalletAdjustmentActionState,
} from './actions';
import { walletAdjustmentFormKey } from './wallet-adjustment-form-key';

type Props = {
  readonly idempotencyKey: string;
  readonly openPeriods: readonly AdminManualWalletAdjustmentOpenPeriod[];
  readonly original: AdminManualWalletAdjustmentRequest;
  readonly policy: AdminManualWalletAdjustmentPolicy;
};

const initialState: WalletAdjustmentActionState = { status: 'idle' };

export function WalletAdjustmentReversalWorkspace({ idempotencyKey, openPeriods, original, policy }: Props) {
  const [reason, setReason] = useState('');
  const [operationalCause, setOperationalCause] = useState('');
  const [expectedCorrection, setExpectedCorrection] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [monthlyPeriod, setMonthlyPeriod] = useState(openPeriods[0]?.period ?? '');
  const [previewState, previewAction, previewPending] = useActionState(previewManualWalletAdjustment, initialState);
  const [submitState, submitAction, submitPending] = useActionState(submitManualWalletAdjustmentRequest, initialState);
  const errorRef = useRef<HTMLDivElement>(null);
  const direction = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
  const inputKey = walletAdjustmentFormKey({
    adjustmentType: 'MANUAL_REVERSAL',
    amount: String(original.amount),
    attachmentFileId: '',
    attachmentFileName,
    attachmentUrl: '',
    caseReference,
    direction,
    expectedCorrection,
    monthlyPeriod,
    operationalCause,
    ownerId: original.ownerId,
    ownerType: original.ownerType,
    reason,
    reversalOfRequestId: original.id,
  });
  const preview = previewState.status === 'success' && previewState.inputKey === inputKey
    ? previewState.preview
    : undefined;
  const error = submitState.status === 'error' ? submitState : previewState;

  useEffect(() => {
    if (error.status === 'error') errorRef.current?.focus();
  }, [error.status]);

  return (
    <section aria-labelledby="wallet-reversal-title" className="wallet-adjustment-create-stage">
      <div className="wallet-adjustment-section-heading">
        <div>
          <h2 id="wallet-reversal-title">Create reversal approval request</h2>
          <p>The original owner, amount, opposite direction, and accounting entries are fixed.</p>
        </div>
        <StatusBadge tone="warning">Separate approval required</StatusBadge>
      </div>

      <div className="wallet-adjustment-selected-owner" aria-label="Original executed adjustment">
        <div>
          <span>Original request</span>
          <strong>{shortId(original.id)}</strong>
          <small><CommandCopyButton label="Copy original request ID" value={original.id} /></small>
        </div>
        <div>
          <span>Original ledger</span>
          <strong>{shortId(original.ledgerEntryId ?? '')}</strong>
          <small>{original.ledgerEntryId ? <CommandCopyButton label="Copy original ledger ID" value={original.ledgerEntryId} /> : 'Ledger evidence missing'}</small>
        </div>
        <div><span>Wallet owner</span><strong>{original.ownerName ?? original.ownerReference ?? shortId(original.ownerId)}</strong><small>{original.ownerMaskedPhone ?? original.ownerReference ?? sentenceCase(original.ownerType)}</small></div>
        <div><span>Fixed reversal</span><strong>{direction === 'CREDIT' ? 'Add balance' : 'Deduct balance'}</strong><small><MoneyText amount={original.amount} currency={original.currency} /></small></div>
        <div><span>Original balance</span><strong><MoneyText amount={original.requestedBeforeBalance} currency={original.currency} /> to <MoneyText amount={original.requestedAfterBalance} currency={original.currency} /></strong><small>Executed {original.executedAt ? new Date(original.executedAt).toLocaleString('en-GB') : 'time unavailable'}</small></div>
        <div><span>Original accounting month</span><strong>{original.monthlyPeriod ?? 'Legacy · period missing'}</strong><small>{original.monthlyPeriod ? 'Stored execution period' : 'Cannot infer a period'}</small></div>
        <div><span>Maker / approver</span><strong>{original.requestedBy?.fullName ?? shortId(original.requestedByAdminId)}</strong><small>{original.approvedBy?.fullName ?? original.approvedByAdminId ?? 'Approver unavailable'}</small></div>
        <div><span>Original evidence</span><strong>{original.attachmentFileId || original.attachmentUrl ? 'Attached' : 'Not attached'}</strong><small>{original.attachmentFile?.originalName ?? (original.attachmentUrl ? 'Legacy URL evidence' : 'No original evidence')}</small></div>
      </div>

      {error.status === 'error' ? (
        <div className="admin-mb-16" ref={errorRef} tabIndex={-1}>
          <AdminInlineNotice role="alert" tone="danger">
            <h3>Reversal needs attention</h3><p>{error.message}</p>
          </AdminInlineNotice>
        </div>
      ) : null}

      <AdminFormShell
        action={submitAction}
        className="wallet-adjustment-create-grid"
        onReset={(event) => event.preventDefault()}
      >
        <input name="adjustmentType" type="hidden" value="MANUAL_REVERSAL" />
        <input name="amount" type="hidden" value={original.amount} />
        <input name="direction" type="hidden" value={direction} />
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <input name="ownerId" type="hidden" value={original.ownerId} />
        <input name="ownerType" type="hidden" value={original.ownerType} />
        <input name="reversalOfRequestId" type="hidden" value={original.id} />
        <input name="attachmentFileId" type="hidden" value={preview?.attachmentFileId ?? ''} />
        <input name="attachmentFileName" type="hidden" value={attachmentFileName} />
        <input name="attachmentUrl" type="hidden" value="" />

        <div className="wallet-adjustment-input-panel wallet-adjustment-field-grid">
          <AdminFormSelect
            className="wallet-adjustment-field"
            label="Accounting month"
            labelVisibility="visible"
            name="monthlyPeriod"
            onChange={(event) => setMonthlyPeriod(event.target.value)}
            options={openPeriods.map((period) => ({
              label: `${period.period} · ${sentenceCase(period.status)}`,
              value: period.period,
            }))}
            required
            value={monthlyPeriod}
          />
          <AdminFormInput
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="wallet-adjustment-field"
            label="Reversal evidence file"
            labelVisibility="visible"
            name="attachmentFile"
            onChange={(event) => setAttachmentFileName(event.target.files?.[0]?.name ?? '')}
            type="file"
          />
          <AdminFormInput
            className="wallet-adjustment-field"
            label="Operational cause"
            labelVisibility="visible"
            name="operationalCause"
            onChange={(event) => setOperationalCause(event.target.value)}
            required
            value={operationalCause}
          />
          <AdminFormInput
            className="wallet-adjustment-field"
            label="Expected correction"
            labelVisibility="visible"
            name="expectedCorrection"
            onChange={(event) => setExpectedCorrection(event.target.value)}
            required
            value={expectedCorrection}
          />
          <AdminFormInput
            className="wallet-adjustment-field"
            label="Case / incident reference"
            labelVisibility="visible"
            name="caseReference"
            onChange={(event) => setCaseReference(event.target.value)}
            placeholder="Optional case ID"
            value={caseReference}
          />
          <div className="wallet-adjustment-reason-field">
            <AdminFormTextarea
              className="wallet-adjustment-field"
              label="Reversal reason"
              labelVisibility="visible"
              maxLength={policy.constraints.reasonMaxLength}
              name="reason"
              onChange={(event) => setReason(event.target.value)}
              required
              rows={5}
              value={reason}
            />
            <small>Explain why the executed adjustment must be reversed. {reason.length}/{policy.constraints.reasonMaxLength}</small>
          </div>
          {attachmentFileName ? <AdminInlineNotice role="status" tone="success">Selected private evidence: {attachmentFileName}</AdminInlineNotice> : null}
        </div>

        <aside aria-label="Reversal accounting review" className="wallet-adjustment-preview-panel">
          <div className="wallet-adjustment-preview-heading">
            <div><h3>Review reversal</h3><p>No balance changes until a separate approver executes the request.</p></div>
            <StatusBadge tone={preview ? 'success' : 'warning'}>{preview ? 'Current preview' : 'Review required'}</StatusBadge>
          </div>
          {preview ? (
            <>
              <dl className="wallet-adjustment-preview-facts">
                <div><dt>Before</dt><dd><MoneyText amount={preview.beforeBalance} currency={preview.currency} /></dd></div>
                <div><dt>After</dt><dd><MoneyText amount={preview.afterBalance} currency={preview.currency} /></dd></div>
                <div><dt>Reversal delta</dt><dd><MoneyText amount={preview.walletDelta} currency={preview.currency} /></dd></div>
                <div><dt>Accounting month</dt><dd>{preview.monthlyPeriod}</dd></div>
                <div><dt>Period status</dt><dd>{sentenceCase(preview.monthlyPeriodStatus ?? 'unknown')}</dd></div>
                <div><dt>Bank / cash</dt><dd>No movement</dd></div>
              </dl>
              <AdminDetails className="wallet-adjustment-accounting-details" name="wallet-adjustment-reversal-preview">
                <summary>Reversed accounting entries</summary>
                {preview.accountingEntries.map((entry) => (
                  <p key={`${entry.accountDebit}:${entry.accountCredit}`}><strong>{entry.accountDebit}</strong> / {entry.accountCredit}</p>
                ))}
              </AdminDetails>
              <p className="wallet-adjustment-preview-confirmation"><ShieldCheck aria-hidden="true" size={18} /> Original execution evidence was revalidated.</p>
            </>
          ) : (
            <div className="wallet-adjustment-preview-empty"><RotateCcw aria-hidden="true" size={22} /><p>Review the fixed reversal before creating the approval request.</p></div>
          )}
          <div className="wallet-adjustment-create-actions">
            <AdminFormControlButton disabled={previewPending} formAction={previewAction}>{previewPending ? 'Reviewing...' : 'Review reversal'}</AdminFormControlButton>
            <AdminFormControlButton className="button-success" disabled={!preview || submitPending}>{submitPending ? 'Creating...' : 'Create reversal request'}</AdminFormControlButton>
          </div>
        </aside>
      </AdminFormShell>
    </section>
  );
}

function shortId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function sentenceCase(value: string) {
  const normalized = value.toLowerCase().replaceAll('_', ' ');
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}
