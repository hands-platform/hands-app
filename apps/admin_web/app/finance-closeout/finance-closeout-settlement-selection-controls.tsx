'use client';

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from 'react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormShell,
} from '../../components/admin-form-controls';

export const MAX_SETTLEMENT_COMPARISON_SELECTION = 10;

type SettlementSelectionContextValue = {
  readonly selectedIds: ReadonlySet<string>;
  readonly updateSelection: (bookingId: string, selected: boolean) => void;
};

type SettlementSelectionFormProps = PropsWithChildren<{
  readonly formState: {
    readonly q: string;
    readonly range: string;
    readonly settlementAge: string;
    readonly settlementPage: number;
    readonly settlementPaymentMethod: string;
    readonly settlementPeriod: string;
    readonly settlementTrack: string;
  };
}>;

const SettlementSelectionContext = createContext<SettlementSelectionContextValue | null>(null);

export function FinanceCloseoutSettlementSelectionForm({
  children,
  formState,
}: SettlementSelectionFormProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const updateSelection = useCallback((bookingId: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        if (next.size >= MAX_SETTLEMENT_COMPARISON_SELECTION) return current;
        next.add(bookingId);
      } else {
        next.delete(bookingId);
      }
      return next;
    });
  }, []);

  return (
    <SettlementSelectionContext.Provider value={{ selectedIds, updateSelection }}>
      <AdminFormShell action="/finance-closeout" method="get">
        <input name="q" type="hidden" value={formState.q} />
        <input name="range" type="hidden" value={formState.range} />
        <input name="settlementAge" type="hidden" value={formState.settlementAge} />
        <input name="settlementPage" type="hidden" value={String(formState.settlementPage)} />
        <input
          name="settlementPaymentMethod"
          type="hidden"
          value={formState.settlementPaymentMethod}
        />
        <input name="settlementPeriod" type="hidden" value={formState.settlementPeriod} />
        <input name="settlementTrack" type="hidden" value={formState.settlementTrack} />
        {children}
      </AdminFormShell>
    </SettlementSelectionContext.Provider>
  );
}

export function FinanceCloseoutSettlementSelectionAction({
  statusId = 'settlement-comparison-selection-status',
}: {
  readonly statusId?: string;
} = {}) {
  const { selectedIds } = useSettlementSelection();
  const selectedCount = selectedIds.size;

  return (
    <>
      <AdminFormControlButton
        aria-describedby={statusId}
        className="button-secondary"
        disabled={selectedCount === 0}
        type="submit"
      >
        {financeCloseoutComparisonSelectionLabel(selectedCount)}
      </AdminFormControlButton>
      <span
        aria-live="polite"
        className="muted finance-closeout-selection-status"
        id={statusId}
      >
        Select up to {MAX_SETTLEMENT_COMPARISON_SELECTION} records. {selectedCount} selected.
      </span>
    </>
  );
}

export function FinanceCloseoutSettlementSelectionCheckbox({ bookingId }: { readonly bookingId: string }) {
  const { selectedIds, updateSelection } = useSettlementSelection();
  const checked = selectedIds.has(bookingId);

  return (
    <AdminFormCheckbox
      checked={checked}
      disabled={!checked && selectedIds.size >= MAX_SETTLEMENT_COMPARISON_SELECTION}
      label={`Select ${bookingId}`}
      name="reviewBookingId"
      onChange={(event) => updateSelection(bookingId, event.currentTarget.checked)}
      value={bookingId}
    />
  );
}

export function financeCloseoutComparisonSelectionLabel(count: number) {
  const boundedCount = Math.min(
    MAX_SETTLEMENT_COMPARISON_SELECTION,
    Math.max(0, Math.trunc(count)),
  );
  return `Compare selected (${boundedCount})`;
}

function useSettlementSelection() {
  const context = useContext(SettlementSelectionContext);
  if (!context) throw new Error('Settlement selection controls require a selection form.');
  return context;
}
