import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card"
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
      <div className="vuexy-booking-table-footer vuexy-partner-table-footer">
        <span>{partnerMasterListFooterLabel(pagination)}</span>
        <AdminRoundedPagination
          activePage={pagination.page}
          ariaLabel={`${copy.title} pages`}
          className="vuexy-booking-pagination"
          hrefForPage={(page) => buildPartnerListHref(filters, { page })}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={pagination.totalPages}
        />
      </div>
    </AdminFilterPanel>
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

function partnerMasterListFooterLabel(pagination: PartnerPagination<unknown>) {
  if (pagination.totalRows <= 0) return 'Showing 0 entries';
  return `Showing ${pagination.from} to ${pagination.to} of ${pagination.totalRows} entries`;
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
      <span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>{row.status}</span>
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
    </div>
  );
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
    return <span className="pill pill-success">Approval clear</span>;
  }

  return (
    <span
      className={`pill ${
        row.approvalIssues.some((issue) => issue.severity === 'high') ? 'pill-danger' : 'pill-warn'
      }`}
    >
      {row.approvalIssues.length} approval need(s)
    </span>
  );
}

function renderAccountCell(
  row: PartnerMasterListSectionRow,
  options: { readonly showApprovalNeeds?: boolean } = {},
) {
  const showApprovalNeeds = options.showApprovalNeeds ?? true;

  return (
    <div className="vuexy-partner-stack">
      <span className={`pill ${row.accountBlocked ? 'pill-danger' : 'pill-success'}`}>
        {row.accountBlocked ? 'Account blocked' : 'Account clear'}
      </span>
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
    <>
      <strong>No partner rows found</strong>
      <p className="muted">Change the filters or clear search to view partner records.</p>
    </>
  );
}
