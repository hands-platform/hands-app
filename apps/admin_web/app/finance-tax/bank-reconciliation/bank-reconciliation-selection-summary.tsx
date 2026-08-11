'use client';

import { useEffect, useRef, useState } from 'react';

import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { formatMoney } from '../../../lib/admin-format';

const MAX_SELECTION = 50;

type BankReconciliationSelection = {
  readonly amount: number;
  readonly currency: string;
  readonly overdue: boolean;
};

type BankReconciliationSelectionSummaryProps = {
  readonly formId: string;
  readonly loadOwnerOptions: () => Promise<readonly { readonly label: string; readonly value: string }[]>;
  readonly visibleCount: number;
};

export function BankReconciliationSelectionSummary({
  formId,
  loadOwnerOptions,
  visibleCount,
}: BankReconciliationSelectionSummaryProps) {
  const [selection, setSelection] = useState<readonly BankReconciliationSelection[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<readonly { readonly label: string; readonly value: string }[] | null>(null);
  const [ownerOptionsError, setOwnerOptionsError] = useState(false);
  const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(false);
  const loadOwnerOptionsRef = useRef(loadOwnerOptions);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const updateSelection = (resetOwnerState = false) => {
      const selected = Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name="bankTransactionIds"]:checked'),
      ).flatMap((input) => {
        const row = input.closest<HTMLElement>('[data-bank-selection-row]');
        const amount = Number(row?.dataset.bankSelectionAmount);
        if (!row || !Number.isFinite(amount)) return [];
        return [
          {
            amount,
            currency: row.dataset.bankSelectionCurrency || 'VND',
            overdue: row.dataset.bankSelectionOverdue === 'true',
          },
        ];
      });
      form.dataset.hasSelection = selected.length > 0 ? 'true' : 'false';
      setSelection(selected);
      setCanSubmit(selected.length > 0 && form.checkValidity());
      if (resetOwnerState && selected.length === 0) {
        setOwnerOptions(null);
        setOwnerOptionsError(false);
        setOwnerOptionsLoading(false);
      }
    };

    updateSelection();
    const handleSelectionChange = () => updateSelection(true);
    form.addEventListener('change', handleSelectionChange);
    form.addEventListener('input', handleSelectionChange);
    return () => {
      form.removeEventListener('change', handleSelectionChange);
      form.removeEventListener('input', handleSelectionChange);
    };
  }, [formId]);

  const summary = summarizeBankReconciliationSelection(selection);
  const hasSelection = summary.count > 0;
  useEffect(() => {
    loadOwnerOptionsRef.current = loadOwnerOptions;
  }, [loadOwnerOptions]);

  useEffect(() => {
    if (!hasSelection || ownerOptions) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setOwnerOptionsLoading(true);
      setOwnerOptionsError(false);
      void loadOwnerOptionsRef.current()
        .then((options) => {
          if (!active) return;
          setOwnerOptions(options);
          setOwnerOptionsError(false);
        })
        .catch(() => {
          if (active) setOwnerOptionsError(true);
        })
        .finally(() => {
          if (active) setOwnerOptionsLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [hasSelection, ownerOptions]);

  const toggleVisible = () => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const checkboxes = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="bankTransactionIds"]:not(:disabled)'),
    );
    const shouldSelect = summary.count === 0;
    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = shouldSelect && index < MAX_SELECTION;
    });
    form.dispatchEvent(new Event('change', { bubbles: true }));
  };

  return (
    <div className="finance-bank-bulk-assignment">
      <div className="finance-bank-selection-summary">
        <AdminFormControlButton className="button-secondary" onClick={toggleVisible} type="button">
          {summary.count > 0 ? 'Clear visible selection' : 'Select all visible'}
        </AdminFormControlButton>
        <span aria-live="polite" role="status">
          <strong>{summary.count} selected</strong>
          {summary.amounts.length > 0 ? ` · ${summary.amounts.join(' · ')}` : ''}
          {` · ${summary.overdueCount} waiting 48h+ · maximum ${MAX_SELECTION}`}
          {visibleCount > MAX_SELECTION ? ` · first ${MAX_SELECTION} visible rows only` : ''}
        </span>
      </div>
      {summary.count > 0 ? (
        ownerOptionsLoading ? (
          <p className="muted admin-mt-10" role="status">Loading eligible Finance operators...</p>
        ) : ownerOptionsError ? (
          <p className="admin-inline-error admin-mt-10" role="alert">
            Eligible Finance operators could not be loaded. Clear the selection and try again.
          </p>
        ) : ownerOptions && ownerOptions.length > 1 ? (
          <AdminFormGridFields className="compact-form finance-bank-bulk-controls">
            <AdminFormSelect
              defaultValue=""
              label="Assign selected to"
              labelVisibility="visible"
              name="assigneeAdminId"
              options={ownerOptions}
              required
            />
            <AdminFormInput
              label="Assignment reason"
              labelVisibility="visible"
              maxLength={500}
              minLength={12}
              name="reason"
              placeholder="Why should this operator own the selected reviews?"
              required
            />
            <AdminFormActionRow>
              <AdminFormControlButton
                className="button-secondary"
                data-finance-assignment-submit
                disabled={!canSubmit}
                type="submit"
              >
                Assign selected
              </AdminFormControlButton>
              <span className="muted">Closed or changed records are rejected by the server.</span>
            </AdminFormActionRow>
          </AdminFormGridFields>
        ) : ownerOptions ? (
          <p className="admin-inline-error admin-mt-10" role="alert">
            No eligible Finance operator is available for these reviews.
          </p>
        ) : null
      ) : null}
    </div>
  );
}

export function summarizeBankReconciliationSelection(selection: readonly BankReconciliationSelection[]) {
  const totals = new Map<string, number>();
  for (const item of selection) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }
  return {
    amounts: Array.from(totals, ([currency, amount]) => formatMoney(amount, currency)),
    count: selection.length,
    overdueCount: selection.filter((item) => item.overdue).length,
  };
}
