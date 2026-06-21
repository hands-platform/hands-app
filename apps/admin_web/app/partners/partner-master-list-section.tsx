import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { formatDate, providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import type { PartnerMasterRow } from './partner-master-row';

export type PartnerMasterListSectionRow = PartnerMasterRow;

type PartnerMasterListSectionProps = {
  readonly mode?: PartnerMasterListSectionMode;
  readonly rows: readonly PartnerMasterListSectionRow[];
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

export function PartnerMasterListSection({ mode = 'default', rows }: PartnerMasterListSectionProps) {
  const copy = buildPartnerMasterListSectionCopy(mode, rows.length);
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
        <span>{partnerMasterListFooterLabel(rows.length)}</span>
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

function partnerMasterListFooterLabel(rowCount: number) {
  if (rowCount <= 0) return 'Showing 0 entries';
  return `Showing 1 to ${rowCount} of ${rowCount} entries`;
}

function renderPartnerCell(row: PartnerMasterListSectionRow) {
  return (
    <AdminPersonCell
      avatarClassName="vuexy-booking-avatar is-partner"
      avatarStatus={row.avatarStatus}
      className="vuexy-booking-person"
      helper={`${row.legalName} | ${row.phone} | ${row.provider.id}`}
      href={`/partners/${row.provider.id}`}
      initials={row.initials}
      label={row.displayName}
      linkClassName="table-link"
    />
  );
}

function renderStateCell(row: PartnerMasterListSectionRow) {
  return <span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>{row.status}</span>;
}

function renderLevelCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{row.level}</strong>
      <p className="muted">KYC {row.kycStatus}</p>
    </>
  );
}

function renderAccessCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{row.joinedAt ? formatDate(row.joinedAt) : 'Not recorded'}</strong>
      <p className="muted">Recent access: {row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}</p>
      <p className="muted">{row.latestSessionDevice}</p>
      <p className="muted">{row.latestSessionIp}</p>
    </>
  );
}

function renderLocationCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{providerLocationLabel(row.locationState)}</strong>
      <p className="muted">{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</p>
    </>
  );
}

function renderWorkCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{row.bookingCount} total</strong>
      <p className="muted">
        {row.completedCount} completed / {row.closedCount} closed
      </p>
      <p className="muted">
        Customer {row.customerClosedCount} / admin {row.adminClosedCount} / partner {row.partnerClosedCount}
      </p>
      <p className="muted">
        {row.noShowCount} no-show / {row.reviewCount} feedback record(s)
      </p>
    </>
  );
}

function renderWalletCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{formatProviderMoney(row.walletBalance)}</strong>
      <p className="muted">
        {row.walletBalance < 0
          ? 'Settlement required before final acceptance, service start, and payout release.'
          : 'No negative wallet balance recorded.'}
      </p>
      <p className="muted">
        Pending {formatProviderMoney(row.pendingPayout)} / available {formatProviderMoney(row.availablePayout)}
      </p>
    </>
  );
}

function renderRevenueCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{formatProviderMoney(row.grossRevenue)}</strong>
      <p className="muted">Platform fee {formatProviderMoney(row.platformFee)}</p>
    </>
  );
}

function renderPayoutCell(row: PartnerMasterListSectionRow) {
  return (
    <>
      <strong>{formatProviderMoney(row.pendingPayout)}</strong>
      <p className="muted">Available {formatProviderMoney(row.availablePayout)}</p>
    </>
  );
}

function renderApprovalNeedsCell(row: PartnerMasterListSectionRow) {
  if (!row.approvalIssues.length) {
    return <p className="muted">Approval clear</p>;
  }

  return (
    <>
      <div className="participant-list" aria-label="Approval needs">
        <span className="pill pill-warn">{row.approvalIssues.length} approval need(s)</span>
        {row.approvalIssues.slice(0, 4).map((issue) => (
          <span
            className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`}
            key={issue.label}
          >
            {issue.label}
          </span>
        ))}
      </div>
      {row.approvalIssues.length > 4 ? (
        <p className="muted">+{row.approvalIssues.length - 4} more approval item(s)</p>
      ) : null}
    </>
  );
}

function renderAccountCell(
  row: PartnerMasterListSectionRow,
  options: { readonly showApprovalNeeds?: boolean } = {},
) {
  const showApprovalNeeds = options.showApprovalNeeds ?? true;

  return (
    <>
      <span className={`pill ${row.accountBlocked ? 'pill-danger' : 'pill-success'}`}>
        {row.accountBlocked ? 'Blocked' : 'Open'}
      </span>
      <p className="muted">{row.accountNote}</p>
      {showApprovalNeeds ? renderApprovalNeedsCell(row) : null}
      <p className="muted admin-mt-8">{row.auditLogCount} memo/event(s)</p>
      <p className="muted">{row.latestAuditTitle}</p>
      <p className="muted">{row.latestAuditDetail}</p>
    </>
  );
}

function buildPartnerMasterListSectionCopy(
  mode: PartnerMasterListSectionMode,
  rowCount: number,
): PartnerMasterListSectionCopy {
  if (mode === 'unapproved') {
    return {
      description:
        'Approval-first list for Partners who cannot operate yet because registration, KYC, documents, public media, bank, tax, device, or account-hold facts still need admin review.',
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
