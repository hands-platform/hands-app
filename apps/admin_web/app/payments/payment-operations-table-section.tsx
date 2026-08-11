import type { ReactNode } from 'react';

import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { CommandCopyButton } from '../../components/command-copy-button';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';

export type PaymentOperationsTableRow = {
  readonly amount: number;
  readonly bookingHref: string;
  readonly bookingId: string;
  readonly bookingIdLabel: string;
  readonly bookingStatus: string;
  readonly bookingCreatedAt: string | null;
  readonly currency: string;
  readonly customerLabel: string;
  readonly decisionLabel: string;
  readonly decisionReason: string;
  readonly decisionTone: StatusBadgeTone;
  readonly evidenceLabel: string;
  readonly evidenceReason: string;
  readonly evidenceTone: StatusBadgeTone;
  readonly id: string;
  readonly method: string;
  readonly partnerLabel: string;
  readonly paymentHref: string;
  readonly paymentIdLabel: string;
  readonly primaryAction: ReactNode;
  readonly providerRef: string;
  readonly status: string;
  readonly bookingUpdatedAt: string | null;
};

type PaymentOperationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly pagination: {
    readonly from: number;
    readonly hrefForPage: (page: number) => string;
    readonly page: number;
    readonly rows: readonly PaymentOperationsTableRow[];
    readonly to: number;
    readonly totalPages: number;
    readonly totalRows: number;
  };
};

export function PaymentOperationsTableSection({ emptyMessage, pagination }: PaymentOperationsTableSectionProps) {
  const rows = pagination.rows;

  return (
    <AdminTablePanel
      className="payment-command-table-panel"
      description="Each row shows the latest server decision. Money actions reopen a confirmation against current booking and payment evidence."
      resultLabel={`${pagination.totalRows} ${pagination.totalRows === 1 ? 'payment' : 'payments'}`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Payment decisions"
    >
      <AdminTableScroll ariaLabel="Payment decision table" className="payment-command-table-scroll">
        <AdminDataTable
          className="payment-command-table"
          emptyMessage={emptyMessage}
          headers={[
            'Payment / Booking',
            'Customer / Partner',
            'Method / amount',
            'Current state',
            'Decision / Evidence',
            'Action',
          ]}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr id={`payment-${row.id}`} key={row.id}>
              <td className="payment-command-identity-cell">
                <div className="payment-command-id-line">
                  <span>
                    <small>Payment</small>
                    <AdminTextLink href={row.paymentHref} title={row.id}>{row.paymentIdLabel}</AdminTextLink>
                  </span>
                  <CommandCopyButton
                    copiedLabel="Payment ID copied"
                    failedLabel="Copy payment ID failed"
                    label="Copy payment ID"
                    value={row.id}
                  />
                </div>
                <div className="payment-command-id-line">
                  <span>
                    <small>Booking</small>
                    <AdminTextLink href={row.bookingHref} title={row.bookingIdLabel}>{row.bookingIdLabel}</AdminTextLink>
                  </span>
                  <CommandCopyButton
                    copiedLabel="Booking ID copied"
                    failedLabel="Copy booking ID failed"
                    label="Copy booking ID"
                    value={row.bookingId}
                  />
                </div>
              </td>
              <td className="payment-command-party-cell">
                <strong>{row.customerLabel}</strong>
                <small>{row.partnerLabel}</small>
              </td>
              <td>
                <strong>{row.method.replaceAll('_', ' ')}</strong>
                <MoneyText amount={row.amount} currency={row.currency} />
              </td>
              <td className="payment-command-state-cell">
                <StatusBadge tone={paymentStatusTone(row.status)}>{row.status}</StatusBadge>
                <small>Payment</small>
                <StatusBadge tone={bookingStatusTone(row.bookingStatus)}>{row.bookingStatus}</StatusBadge>
                <small>Booking</small>
              </td>
              <td className="payment-command-decision-cell">
                <StatusBadge tone={row.decisionTone}>{row.decisionLabel}</StatusBadge>
                <small>{row.decisionReason}</small>
                <StatusBadge tone={row.evidenceTone}>{row.evidenceLabel}</StatusBadge>
                <small>{row.evidenceReason}</small>
                <small>Booking created <DateTimeText fallback="Unknown" value={row.bookingCreatedAt} /></small>
                <small>Idle since booking update <DateTimeText fallback="Unknown" value={row.bookingUpdatedAt} /></small>
              </td>
              <td className="payment-command-action-cell">
                <div>{row.primaryAction}</div>
                <AdminTextLink href={row.paymentHref}>Open detail</AdminTextLink>
                <small title={row.providerRef}>{row.providerRef}</small>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Payment pagination"
        from={pagination.from}
        hrefForPage={pagination.hrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}

function bookingStatusTone(status: string): StatusBadgeTone {
  if (status === 'COMPLETED') return 'success';
  if (['CANCELLED', 'NO_SHOW', 'EXPIRED', 'REFUNDED'].includes(status)) return 'danger';
  if (['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status)) {
    return 'info';
  }
  return 'neutral';
}

function paymentStatusTone(status: string): StatusBadgeTone {
  if (status === 'CAPTURED' || status === 'RELEASED') return 'success';
  if (status === 'FAILED' || status === 'REFUNDED') return 'danger';
  if (status === 'AUTHORIZED' || status === 'PENDING') return 'warning';
  return 'neutral';
}
