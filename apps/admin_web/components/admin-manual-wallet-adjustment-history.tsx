import Link from 'next/link';

import type { AdminManualWalletAdjustmentRow } from '../lib/admin-api';
import { formatDateTime, formatMoney } from '../lib/admin-format';
import { AdminDataTable, AdminTableScroll } from './admin-data-table';
import { AdminFilterPanel } from './admin-filter-panel';
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
  className = 'admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
  rows,
  walletAdjustmentsHref,
}: AdminManualWalletAdjustmentHistoryProps) {
  return (
    <AdminFilterPanel
      className={className}
      description="Recent manual wallet adjustments are loaded separately from the detail payload and never move bank or cash accounts."
      resultLabel={`${rows.length} row(s)`}
      resultTone={rows.length > 0 ? 'info' : 'warning'}
      title="Recent manual wallet adjustments"
    >
      <div className="actions admin-mb-12">
        <Link className="text-link" href={walletAdjustmentsHref}>
          Open wallet adjustment desk
        </Link>
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
                <strong>{formatDateTime(row.createdAt)}</strong>
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
                <strong>{row.approvalId ?? 'Missing approval'}</strong>
                <p className="muted">{row.attachmentUrl ? 'Attachment saved' : 'No attachment'}</p>
              </td>
              <td>
                <strong>{formatBalanceChange(row)}</strong>
                <p className="muted">{walletImpactLabel(row)}</p>
              </td>
              <td>{row.reason ?? 'No reason stored'}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminFilterPanel>
  );
}

function formatBalanceChange(row: AdminManualWalletAdjustmentRow) {
  if (row.beforeBalance === undefined || row.beforeBalance === null) {
    return formatMoney(row.afterBalance, row.currency);
  }

  if (row.afterBalance === undefined || row.afterBalance === null) {
    return formatMoney(row.beforeBalance, row.currency);
  }

  return `${formatMoney(row.beforeBalance, row.currency)} -> ${formatMoney(
    row.afterBalance,
    row.currency,
  )}`;
}

function walletImpactLabel(row: AdminManualWalletAdjustmentRow) {
  const affects = Object.entries(row.affects ?? {})
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).trim());

  return affects.length > 0 ? affects.slice(0, 3).join(' / ') : 'Wallet ledger only';
}
