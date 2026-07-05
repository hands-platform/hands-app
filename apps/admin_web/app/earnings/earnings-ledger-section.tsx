import type { ReactNode } from 'react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlButton, AdminFormInput, AdminFormShell } from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import {
  AdminSignal,
  StatusBadge,
  StatusBadgeLink,
  adminSignalToneFromClassName,
  statusBadgeToneFromPillClass,
} from '../../components/status-badge';

export type EarningsLedgerRow = {
  readonly bookingHref: string;
  readonly bookingPaymentMethod: string;
  readonly bookingShortId: string;
  readonly cashAccountingPreview: readonly ReactNode[];
  readonly canCreatePayout: boolean;
  readonly canDirectlyPay: boolean;
  readonly cancellationDecisionLabel: string | null;
  readonly cancellationDecisionTone: string | null;
  readonly cancellationFeeLabel: string | null;
  readonly cancellationFeeTone: string | null;
  readonly createdAtLabel: string;
  readonly feePolicyHint: string;
  readonly grossAmountLabel: string;
  readonly id: string;
  readonly netAmountLabel: string;
  readonly netCompanyFeeHint: string;
  readonly payoutBatchHref: string | null;
  readonly payoutBatchLabel: string | null;
  readonly platformFeeLabel: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly providerProfileId: string;
  readonly settlementMethodLabel: string | null;
  readonly settlementRef: string | null;
  readonly signalClassName: string;
  readonly statusHint: string;
  readonly statusLabel: string;
  readonly taxPolicyHint: string;
  readonly transferRef: string;
  readonly walletEntries: readonly string[];
  readonly withholdingAmountLabel: string;
};

type EarningsLedgerSectionProps = {
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly EarningsLedgerRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

const ledgerHeaders = [
  'Partner',
  'Booking',
  'Status',
  'Payout batch',
  'Gross / Fee / Tax',
  'Net',
  'Action',
] as const;

export function EarningsLedgerSection({ pagination }: EarningsLedgerSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminTablePanel
      description="Raw earning rows remain visible for booking traceability, tax audit, payout batching, and cash fee settlement correction."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Recent earnings ledger"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No earnings loaded."
          headers={ledgerHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr id={`earning-${row.id}`} key={row.id}>
              <td>
                <div>{row.providerName}</div>
                <div className="muted">{row.providerPhone}</div>
              </td>
              <td>
                <AdminTextLink href={row.bookingHref}>
                  {row.bookingShortId}
                </AdminTextLink>
                <div className="muted">{row.createdAtLabel}</div>
                <div className="muted">Payment {row.bookingPaymentMethod}</div>
                {row.settlementRef ? <div className="muted">Settlement ref {row.settlementRef}</div> : null}
                {row.settlementMethodLabel ? (
                  <div className="muted">Settlement method {row.settlementMethodLabel}</div>
                ) : null}
                {row.walletEntries.map((entry) => (
                  <div className="muted" key={entry}>
                    {entry}
                  </div>
                ))}
                {row.cashAccountingPreview.length ? (
                  <div
                    className="admin-mini-ledger"
                    aria-label={`Cash accounting preview for earning ${row.id}`}
                  >
                    <span>Accounting preview</span>
                    {row.cashAccountingPreview.map((line, index) => (
                      <small key={`${row.id}-cash-accounting-${index}`}>{line}</small>
                    ))}
                  </div>
                ) : null}
              </td>
              <td>
                <AdminSignal className={row.signalClassName} tone={adminSignalToneFromClassName(row.signalClassName)}>
                  {row.statusLabel}
                </AdminSignal>
                {row.cancellationDecisionLabel ? (
                  <div className="participant-list admin-mt-6">
                    <StatusBadge tone={statusBadgeToneFromPillClass(row.cancellationDecisionTone ?? 'pill-neutral')}>
                      {row.cancellationDecisionLabel}
                    </StatusBadge>
                    {row.cancellationFeeLabel ? (
                      <StatusBadge tone={statusBadgeToneFromPillClass(row.cancellationFeeTone ?? 'pill-neutral')}>
                        {row.cancellationFeeLabel}
                      </StatusBadge>
                    ) : null}
                  </div>
                ) : null}
                <div className="muted admin-mt-6">{row.statusHint}</div>
              </td>
              <td>
                {row.payoutBatchHref && row.payoutBatchLabel ? (
                  <StatusBadgeLink href={row.payoutBatchHref} tone="info">
                    {row.payoutBatchLabel}
                  </StatusBadgeLink>
                ) : (
                  <StatusBadge tone="warning">Not batched</StatusBadge>
                )}
              </td>
              <td>
                <div>{row.grossAmountLabel} gross</div>
                <div className="muted">{row.platformFeeLabel}</div>
                <div className="muted">{row.feePolicyHint}</div>
                <div className="muted">{row.netCompanyFeeHint}</div>
                <div className="muted">{row.withholdingAmountLabel}</div>
                <div className="muted">{row.taxPolicyHint}</div>
              </td>
              <td>
                <strong>{row.netAmountLabel}</strong>
              </td>
              <td>
                {row.canDirectlyPay ? (
                  <AdminFormShell action="/earnings">
                    <input type="hidden" name="confirm" value="mark-paid" />
                    <input type="hidden" name="earningId" value={row.id} />
                    <input type="hidden" name="settlementMethod" value="PARTNER_DEPOSIT" />
                    <AdminFormInput
                      label="Settlement reference"
                      name="settlementRef"
                      placeholder="Deposit ref or offset memo"
                    />
                    <AdminFormControlButton className="button-primary" type="submit">
                      Review fee settlement
                    </AdminFormControlButton>
                  </AdminFormShell>
                ) : null}
                {row.canCreatePayout ? (
                  <AdminFormShell action="/earnings" className="admin-mt-6">
                    <input type="hidden" name="confirm" value="create-payout" />
                    <input type="hidden" name="providerProfileId" value={row.providerProfileId} />
                    <input type="hidden" name="transferRef" value={row.transferRef} />
                    <AdminFormControlButton className="button-primary" type="submit">
                      Review payout batch
                    </AdminFormControlButton>
                  </AdminFormShell>
                ) : null}
                {!row.canDirectlyPay && !row.canCreatePayout ? (
                  <AdminInlineFallback>{row.statusLabel === 'PAID' ? 'Paid' : 'No action'}</AdminInlineFallback>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Earnings ledger pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}
