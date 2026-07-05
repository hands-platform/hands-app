import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge } from '../../components/status-badge';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { formatDate, providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import {
  buildPartnerListHref,
  type PartnerPagination,
  type ProviderFilters,
} from './partner-filters';
import type { PartnerMasterRow } from './partner-master-row';

export type PartnerMasterListSectionRow = PartnerMasterRow;

type PartnerMasterListSectionProps = {
  readonly filters: ProviderFilters;
  readonly mode?: PartnerMasterListSectionMode;
  readonly pagination: PartnerPagination<PartnerMasterListSectionRow>;
};

type PartnerMasterListSectionMode = 'default' | 'unapproved' | 'unsettled';

type PartnerMasterListSectionCopy = {
  description: string;
  statusLabel: string;
  title: string;
};

const DEFAULT_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Gender',
  'State',
  'Level',
  'Access',
  'Location',
  'Work',
  'Wallet',
  'Account',
] as const;

const UNAPPROVED_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Gender',
  'Approval needs',
  'KYC / Level',
  'Access',
  'Location',
  'Account',
] as const;

const UNSETTLED_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'State',
  'Work',
  'Wallet',
  'Revenue',
  'Payout',
  'Account',
] as const;

export function PartnerMasterListSection({ filters, mode = 'default', pagination }: PartnerMasterListSectionProps) {
  const rows = pagination.rows;
  const copy = buildPartnerMasterListSectionCopy(mode, pagination.totalRows);
  const headers = partnerMasterTableHeaders(mode);

  return (
    <AdminTablePanel
      className="vuexy-partner-table-card"
      description={copy.description}
      id={`partner-master-list-${mode}`}
      resultLabel={copy.statusLabel}
      title={copy.title}
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table vuexy-partner-table"
          emptyMessage={<PartnerMasterEmptyState />}
          headers={headers}
          rowCount={rows.length}
        >
          {rows.map((row) => renderPartnerMasterRow(row, mode))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel={`${copy.title} pages`}
        className="vuexy-partner-table-footer"
        from={pagination.from}
        hrefForPage={(page) => buildPartnerListHref(filters, { page })}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}

function partnerMasterTableHeaders(mode: PartnerMasterListSectionMode) {
  if (mode === 'unapproved') return UNAPPROVED_PARTNER_MASTER_TABLE_HEADERS;
  if (mode === 'unsettled') return UNSETTLED_PARTNER_MASTER_TABLE_HEADERS;
  return DEFAULT_PARTNER_MASTER_TABLE_HEADERS;
}

function renderPartnerMasterRow(row: PartnerMasterListSectionRow, mode: PartnerMasterListSectionMode) {
  if (mode === 'unapproved') {
    return (
      <tr key={row.provider.id}>
        <td>{renderPartnerCell(row)}</td>
        <td>{row.gender}</td>
        <td>{renderApprovalNeedsCell(row)}</td>
        <td>{renderLevelCell(row)}</td>
        <td>{renderAccessCell(row)}</td>
        <td>{renderLocationCell(row)}</td>
        <td>{renderAccountCell(row, { showApprovalNeeds: false })}</td>
      </tr>
    );
  }

  if (mode === 'unsettled') {
    return (
      <tr key={row.provider.id}>
        <td>{renderPartnerCell(row)}</td>
        <td>{renderStateCell(row)}</td>
        <td>{renderWorkCell(row)}</td>
        <td>{renderWalletCell(row)}</td>
        <td>{renderRevenueCell(row)}</td>
        <td>{renderPayoutCell(row)}</td>
        <td>{renderAccountCell(row)}</td>
      </tr>
    );
  }

  return (
    <tr key={row.provider.id}>
      <td>{renderPartnerCell(row)}</td>
      <td>{row.gender}</td>
      <td>{renderStateCell(row)}</td>
      <td>{renderLevelCell(row)}</td>
      <td>{renderAccessCell(row)}</td>
      <td>{renderLocationCell(row)}</td>
      <td>{renderWorkCell(row)}</td>
      <td>{renderWalletCell(row)}</td>
      <td>{renderAccountCell(row)}</td>
    </tr>
  );
}

function renderPartnerCell(row: PartnerMasterListSectionRow) {
  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus={row.avatarStatus}
      className="vuexy-booking-person vuexy-partner-person"
      copyClassName="vuexy-booking-person-copy"
      helper={<PartnerCellHelper row={row} />}
      href={`/partners/${row.provider.id}`}
      initials={row.initials}
      label={row.displayName}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function PartnerCellHelper({ row }: { readonly row: PartnerMasterListSectionRow }) {
  return (
    <div className="vuexy-partner-person-helper">
      <span>{row.phone}</span>
      <small>{row.legalName}</small>
    </div>
  );
}

function renderStateCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={row.online ? 'success' : 'neutral'}>{row.status}</StatusBadge>
      <small>{row.latestSessionPlatform}</small>
    </div>
  );
}

function renderLevelCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{row.level}</strong>
      <small>KYC {row.kycStatus}</small>
    </div>
  );
}

function renderAccessCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}</strong>
      <small>Joined {row.joinedAt ? formatDate(row.joinedAt) : 'not recorded'}</small>
      <small>{row.latestSessionIp}</small>
    </div>
  );
}

function renderLocationCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{providerLocationLabel(row.locationState)}</strong>
      <small>{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</small>
    </div>
  );
}

function renderWorkCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{row.bookingCount} total</strong>
      <small>
        {row.completedCount} completed / {row.closedCount} closed
      </small>
      <small>{row.noShowCount} no-show / {row.reviewCount} review(s)</small>
    </div>
  );
}

function renderWalletCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatProviderMoney(row.walletBalance)}</strong>
      <small>
        {row.walletBalance < 0
          ? 'Settlement required'
          : 'No negative balance'}
      </small>
      <small>
        Pending {formatProviderMoney(row.pendingPayout)} / available {formatProviderMoney(row.availablePayout)}
      </small>
      {renderWalletWithdrawalSignal(row)}
    </div>
  );
}

function renderWalletWithdrawalSignal(row: PartnerMasterListSectionRow) {
  if (row.walletWithdrawalAdminActionCount > 0) {
    return (
      <small>
        <StatusBadge tone="warning">Withdrawal action</StatusBadge>{' '}
        {row.walletWithdrawalLatestAmount === null
          ? row.walletWithdrawalLatestStatus
          : formatProviderMoney(row.walletWithdrawalLatestAmount)}
      </small>
    );
  }

  if (row.walletWithdrawalOpenCount > 0) {
    return (
      <small>
        <StatusBadge tone="info">Withdrawal pending</StatusBadge> {row.walletWithdrawalLatestStatus}
      </small>
    );
  }

  return null;
}

function renderRevenueCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatProviderMoney(row.grossRevenue)}</strong>
      <small>Platform fee {formatProviderMoney(row.platformFee)}</small>
    </div>
  );
}

function renderPayoutCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatProviderMoney(row.pendingPayout)}</strong>
      <small>Available {formatProviderMoney(row.availablePayout)}</small>
    </div>
  );
}

function renderApprovalNeedsCell(row: PartnerMasterListSectionRow) {
  if (!row.approvalIssues.length) {
    return <StatusBadge tone="success">Approval clear</StatusBadge>;
  }

  return (
    <StatusBadge tone={row.approvalIssues.some((issue) => issue.severity === 'high') ? 'danger' : 'warning'}>
      {row.approvalIssues.length} approval need(s)
    </StatusBadge>
  );
}

function renderAccountCell(
  row: PartnerMasterListSectionRow,
  options: { readonly showApprovalNeeds?: boolean } = {},
) {
  const showApprovalNeeds = options.showApprovalNeeds ?? true;

  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={row.accountBlocked ? 'danger' : 'success'}>
        {row.accountBlocked ? 'Account blocked' : 'Account clear'}
      </StatusBadge>
      <small>{row.accountNote}</small>
      {showApprovalNeeds ? renderApprovalNeedsCell(row) : null}
      <small>{row.auditLogCount} memo/event(s)</small>
    </div>
  );
}

function buildPartnerMasterListSectionCopy(
  mode: PartnerMasterListSectionMode,
  rowCount: number,
): PartnerMasterListSectionCopy {
  if (mode === 'unapproved') {
    return {
      description:
        'Approval-first list for Partners who cannot operate yet because registration, KYC, required documents, public media, device, or account-hold facts still need admin review.',
      statusLabel: `${rowCount} approval row(s)`,
      title: 'Unapproved Partners',
    };
  }

  if (mode === 'unsettled') {
    return {
      description:
        'Settlement-first list for Partners with negative wallet balance from unpaid HANDS commission. Check debt, payout, and account state before final acceptance, service start, or payout release.',
      statusLabel: `${rowCount} settlement row(s)`,
      title: 'Unsettled Partners',
    };
  }

  return {
    description:
      'Compact admin list for ID, profile, contact, onboarding level, app status, location freshness, booking volume, feedback records, revenue, payout readiness, and account state.',
    statusLabel: `${rowCount} visible row(s)`,
    title: 'Partners',
  };
}

function PartnerMasterEmptyState() {
  return (
    <AdminEmptyState
      message="Change the filters or clear search to view partner records."
      title="No partner rows found"
    />
  );
}
