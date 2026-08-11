'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, X } from 'lucide-react';

import { AdminDetails } from '../../components/admin-details';
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
  AdminManualWalletAdjustmentDirection,
  AdminManualWalletAdjustmentOwnerOption,
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentOpenPeriod,
  AdminManualWalletAdjustmentPolicy,
  AdminManualWalletAdjustmentType,
} from '../../lib/admin-api';
import {
  previewManualWalletAdjustment,
  searchWalletAdjustmentOwners,
  submitManualWalletAdjustmentRequest,
} from './actions';
import type { WalletAdjustmentActionState, WalletOwnerSearchState } from './actions';
import { walletAdjustmentFormKey } from './wallet-adjustment-form-key';

type Props = {
  readonly idempotencyKey: string;
  readonly openPeriods: readonly AdminManualWalletAdjustmentOpenPeriod[];
  readonly policy: AdminManualWalletAdjustmentPolicy;
};

const ownerOptions: Array<{ label: string; value: AdminManualWalletAdjustmentOwnerType }> = [
  { label: 'Partner wallet', value: 'PARTNER' },
  { label: 'Customer wallet', value: 'CUSTOMER' },
];
const directionOptions: Array<{ label: string; value: AdminManualWalletAdjustmentDirection }> = [
  { label: 'Add balance (+)', value: 'CREDIT' },
  { label: 'Deduct balance (-)', value: 'DEBIT' },
];
const initialActionState: WalletAdjustmentActionState = { status: 'idle' };
const initialSearchState: WalletOwnerSearchState = { owners: [], status: 'idle' };

export function WalletAdjustmentCreateWorkspace({ idempotencyKey, openPeriods, policy }: Props) {
  const [ownerType, setOwnerType] = useState<AdminManualWalletAdjustmentOwnerType>('PARTNER');
  const [direction, setDirection] = useState<AdminManualWalletAdjustmentDirection>('CREDIT');
  const [selectedOwner, setSelectedOwner] = useState<AdminManualWalletAdjustmentOwnerOption | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdminManualWalletAdjustmentType>('PARTNER_BONUS');
  const [amount, setAmount] = useState('');
  const [monthlyPeriod, setMonthlyPeriod] = useState(openPeriods[0]?.period ?? '');
  const [attachmentFileName, setAttachmentFileName] = useState('');
  const [operationalCause, setOperationalCause] = useState('');
  const [expectedCorrection, setExpectedCorrection] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [reason, setReason] = useState('');
  const [searchState, searchAction, searchPending] = useActionState(
    searchWalletAdjustmentOwners,
    initialSearchState,
  );
  const [previewState, previewAction, previewPending] = useActionState(
    previewManualWalletAdjustment,
    initialActionState,
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitManualWalletAdjustmentRequest,
    initialActionState,
  );
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const adjustmentStageRef = useRef<HTMLHeadingElement>(null);

  const allowedTypes = useMemo(
    () =>
      policy.allowedCombinations.find(
        (combination) => combination.ownerType === ownerType && combination.direction === direction,
      )?.adjustmentTypes ?? [],
    [direction, ownerType, policy.allowedCombinations],
  );
  const effectiveAdjustmentType = allowedTypes.includes(adjustmentType)
    ? adjustmentType
    : allowedTypes[0] ?? adjustmentType;

  useEffect(() => {
    if (previewState.status === 'error' || submitState.status === 'error') {
      errorSummaryRef.current?.focus();
    }
  }, [previewState.status, submitState.status]);

  useEffect(() => {
    if (selectedOwner) adjustmentStageRef.current?.focus();
  }, [selectedOwner]);

  const currentInputKey = walletAdjustmentFormKey({
    adjustmentType: effectiveAdjustmentType,
    amount,
    attachmentFileId: '',
    attachmentFileName,
    attachmentUrl: '',
    caseReference,
    direction,
    expectedCorrection,
    monthlyPeriod,
    operationalCause,
    ownerId: selectedOwner?.ownerId ?? '',
    ownerType,
    reason,
    reversalOfRequestId: '',
  });
  const currentPreview =
    previewState.status === 'success' && previewState.inputKey === currentInputKey
      ? previewState.preview
      : undefined;
  const actionError = submitState.status === 'error' ? submitState : previewState;
  const evidenceRequired =
    Number(amount) >= policy.constraints.attachmentRequiredAt || effectiveAdjustmentType === 'RECEIVABLE_WRITE_OFF';

  return (
    <div className="wallet-adjustment-create-workspace">
      <section aria-labelledby="wallet-owner-search-title" className="wallet-adjustment-owner-search">
        <div className="wallet-adjustment-section-heading">
          <div>
            <h2 id="wallet-owner-search-title">1. Select wallet owner</h2>
            <p>Search by name or phone, then verify the masked identity and current balance.</p>
          </div>
        </div>
        <AdminFormShell action={searchAction} className="wallet-adjustment-search-form">
          <AdminFormSelect
            defaultValue={searchState.ownerType ?? 'PARTNER'}
            key={searchState.ownerType ?? 'initial'}
            label="Wallet owner"
            labelVisibility="visible"
            name="ownerType"
            options={ownerOptions}
          />
          <AdminFormInput
            label="Name or phone number"
            labelVisibility="visible"
            minLength={2}
            name="ownerSearch"
            required
            type="search"
          />
          <AdminFormControlButton disabled={searchPending}>
            {searchPending ? 'Searching...' : 'Search'}
          </AdminFormControlButton>
        </AdminFormShell>

        {searchState.status === 'error' ? (
          <AdminInlineNotice role="alert" tone="danger">{searchState.message}</AdminInlineNotice>
        ) : null}
        {searchState.status === 'success' ? (
          <div
            aria-label="Wallet owner search results"
            aria-live="polite"
            className="wallet-adjustment-owner-results"
            role="region"
          >
            <p className="sr-only">{searchState.owners.length} wallet owner results found.</p>
            {searchState.owners.length ? (
              searchState.owners.map((owner) => (
                <AdminFormControlButton
                  className="text-link wallet-adjustment-owner-result"
                  key={`${owner.ownerType}:${owner.ownerId}`}
                  onClick={() => {
                    setOwnerType(owner.ownerType);
                    setSelectedOwner(owner);
                  }}
                  type="button"
                >
                  <span>
                    <strong>{owner.displayName}</strong>
                    <small>{owner.maskedPhone} · {owner.reference}</small>
                  </span>
                  <span>
                    <StatusBadge tone={ownerStatusTone(owner.accountStatus)}>{owner.accountStatus}</StatusBadge>
                    <MoneyText amount={owner.currentBalance} currency={owner.currency} />
                  </span>
                </AdminFormControlButton>
              ))
            ) : (
              <p className="muted">No matching wallet owners. Check the spelling or phone number.</p>
            )}
          </div>
        ) : null}
      </section>

      {selectedOwner ? (
        <section aria-labelledby="wallet-adjustment-form-title" className="wallet-adjustment-create-stage">
          <div className="wallet-adjustment-section-heading">
            <div>
              <h2 id="wallet-adjustment-form-title" ref={adjustmentStageRef} tabIndex={-1}>2. Prepare approval request</h2>
              <p>Only adjustment reasons allowed by the finance policy are available.</p>
            </div>
            <AdminFormControlButton className="text-link wallet-adjustment-change-owner" onClick={() => setSelectedOwner(null)} type="button">
              <X aria-hidden="true" size={16} /> Change owner
            </AdminFormControlButton>
          </div>

          <div className="wallet-adjustment-selected-owner" aria-label="Selected wallet owner">
            <div>
              <span>Selected owner</span>
              <strong>{selectedOwner.displayName}</strong>
              <small>{selectedOwner.maskedPhone} · {selectedOwner.reference}</small>
            </div>
            <div>
              <span>Type and status</span>
              <strong>{selectedOwner.ownerType === 'CUSTOMER' ? 'Customer' : 'Partner'}</strong>
              <small>{selectedOwner.accountStatus}</small>
            </div>
            <div>
              <span>Current balance</span>
              <strong><MoneyText amount={selectedOwner.currentBalance} currency={selectedOwner.currency} /></strong>
              <small>Revalidated at approval</small>
            </div>
          </div>

          {actionError.status === 'error' ? (
            <div ref={errorSummaryRef} tabIndex={-1}>
              <AdminInlineNotice role="alert" tone="danger">
                <h3>Request needs attention</h3>
                <p>{actionError.message}</p>
              </AdminInlineNotice>
            </div>
          ) : null}

          <AdminFormShell
            action={submitAction}
            className="wallet-adjustment-create-grid"
            onReset={(event) => event.preventDefault()}
          >
            <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
            <input name="ownerId" type="hidden" value={selectedOwner.ownerId} />
            <input name="ownerType" type="hidden" value={selectedOwner.ownerType} />
            <input name="attachmentFileId" type="hidden" value={currentPreview?.attachmentFileId ?? ''} />
            <input name="attachmentFileName" type="hidden" value={attachmentFileName} />
            <input name="attachmentUrl" type="hidden" value="" />

            <div className="wallet-adjustment-input-panel">
              <div className="wallet-adjustment-field-grid">
                <AdminFormSelect
                  className="wallet-adjustment-field"
                  label="Direction"
                  labelVisibility="visible"
                  name="direction"
                  onChange={(event) => setDirection(event.target.value as AdminManualWalletAdjustmentDirection)}
                  options={directionOptions}
                  value={direction}
                />
                <AdminFormSelect
                  ariaDescribedBy={actionError.field === 'adjustmentType' ? 'adjustmentType-error' : undefined}
                  ariaInvalid={actionError.field === 'adjustmentType'}
                  className="wallet-adjustment-field"
                  label="Adjustment reason"
                  labelVisibility="visible"
                  name="adjustmentType"
                  onChange={(event) => setAdjustmentType(event.target.value as AdminManualWalletAdjustmentType)}
                  options={allowedTypes.map((value) => ({ label: adjustmentTypeLabel(value, ownerType), value }))}
                  value={effectiveAdjustmentType}
                />
                <AdminFormInput
                  ariaDescribedBy={actionError.field === 'amount' ? 'amount-error' : 'amount-help'}
                  ariaInvalid={actionError.field === 'amount'}
                  className="wallet-adjustment-field"
                  label="Amount (VND)"
                  labelVisibility="visible"
                  max={policy.constraints.amountMax}
                  min={1}
                  name="amount"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  step={1}
                  type="number"
                  value={amount}
                />
                <AdminFormSelect
                  ariaDescribedBy={actionError.field === 'monthlyPeriod' ? 'monthlyPeriod-error' : 'monthlyPeriod-help'}
                  ariaInvalid={actionError.field === 'monthlyPeriod'}
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
                  ariaDescribedBy={actionError.field === 'attachmentFile' ? 'attachmentFile-error' : 'attachment-help'}
                  ariaInvalid={actionError.field === 'attachmentFile'}
                  className="wallet-adjustment-field"
                  label={evidenceRequired ? 'Evidence file (required)' : 'Evidence file'}
                  labelVisibility="visible"
                  name="attachmentFile"
                  onChange={(event) => setAttachmentFileName(event.target.files?.[0]?.name ?? '')}
                  required={evidenceRequired}
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
                    ariaDescribedBy={actionError.field === 'reason' ? 'reason-error' : 'reason-help'}
                    ariaInvalid={actionError.field === 'reason'}
                    className="wallet-adjustment-field"
                    label="Detailed reason"
                    labelVisibility="visible"
                    maxLength={policy.constraints.reasonMaxLength}
                    name="reason"
                    onChange={(event) => setReason(event.target.value)}
                    required
                    rows={4}
                    value={reason}
                  />
                  <small id="reason-help">Add details that are not already captured above. Minimum 12 characters. {reason.length}/{policy.constraints.reasonMaxLength}</small>
                </div>
              </div>
              <p className="muted" id="amount-help">Positive whole VND, up to {formatVnd(policy.constraints.amountMax)}.</p>
              <p className="muted" id="attachment-help">
                PDF, JPEG, PNG, or WebP up to 10 MB. Evidence is required at {formatVnd(policy.constraints.attachmentRequiredAt)} or for receivable write-offs.
              </p>
              <p className="muted" id="monthlyPeriod-help">Only DRAFT and REVIEWED accounting months can accept a request.</p>
              {attachmentFileName ? (
                <AdminInlineNotice role="status" tone="success">
                  Selected private evidence: {attachmentFileName}
                </AdminInlineNotice>
              ) : null}
              {actionError.field ? (
                <AdminInlineNotice
                  id={`${actionError.field}-error`}
                  role="alert"
                  tone="danger"
                >
                  {actionError.message}
                </AdminInlineNotice>
              ) : null}
            </div>

            <aside aria-label="Wallet adjustment review" className="wallet-adjustment-preview-panel">
              <div className="wallet-adjustment-preview-heading">
                <div>
                  <h3>Review changes</h3>
                  <p>Preview only. The balance changes after separate finance approval.</p>
                </div>
                <StatusBadge tone={currentPreview ? 'success' : 'warning'}>
                  {currentPreview ? 'Current preview' : 'Review required'}
                </StatusBadge>
              </div>

              {currentPreview ? (
                <>
                  <dl className="wallet-adjustment-preview-facts">
                    <div><dt>Wallet change</dt><dd><MoneyText amount={currentPreview.walletDelta} currency={currentPreview.currency} /></dd></div>
                    <div><dt>Before</dt><dd><MoneyText amount={currentPreview.beforeBalance} currency={currentPreview.currency} /></dd></div>
                    <div><dt>After</dt><dd><MoneyText amount={currentPreview.afterBalance} currency={currentPreview.currency} /></dd></div>
                    <div><dt>Accounting month</dt><dd>{currentPreview.monthlyPeriod}</dd></div>
                    <div><dt>Period status</dt><dd>{sentenceCase(currentPreview.monthlyPeriodStatus ?? 'unknown')}</dd></div>
                    <div><dt>Bank / cash</dt><dd>{currentPreview.affects.bankCash ? 'Affected' : 'No movement'}</dd></div>
                    <div><dt>Output VAT</dt><dd>{currentPreview.companyOutputVat ? formatVnd(currentPreview.companyOutputVat) : 'No VAT'}</dd></div>
                    <div><dt>Evidence</dt><dd>{currentPreview.requiresAttachment ? 'Required' : 'Optional'}</dd></div>
                  </dl>
                  <AdminDetails className="wallet-adjustment-accounting-details" name="wallet-adjustment-accounting-preview">
                    <summary>Accounting details</summary>
                    {currentPreview.accountingEntries.map((entry) => (
                      <p key={`${entry.accountDebit}:${entry.accountCredit}`}>
                        <strong>{entry.accountDebit}</strong> / {entry.accountCredit} · {formatVnd(entry.amount)}
                      </p>
                    ))}
                  </AdminDetails>
                  <p className="wallet-adjustment-preview-confirmation">
                    <ShieldCheck aria-hidden="true" size={18} /> Maker/checker separation and latest balance validation apply.
                  </p>
                </>
              ) : (
                <div className="wallet-adjustment-preview-empty">
                  <CheckCircle2 aria-hidden="true" size={22} />
                  <p>Complete the inputs, then review the balance and accounting impact here.</p>
                </div>
              )}

              <div className="wallet-adjustment-create-actions">
                <AdminFormControlButton disabled={previewPending} formAction={previewAction}>
                  {previewPending ? 'Reviewing...' : currentPreview ? 'Refresh review' : 'Review changes'}
                </AdminFormControlButton>
                <AdminFormControlButton
                  className="button-success"
                  disabled={!currentPreview || submitPending}
                >
                  {submitPending ? 'Creating...' : 'Create approval request'}
                </AdminFormControlButton>
              </div>
            </aside>
          </AdminFormShell>
        </section>
      ) : null}
    </div>
  );
}

function adjustmentTypeLabel(type: AdminManualWalletAdjustmentType, ownerType: AdminManualWalletAdjustmentOwnerType) {
  if (type === 'CUSTOMER_COMPENSATION') {
    return ownerType === 'PARTNER' ? 'Partner compensation' : 'Customer compensation';
  }
  return sentenceCase(type);
}

function sentenceCase(value: string) {
  const normalized = value.toLowerCase().replaceAll('_', ' ');
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function ownerStatusTone(status: string): 'danger' | 'success' | 'warning' {
  if (/blocked|deleted|missing/i.test(status)) return 'danger';
  if (/pending|inactive|offline/i.test(status)) return 'warning';
  return 'success';
}

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} VND`;
}
