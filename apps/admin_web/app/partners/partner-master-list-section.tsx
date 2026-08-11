import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { adminCountLabel, partnerOperatingStatusLabel } from '../../lib/admin-copy';
import { formatMoney as formatProviderMoney, formatRelativeAge } from '../../lib/admin-format';
import { providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import { buildPartnerListHref, type PartnerPagination, type ProviderFilters } from './partner-filters';
import type { PartnerMasterRow } from './partner-master-row';
import { PARTNER_APPROVAL_QUEUE_HREF, partnerApprovalQueueDetailHref } from './partner-review-mode';

export type PartnerMasterListSectionRow = PartnerMasterRow;

type PartnerMasterListSectionProps = {
  readonly filters: ProviderFilters;
  readonly mode?: PartnerMasterListSectionMode;
  readonly pagination: PartnerPagination<PartnerMasterListSectionRow>;
};

type PartnerMasterListSectionMode = 'approval-pending' | 'default' | 'unapproved' | 'unsettled';

type PartnerMasterListSectionCopy = {
  description: string;
  statusLabel: string;
  title: string;
};

const DEFAULT_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Availability',
  'Onboarding',
  'Activity',
  'Wallet',
  'Account / action',
] as const;

const UNAPPROVED_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Stage',
  'Next action',
  'Partner activity',
  'Account',
  'Action',
] as const;

const UNSETTLED_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Debt',
  'Restrictions',
  'Withdrawal',
  'Account',
  'Action',
] as const;

const APPROVAL_PENDING_PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Submitted / Age',
  'Review state',
  'Top issues',
  'Correction context',
  'Action',
] as const;

export function PartnerMasterListSection({
  filters,
  mode = 'default',
  pagination,
}: PartnerMasterListSectionProps) {
  const rows = pagination.rows;
  const copy = buildPartnerMasterListSectionCopy(mode, pagination.totalRows);
  const headers = partnerMasterTableHeaders(mode);

  if (mode === 'approval-pending' && rows.length === 0) {
    return <PartnerApprovalEmptyState filters={filters} />;
  }

  return (
    <AdminTablePanel
      className="vuexy-partner-table-card"
      description={copy.description}
      id={`partner-master-list-${mode}`}
      resultLabel={copy.statusLabel}
      title={copy.title}
    >
      <AdminTableScroll ariaLabel={`${copy.title} records`}>
        <AdminDataTable
          className={`vuexy-booking-table vuexy-partner-table is-${mode}`}
          emptyMessage={<PartnerMasterEmptyState filters={filters} mode={mode} />}
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
  if (mode === 'approval-pending') return APPROVAL_PENDING_PARTNER_MASTER_TABLE_HEADERS;
  if (mode === 'unapproved') return UNAPPROVED_PARTNER_MASTER_TABLE_HEADERS;
  if (mode === 'unsettled') return UNSETTLED_PARTNER_MASTER_TABLE_HEADERS;
  return DEFAULT_PARTNER_MASTER_TABLE_HEADERS;
}

function renderPartnerMasterRow(row: PartnerMasterListSectionRow, mode: PartnerMasterListSectionMode) {
  if (mode === 'approval-pending') {
    return (
      <tr key={row.provider.id}>
        <td data-label="Partner">{renderPartnerCell(row)}</td>
        <td data-label="Submitted / Age">{renderApprovalSubmittedCell(row)}</td>
        <td data-label="Review state">{renderApprovalStateCell(row)}</td>
        <td data-label="Top issues">{renderApprovalQueueIssuesCell(row)}</td>
        <td data-label="Correction context">{renderApprovalHoldReasonCell(row)}</td>
        <td data-label="Action">
          <AdminFormControlLink
            className="button-secondary"
            href={partnerApprovalQueueDetailHref(row.provider.id)}
          >
            Review submission
          </AdminFormControlLink>
        </td>
      </tr>
    );
  }

  if (mode === 'unapproved') {
    return (
      <tr key={row.provider.id}>
        <td data-label="Partner">{renderPartnerCell(row)}</td>
        <td data-label="Stage">{renderOnboardingStageCell(row)}</td>
        <td data-label="Next action">{renderOnboardingNextActionCell(row)}</td>
        <td data-label="Partner activity">{renderPartnerActivityCell(row)}</td>
        <td data-label="Account">{renderAccountCell(row, { showApprovalNeeds: false })}</td>
        <td data-label="Action">{renderOpenPartnerAction(row, 'Review blockers')}</td>
      </tr>
    );
  }

  if (mode === 'unsettled') {
    return (
      <tr key={row.provider.id}>
        <td data-label="Partner">{renderPartnerCell(row)}</td>
        <td data-label="Debt">{renderWalletDebtCell(row)}</td>
        <td data-label="Restrictions">{renderWalletRestrictionsCell()}</td>
        <td data-label="Withdrawal">{renderWithdrawalCell(row)}</td>
        <td data-label="Account">{renderAccountCell(row, { showApprovalNeeds: false })}</td>
        <td data-label="Action">{renderOpenPartnerAction(row, 'Review wallet debt')}</td>
      </tr>
    );
  }

  return (
    <tr key={row.provider.id}>
      <td data-label="Partner">{renderPartnerCell(row)}</td>
      <td data-label="Availability">{renderAvailabilityCell(row)}</td>
      <td data-label="Onboarding">{renderOnboardingCell(row)}</td>
      <td data-label="Activity">{renderActivityCell(row)}</td>
      <td data-label="Wallet">{renderWalletCell(row)}</td>
      <td data-label="Account / action">{renderAccountActionCell(row)}</td>
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
      <small>
        Partner ID {row.provider.id.slice(-8)} · {row.phone === 'No phone' ? 'Phone not saved' : 'Phone saved'}
      </small>
    </div>
  );
}

function PartnerApprovalEmptyState({ filters }: { readonly filters: ProviderFilters }) {
  const filtered = Boolean(
    filters.age !== 'all' ||
    filters.approvalMissing ||
    filters.approvalRisk ||
    filters.q ||
    (filters.sla && filters.sla !== 'all'),
  );

  return (
    <AdminTablePanel
      className="vuexy-partner-table-card"
      description="The approval queue is empty. Continue with held submissions or return to the full directory."
      id="partner-master-list-approval-pending"
      resultLabel="0 awaiting decision"
      title="Partner approvals"
    >
      <AdminEmptyState
        className="partner-approval-empty-state"
        message={
          filtered
            ? 'No submitted dossier matches the current approval filters.'
            : 'No Partner submission is waiting for an approval decision.'
        }
        title={filtered ? 'No approvals match these filters' : 'Approval queue is clear'}
      />
      <div className="actions admin-mt-8 partner-approval-empty-actions">
        {filtered ? (
          <AdminFormControlLink className="button-secondary" href={PARTNER_APPROVAL_QUEUE_HREF}>
            Clear approval filters
          </AdminFormControlLink>
        ) : null}
        <AdminFormControlLink className="button-secondary" href="/partners?review=unapproved">
          View onboarding blockers
        </AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href="/partners">
          Open partner directory
        </AdminFormControlLink>
      </div>
    </AdminTablePanel>
  );
}

function renderStateCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={row.online ? 'success' : 'neutral'}>
        {partnerOperatingStatusLabel(row.status)}
      </StatusBadge>
      <small>{row.latestSessionPlatform}</small>
    </div>
  );
}

function renderAvailabilityCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      {renderStateCell(row)}
      {renderLocationCell(row)}
    </div>
  );
}

function renderLevelCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{partnerOperatingStatusLabel(row.level)}</strong>
      <small>KYC {partnerOperatingStatusLabel(row.kycStatus)}</small>
    </div>
  );
}

function renderOnboardingStageCell(row: PartnerMasterListSectionRow) {
  let stage = 'Registration';

  if (row.accountBlocked) {
    stage = 'Hold';
  } else if (row.verificationStatus !== 'APPROVED') {
    stage = 'Verification';
  } else if (row.kycStatus !== 'APPROVED') {
    stage = 'KYC';
  } else if (row.approvalIssues.some((issue) => /document|media/i.test(issue.label))) {
    stage = 'Documents';
  }

  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={row.accountBlocked ? 'danger' : 'warning'}>{stage}</StatusBadge>
      <small>
        {partnerOperatingStatusLabel(row.verificationStatus)} · KYC {partnerOperatingStatusLabel(row.kycStatus)}
      </small>
    </div>
  );
}

function renderOnboardingCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      {renderLevelCell(row)}
      {renderApprovalNeedsCell(row)}
    </div>
  );
}

function renderAccessCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={partnerAppActivityTone(row.appActivityStatus)}>
        {partnerAppActivityLabel(row.appActivityStatus)}
      </StatusBadge>
      <small>
        App <DateTimeText fallback="not tracked" value={row.appLastActiveAt} />
      </small>
      <small>
        Session <DateTimeText fallback="not recorded" value={row.lastSeenAt} />
      </small>
    </div>
  );
}

function partnerAppActivityLabel(status: PartnerMasterListSectionRow['appActivityStatus']) {
  if (status === 'active') return 'App active 7D';
  if (status === 'inactive_7d') return 'App inactive 7D+';
  return 'App not tracked';
}

function partnerAppActivityTone(
  status: PartnerMasterListSectionRow['appActivityStatus'],
): 'danger' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'inactive_7d') return 'danger';
  return 'warning';
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
      <small>
        {adminCountLabel(row.noShowCount, 'no-show')} / {adminCountLabel(row.reviewCount, 'review')}
      </small>
    </div>
  );
}

function renderWalletCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatProviderMoney(row.walletBalance)}</strong>
      <small>{row.walletBalance < 0 ? 'Settlement required' : 'No negative balance'}</small>
      <small>
        Pending {formatProviderMoney(row.pendingPayout)} / available{' '}
        {formatProviderMoney(row.availablePayout)}
      </small>
      {renderWalletWithdrawalSignal(row)}
    </div>
  );
}

function renderWalletDebtCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatProviderMoney(row.walletBalance)}</strong>
      <small>Canonical VND wallet balance</small>
    </div>
  );
}

function renderWalletRestrictionsCell() {
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone="danger">Acceptance / service blocked</StatusBadge>
      <StatusBadge tone="warning">Payout release blocked</StatusBadge>
      <small>Marketplace visibility remains available</small>
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

function renderWithdrawalCell(row: PartnerMasterListSectionRow) {
  if (row.walletWithdrawalLatestStatus === 'NONE') {
    return <span className="muted">No open withdrawal</span>;
  }

  return (
    <div className="vuexy-partner-stack">
      <strong>{row.walletWithdrawalLatestStatus}</strong>
      <small>
        {row.walletWithdrawalLatestAmount === null
          ? 'No withdrawal amount'
          : formatProviderMoney(row.walletWithdrawalLatestAmount)}
      </small>
      {renderWalletWithdrawalSignal(row)}
    </div>
  );
}

function renderApprovalNeedsCell(row: PartnerMasterListSectionRow) {
  if (!row.approvalIssues.length) {
    return <StatusBadge tone="success">Approval clear</StatusBadge>;
  }

  const visibleIssues = row.approvalIssues.slice(0, 2);
  const hiddenIssueCount = row.approvalIssues.length - visibleIssues.length;

  return (
    <div className="vuexy-partner-stack">
      {visibleIssues.map((issue) => (
        <StatusBadge key={issue.label} tone={issue.severity === 'high' ? 'danger' : 'warning'}>
          {issue.label}
        </StatusBadge>
      ))}
      {hiddenIssueCount > 0 ? <small>{`+${hiddenIssueCount} more`}</small> : null}
    </div>
  );
}

function renderOnboardingNextActionCell(row: PartnerMasterListSectionRow) {
  const issue = row.approvalIssues[0];
  if (!issue) return <StatusBadge tone="success">No onboarding action</StatusBadge>;

  const nextAction = onboardingNextAction(row, issue.label);
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={issue.severity === 'high' ? 'danger' : 'warning'}>{nextAction.owner}</StatusBadge>
      <strong>{nextAction.action}</strong>
      <small>{issue.label}</small>
      {row.approvalIssues.length > 1 ? <small>{`+${row.approvalIssues.length - 1} more`}</small> : null}
    </div>
  );
}

function onboardingNextAction(row: PartnerMasterListSectionRow, label: string) {
  if (row.accountBlocked) return { action: 'Review account hold', owner: 'Operator' };
  if (/identity docs/i.test(label)) return { action: 'Upload required identity documents', owner: 'Partner' };
  if (/document rejected/i.test(label)) return { action: 'Replace rejected document', owner: 'Partner' };
  if (/document pending/i.test(label)) return { action: 'Review submitted document', owner: 'Operator' };
  if (/media rejected/i.test(label)) return { action: 'Replace rejected profile media', owner: 'Partner' };
  if (/media pending/i.test(label)) return { action: 'Review submitted profile media', owner: 'Operator' };
  if (/verification/i.test(label)) {
    if (row.verificationStatus === 'SUBMITTED') return { action: 'Review verification submission', owner: 'Operator' };
    if (row.verificationStatus === 'REJECTED') return { action: 'Resubmit verification', owner: 'Partner' };
    if (row.verificationStatus !== 'APPROVED') return { action: 'Complete verification', owner: 'Partner' };
    return { action: `Review required: ${label}`, owner: 'Operator' };
  }
  if (/kyc/i.test(label)) {
    if (row.kycStatus === 'PENDING') return { action: 'Review KYC submission', owner: 'Operator' };
    if (row.kycStatus === 'REJECTED') return { action: 'Resubmit KYC', owner: 'Partner' };
    if (row.kycStatus !== 'APPROVED') return { action: 'Complete KYC', owner: 'Partner' };
    return { action: `Review required: ${label}`, owner: 'Operator' };
  }
  return { action: `Review required: ${label}`, owner: 'Operator' };
}

function renderApprovalSubmittedCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <strong>{formatRelativeAge(row.approvalSubmittedAt, 'Waiting time unavailable')}</strong>
      <small>
        <DateTimeText fallback="Submission time unavailable" value={row.approvalSubmittedAt} />
      </small>
    </div>
  );
}

function renderActivityCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      {renderAccessCell(row)}
      {renderWorkCell(row)}
    </div>
  );
}

function renderPartnerActivityCell(row: PartnerMasterListSectionRow) {
  return renderAccessCell(row);
}

function renderApprovalStateCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone={partnerApprovalStatusTone(row.verificationStatus)}>
        Verification {partnerOperatingStatusLabel(row.verificationStatus)}
      </StatusBadge>
      <StatusBadge tone={partnerApprovalStatusTone(row.kycStatus)}>
        KYC {partnerOperatingStatusLabel(row.kycStatus)}
      </StatusBadge>
    </div>
  );
}

function renderApprovalQueueIssuesCell(row: PartnerMasterListSectionRow) {
  if (!row.approvalQueueIssues.length) {
    return <StatusBadge tone="success">Documents ready</StatusBadge>;
  }

  const visibleIssues = row.approvalQueueIssues.slice(0, 2);
  const hiddenIssueCount = row.approvalQueueIssues.length - visibleIssues.length;

  return (
    <div className="vuexy-partner-stack">
      {visibleIssues.map((issue) => (
        <StatusBadge key={issue.label} tone={issue.severity === 'high' ? 'danger' : 'warning'}>
          {issue.label}
        </StatusBadge>
      ))}
      {hiddenIssueCount > 0 ? <small>{`+${hiddenIssueCount} more`}</small> : null}
    </div>
  );
}

function renderApprovalHoldReasonCell(row: PartnerMasterListSectionRow) {
  if (!row.approvalHoldReason) {
    return <span className="muted">No hold reason</span>;
  }

  return (
    <div className="vuexy-partner-stack">
      <StatusBadge tone="warning">Correction context</StatusBadge>
      <small>{row.approvalHoldReason}</small>
    </div>
  );
}

function partnerApprovalStatusTone(status: string): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED' || status === 'BLOCKED') return 'danger';
  if (status === 'SUBMITTED' || status === 'PENDING') return 'warning';
  return 'neutral';
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
      <small>{adminCountLabel(row.auditLogCount, 'memo or event', 'memos or events')}</small>
    </div>
  );
}

function renderOpenPartnerAction(row: PartnerMasterListSectionRow, label: string) {
  return (
    <AdminFormControlLink className="button-secondary" href={`/partners/${row.provider.id}`}>
      {label}
    </AdminFormControlLink>
  );
}

function renderAccountActionCell(row: PartnerMasterListSectionRow) {
  return (
    <div className="vuexy-partner-stack">
      {renderAccountCell(row, { showApprovalNeeds: false })}
      {renderOpenPartnerAction(row, 'Open profile')}
    </div>
  );
}

function buildPartnerMasterListSectionCopy(
  mode: PartnerMasterListSectionMode,
  rowCount: number,
): PartnerMasterListSectionCopy {
  if (mode === 'approval-pending') {
    return {
      description:
        'Check waiting time, verification and KYC state, missing materials, and previous hold context before opening the Partner review. Use Oldest pending to clear overdue submissions first.',
      statusLabel: `${rowCount} awaiting decision`,
      title: 'Partner approvals',
    };
  }

  if (mode === 'unapproved') {
    return {
      description:
        'Partners blocked from onboarding by verification, KYC, required evidence, or an account hold.',
      statusLabel: adminCountLabel(rowCount, 'onboarding blocker'),
      title: 'Onboarding blockers',
    };
  }

  if (mode === 'unsettled') {
    return {
      description:
        'Partners with a negative canonical VND wallet balance. Open Partner detail to review ledger origin before clearing restrictions.',
      statusLabel: adminCountLabel(rowCount, 'wallet debt record'),
      title: 'Wallet debt',
    };
  }

  return {
    description:
      'Search by partner name, phone, or ID, then open a profile to review status and restrictions.',
    statusLabel: adminCountLabel(rowCount, 'matching Partner'),
    title: 'Partner directory',
  };
}

function PartnerMasterEmptyState({
  filters,
  mode,
}: {
  readonly filters: ProviderFilters;
  readonly mode: PartnerMasterListSectionMode;
}) {
  const filtered = Boolean(
    filters.q ||
      filters.activity ||
      filters.verification ||
      filters.kyc ||
      filters.providerStatus ||
      filters.bookingFlow,
  );
  const queueName =
    mode === 'unapproved' ? 'onboarding blockers' : mode === 'unsettled' ? 'wallet debt records' : 'Partners';
  const resetHref =
    mode === 'unapproved'
      ? '/partners?review=unapproved'
      : mode === 'unsettled'
        ? '/partners?review=unsettled'
        : '/partners';

  return (
    <div className="vuexy-partner-stack">
      <AdminEmptyState
        message={
          filtered
            ? `No ${queueName} match the current filters.`
            : `No ${queueName} are currently available in this queue.`
        }
        title={filtered ? 'No results match these filters' : 'This queue is clear'}
      />
      <div className="actions partner-approval-empty-actions">
        <AdminFormControlLink className="button-secondary" href={resetHref}>
          {filtered ? 'Reset filters' : 'Refresh current queue'}
        </AdminFormControlLink>
      </div>
    </div>
  );
}
