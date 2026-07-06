import type { AdminManualWalletAdjustmentRow } from '../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from './admin-data-table';
import { AdminInlineFallback } from './admin-inline-fallback';
import { AdminTablePanel } from './admin-table-panel';
import { AdminTextLink } from './admin-text-link';
import { DateTimeText } from './date-time-text';
import { MoneyText } from './money-text';
import { StatusBadge } from './status-badge';

const MANUAL_WALLET_ADJUSTMENT_HISTORY_HEADERS = [
  'Created',
  'Owner',
  'Adjustment',
  'Amount',
  'Approval',
  'Balance',
  'Reason',
] as const;

type AdminManualWalletAdjustmentHistoryProps = {
  readonly className?: string;
  readonly rows: readonly AdminManualWalletAdjustmentRow[];
  readonly walletAdjustmentsHref: string;
};

export function AdminManualWalletAdjustmentHistory({
  className,
  rows,
  walletAdjustmentsHref,
}: AdminManualWalletAdjustmentHistoryProps) {
  return (
    <AdminTablePanel
      className={className}
      description="Recent manual wallet adjustments are loaded separately from the detail payload and never move bank or cash accounts."
      resultLabel={`${rows.length} row(s)`}
      resultTone={rows.length > 0 ? 'info' : 'warning'}
      title="Recent manual wallet adjustments"
    >
      <div className="actions admin-mb-12">
        <AdminTextLink href={walletAdjustmentsHref}>
          Open wallet adjustment desk
        </AdminTextLink>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No recent manual wallet adjustment ledger rows found for this account."
          headers={MANUAL_WALLET_ADJUSTMENT_HISTORY_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>
                  <DateTimeText value={row.createdAt} />
                </strong>
                <p className="muted">{row.ledgerType}</p>
              </td>
              <td>
                <strong>{row.ownerLabel}</strong>
                <p className="muted">
                  {row.ownerType} / {row.ownerPhone}
                </p>
              </td>
              <td>
                <StatusBadge tone={row.direction === 'CREDIT' ? 'success' : 'warning'}>
                  {row.direction}
                </StatusBadge>
                <p className="muted admin-mt-6">{row.adjustmentType}</p>
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.amount} currency={row.currency} />
                </strong>
                <p className="muted">
                  Delta <MoneyText amount={row.walletDelta} currency={row.currency} />
                </p>
              </td>
              <td>
                {row.approvalId ? (
                  <strong>{row.approvalId}</strong>
                ) : (
                  <AdminInlineFallback>Missing approval</AdminInlineFallback>
                )}
                {row.attachmentUrl ? (
                  <p className="muted">Attachment saved</p>
                ) : (
                  <AdminInlineFallback className="admin-mt-6">No attachment</AdminInlineFallback>
                )}
              </td>
              <td>
                <strong>{renderBalanceChange(row)}</strong>
                <p className="muted">{walletImpactLabel(row)}</p>
              </td>
              <td>{row.reason ? row.reason : <AdminInlineFallback>No reason stored</AdminInlineFallback>}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

function renderBalanceChange(row: AdminManualWalletAdjustmentRow) {
  if (row.beforeBalance === undefined || row.beforeBalance === null) {
    return <MoneyText amount={row.afterBalance} currency={row.currency} />;
  }

  if (row.afterBalance === undefined || row.afterBalance === null) {
    return <MoneyText amount={row.beforeBalance} currency={row.currency} />;
  }

  return (
    <>
      <MoneyText amount={row.beforeBalance} currency={row.currency} /> -&gt;{' '}
      <MoneyText amount={row.afterBalance} currency={row.currency} />
    </>
  );
}

function walletImpactLabel(row: AdminManualWalletAdjustmentRow) {
  const affects = Object.entries(row.affects ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).trim());

  return affects.length > 0 ? affects.slice(0, 3).join(' / ') : 'Wallet ledger only';
}
