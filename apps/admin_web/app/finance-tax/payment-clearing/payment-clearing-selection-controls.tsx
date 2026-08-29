'use client';

import { useEffect, useRef, useState } from 'react';

import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';

const MAX_SELECTION = 50;

type PaymentClearingSelectionControlsProps = {
  readonly loadOwnerOptions: () => Promise<readonly { readonly label: string; readonly value: string }[]>;
  readonly visibleCount: number;
};

export function PaymentClearingSelectionControls({
  loadOwnerOptions,
  visibleCount,
}: PaymentClearingSelectionControlsProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [assigneeAdminId, setAssigneeAdminId] = useState('');
  const [ownerOptions, setOwnerOptions] = useState<readonly { readonly label: string; readonly value: string }[] | null>(null);
  const [ownerOptionsError, setOwnerOptionsError] = useState(false);
  const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(false);
  const [reason, setReason] = useState('');
  const loadOwnerOptionsRef = useRef(loadOwnerOptions);
  const hasSelection = selectedCount > 0;

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('[data-payment-clearing-selection]');
    if (!form) return;
    const update = (resetOwnerState = false) => {
      const count = form.querySelectorAll<HTMLInputElement>('input[name="clearingEntryIds"]:checked').length;
      setSelectedCount(count);
      if (resetOwnerState && count === 0) {
        setAssigneeAdminId('');
        setOwnerOptions(null);
        setOwnerOptionsError(false);
        setOwnerOptionsLoading(false);
        setReason('');
      }
    };
    const handleSelectionChange = () => update(true);
    form.addEventListener('change', handleSelectionChange);
    form.addEventListener('input', handleSelectionChange);
    update();
    return () => {
      form.removeEventListener('change', handleSelectionChange);
      form.removeEventListener('input', handleSelectionChange);
    };
  }, []);

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

  const canSubmit = paymentClearingBulkAssignmentReady(
    selectedCount,
    ownerOptions,
    assigneeAdminId,
    reason,
  );

  function selectVisible() {
    const form = document.querySelector<HTMLFormElement>('[data-payment-clearing-selection]');
    if (!form) return;
    const checkboxes = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="clearingEntryIds"]:not(:disabled)'),
    );
    const shouldSelect = selectedCount === 0;
    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = shouldSelect && index < MAX_SELECTION;
    });
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return (
    <div className="payment-clearing-bulk-assignment">
      <div className="payment-clearing-selection-controls">
        <AdminFormControlButton className="button-secondary" onClick={selectVisible} type="button">
          {selectedCount > 0 ? 'Clear visible selection' : 'Select all visible'}
        </AdminFormControlButton>
        <span aria-live="polite" role="status">
          {selectedCount} selected · maximum {MAX_SELECTION}
          {visibleCount > MAX_SELECTION ? ` · first ${MAX_SELECTION} visible rows only` : ''}
        </span>
      </div>
      {selectedCount > 0 ? (
        ownerOptionsLoading ? (
          <p className="muted admin-mt-10" role="status">Loading eligible Finance operators...</p>
        ) : ownerOptionsError ? (
          <p className="admin-inline-error admin-mt-10" role="alert">
            Eligible Finance operators could not be loaded. Clear the selection and try again.
          </p>
        ) : ownerOptions && ownerOptions.length > 1 ? (
          <AdminFormGridFields className="compact-form payment-clearing-bulk-controls">
            <AdminFormSelect
              label="Assign selected to"
              labelVisibility="visible"
              name="assigneeAdminId"
              onChange={(event) => setAssigneeAdminId(event.currentTarget.value)}
              options={ownerOptions}
              required
              value={assigneeAdminId}
            />
            <AdminFormInput
              label="Assignment reason"
              labelVisibility="visible"
              maxLength={500}
              minLength={12}
              name="reason"
              onChange={(event) => setReason(event.currentTarget.value)}
              placeholder="Why should this operator own the selected clearing reviews?"
              required
              value={reason}
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
              <span className="muted">
                Closed or changed records are rejected by the server.
              </span>
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

export function paymentClearingBulkAssignmentReady(
  selectedCount: number,
  ownerOptions: readonly { readonly value: string }[] | null,
  assigneeAdminId: string,
  reason: string,
) {
  return selectedCount > 0 &&
    Boolean(assigneeAdminId) &&
    Boolean(ownerOptions?.some((option) => option.value === assigneeAdminId)) &&
    reason.trim().length >= 12;
}
