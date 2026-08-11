import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../../components/admin-data-table';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminNotePanel, AdminSection } from '../../../components/admin-surface';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge } from '../../../components/status-badge';
import type {
  AdminCustomerWalletLedgerPage,
  AdminCustomerWalletLedgerRow,
  AdminCustomerWalletLedgerType,
  AdminManualWalletAdjustmentOpenPeriod,
} from '../../../lib/admin-api';
import { CustomerWalletAdjustmentForm } from './customer-wallet-adjustment-form';

const CUSTOMER_WALLET_LEDGER_HEADERS = [
  'When',
  'Transaction & related record',
  'Before',
  'Change',
  'After & evidence',
] as const;

type CustomerWalletAdjustmentPanelProps = {
  readonly actionHref: string;
  readonly actionOpen: boolean;
  readonly auditHref: string;
  readonly closeHref: string;
  readonly currentBalance: number;
  readonly customerId: string;
  readonly customerLabel: string;
  readonly canCreateRequest: boolean;
  readonly notice?: string;
  readonly openPeriods: readonly AdminManualWalletAdjustmentOpenPeriod[];
  readonly operatorLabel?: string;
  readonly walletLedger: AdminCustomerWalletLedgerPage;
  readonly walletPage: number;
};

export function CustomerWalletAdjustmentPanel({
  actionHref,
  actionOpen,
  auditHref,
  closeHref,
  currentBalance,
  customerId,
  customerLabel,
  canCreateRequest,
  notice,
  openPeriods,
  operatorLabel = 'Current operator',
  walletLedger,
  walletPage,
}: CustomerWalletAdjustmentPanelProps) {
  const noticeContent = customerWalletAdjustmentNotice(notice);
  const returnTo = `/customers/${encodeURIComponent(customerId)}#customer-wallet-adjustment-request`;
  const showForm = canCreateRequest && openPeriods.length > 0 && (actionOpen || noticeContent?.tone === 'warn');

  return (
    <>
      <AdminSection
        actions={
          <>
            <StatusBadge tone="info">
              <MoneyText amount={currentBalance} />
            </StatusBadge>
            {canCreateRequest ? (
              <AdminFormControlLink
                className={showForm ? 'button-secondary' : undefined}
                href={showForm ? closeHref : actionHref}
              >
                {showForm ? 'Close' : 'Financial adjustment'}
              </AdminFormControlLink>
            ) : null}
          </>
        }
        className="admin-mb-16 customer-wallet-adjustment-request"
        description="Prepare a wallet correction request for review by a different finance approver."
        id="customer-wallet-adjustment-request"
        title="Financial adjustment"
      >
        {noticeContent ? (
          <div role="status">
            <AdminNotePanel className={`ops-task-${noticeContent.tone} admin-mb-14`}>
              <div className="ops-row">
                <div>
                  <strong>{noticeContent.title}</strong>
                  <p className="muted">{noticeContent.detail}</p>
                  {noticeContent.tone === 'success' ? (
                    <AdminTextLink href={auditHref}>Open audit event</AdminTextLink>
                  ) : null}
                </div>
                <StatusBadge tone={noticeContent.tone === 'success' ? 'success' : 'warning'}>
                  {noticeContent.badge}
                </StatusBadge>
              </div>
            </AdminNotePanel>
          </div>
        ) : null}

        {showForm ? (
          <div
            aria-label="Adjust customer wallet"
            className="customer-inline-action-disclosure-body"
            role="region"
          >
            <div className="ops-row admin-mb-14">
              <div>
                <strong>Wallet target</strong>
                <p className="muted">{customerLabel}</p>
              </div>
              <StatusBadge tone="warning">Separate finance approval</StatusBadge>
            </div>
            <CustomerWalletAdjustmentForm
              currentBalance={currentBalance}
              customerId={customerId}
              customerLabel={customerLabel}
              operatorLabel={operatorLabel}
              openPeriods={openPeriods}
              returnTo={returnTo}
            />
          </div>
        ) : actionOpen && openPeriods.length === 0 ? (
          <AdminNotePanel className="ops-task-warning">
            <strong>No open accounting month</strong>
            <p className="muted">A VND period must be DRAFT or REVIEWED before this request can be prepared.</p>
            <AdminFormControlLink href="/finance-tax">Open Tax &amp; Period Close</AdminFormControlLink>
          </AdminNotePanel>
        ) : !canCreateRequest && actionOpen ? (
          <AdminNotePanel className="ops-task-warning">
            <strong>Wallet adjustment request access is required</strong>
            <p className="muted">
              Only an authorized admin can create a customer wallet adjustment request from this page.
            </p>
          </AdminNotePanel>
        ) : null}

        <div className="admin-filter-chip-row admin-mt-12" aria-label="Customer wallet adjustment policy">
          <StatusBadge tone="neutral">
            <ArrowDownToLine aria-hidden="true" size={14} /> Debit reduces balance
          </StatusBadge>
          <StatusBadge tone="neutral">
            <ArrowUpFromLine aria-hidden="true" size={14} /> Credit increases balance
          </StatusBadge>
          <StatusBadge tone={canCreateRequest ? 'info' : 'warning'}>
            {canCreateRequest ? 'Separate approval required' : 'Request access required'}
          </StatusBadge>
        </div>
      </AdminSection>

      <CustomerWalletLedgerTable
        customerId={customerId}
        walletLedger={walletLedger}
        walletPage={walletPage}
      />
    </>
  );
}

function CustomerWalletLedgerTable({
  customerId,
  walletLedger,
  walletPage,
}: {
  readonly customerId: string;
  readonly walletLedger: AdminCustomerWalletLedgerPage;
  readonly walletPage: number;
}) {
  const { rows, summary, pagination } = walletLedger;
  const totalPages = Math.max(1, Math.ceil(summary.totalCount / Math.max(1, pagination.take)));
  const activePage = Math.min(Math.max(1, walletPage), totalPages);
  const from = rows.length === 0 ? 0 : pagination.skip + 1;
  const to = Math.min(summary.totalCount, pagination.skip + rows.length);

  return (
    <AdminTablePanel
      className="admin-mb-16 customer-wallet-ledger-history"
      description="Immutable wallet flow covering manual adjustments, service payments, refunds, referral credits, and wallet withdrawals."
      id="customer-wallet-history"
      resultLabel={`${summary.totalCount} transaction${summary.totalCount === 1 ? '' : 's'}`}
      resultTone="info"
      title="Wallet transaction history"
    >
      <div className="admin-filter-chip-row admin-mb-12" aria-label="Customer wallet totals">
        <StatusBadge tone="info">
          Balance <MoneyText amount={summary.balance} currency={summary.currency} />
        </StatusBadge>
        <StatusBadge tone="success">
          Money in <MoneyText amount={summary.moneyIn} currency={summary.currency} />
        </StatusBadge>
        <StatusBadge tone="warning">
          Money out <MoneyText amount={summary.moneyOut} currency={summary.currency} />
        </StatusBadge>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No customer wallet transactions have been recorded."
          headers={CUSTOMER_WALLET_LEDGER_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <CustomerWalletLedgerTableRow key={row.id} row={row} />
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel="Customer wallet transaction pages"
        from={from}
        hrefForPage={(page) =>
          `/customers/${encodeURIComponent(customerId)}?walletPage=${page}#customer-wallet-history`
        }
        itemLabel="transactions"
        to={to}
        totalPages={totalPages}
        totalRows={summary.totalCount}
      />
    </AdminTablePanel>
  );
}

function CustomerWalletLedgerTableRow({ row }: { readonly row: AdminCustomerWalletLedgerRow }) {
  const transaction = customerWalletTransactionMeta(row.type);
  const isCredit = row.amount >= 0;

  return (
    <tr>
      <td>
        <DateTimeText value={row.createdAt} />
      </td>
      <td>
        <StatusBadge tone={transaction.tone}>{transaction.label}</StatusBadge>
        <p className="muted admin-mt-6">{isCredit ? 'Money in' : 'Money out'}</p>
        <p className="admin-mt-6">{customerWalletRelatedRecord(row)}</p>
      </td>
      <td>
        <MoneyText amount={row.beforeBalance} currency={row.currency} />
      </td>
      <td>
        <strong>{isCredit ? '+' : '-'}</strong>
        <MoneyText amount={Math.abs(row.amount)} currency={row.currency} />
        <p className="muted admin-mt-6">{isCredit ? 'Credit' : 'Debit'}</p>
      </td>
      <td>
        <MoneyText amount={row.afterBalance} currency={row.currency} />
        {row.notes ? <p className="muted admin-mt-6">{row.notes}</p> : null}
        <details className="customer-wallet-ledger-evidence admin-mt-6">
          <summary>Technical reference</summary>
          <small>{row.reference ?? shortWalletReference(row.sourceKey)}</small>
        </details>
      </td>
    </tr>
  );
}

function customerWalletRelatedRecord(row: AdminCustomerWalletLedgerRow) {
  if (row.bookingId) {
    return (
      <AdminTextLink href={`/bookings/${encodeURIComponent(row.bookingId)}`}>
        Booking {shortWalletReference(row.bookingId)}
      </AdminTextLink>
    );
  }
  if (row.referralRewardId) {
    return (
      <AdminTextLink href="/referrals/customers">
        Referral {shortWalletReference(row.referralRewardId)}
      </AdminTextLink>
    );
  }
  return <span className="muted">Wallet account</span>;
}

function customerWalletTransactionMeta(type: AdminCustomerWalletLedgerType) {
  switch (type) {
    case 'ADMIN_ADJUSTMENT':
      return { label: 'Manual adjustment', tone: 'info' as const };
    case 'CUSTOMER_WALLET_PAYMENT':
    case 'CUSTOMER_REFERRAL_USED_FOR_SERVICE':
      return { label: 'Service payment', tone: 'warning' as const };
    case 'CUSTOMER_REFERRAL_CASHOUT':
      return { label: 'Wallet withdrawal', tone: 'warning' as const };
    case 'REFUND':
      return { label: 'Refund', tone: 'success' as const };
    case 'CUSTOMER_REFERRAL_TAX_WITHHELD':
      return { label: 'Referral tax', tone: 'warning' as const };
    case 'CUSTOMER_REFERRAL_REVERSED':
      return { label: 'Referral reversal', tone: 'warning' as const };
    case 'REFERRAL_REWARD':
    case 'CUSTOMER_REFERRAL_EARNED':
      return { label: 'Referral reward', tone: 'success' as const };
  }
}

function shortWalletReference(value: string) {
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function customerWalletAdjustmentNotice(notice: string | undefined) {
  switch (notice) {
    case 'requested':
      return {
        badge: 'Awaiting approval',
        detail: 'The request is waiting for review by a different finance approver. No ledger or journal was created.',
        title: 'Approval request created',
        tone: 'success' as const,
      };
    case 'attachment-required':
      return {
        badge: 'Evidence required',
        detail: 'Attach a private finance evidence file for adjustments of 10,000,000 VND or more.',
        title: 'Wallet adjustment was not submitted',
        tone: 'warn' as const,
      };
    case 'attachment-invalid':
      return {
        badge: 'Invalid evidence',
        detail: 'Use a PDF, JPEG, PNG, or WebP evidence file no larger than 10 MB.',
        title: 'Wallet adjustment was not submitted',
        tone: 'warn' as const,
      };
    case 'monthly-period-invalid':
      return {
        badge: 'Invalid period',
        detail: 'Choose a currently open DRAFT or REVIEWED accounting month.',
        title: 'Wallet adjustment was not submitted',
        tone: 'warn' as const,
      };
    case 'admin-auth':
      return {
        badge: 'Session required',
        detail: 'Sign in again before applying a wallet adjustment.',
        title: 'Admin authorization failed',
        tone: 'warn' as const,
      };
    case 'failed':
      return {
        badge: 'Adjustment failed',
        detail: 'No wallet transaction was saved. Review the fields and try again.',
        title: 'Wallet adjustment was not applied',
        tone: 'warn' as const,
      };
    default:
      return null;
  }
}
