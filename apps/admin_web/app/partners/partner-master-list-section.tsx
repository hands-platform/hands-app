import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
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

const PARTNER_MASTER_TABLE_HEADERS = [
  'Partner',
  'Gender',
  'Current state',
  'Level',
  'Joined / recent access',
  'Device / IP',
  'Location',
  'Bookings',
  'Feedback records',
  'Revenue',
  'Payout',
  'Ops trail',
  'Account',
] as const;

export function PartnerMasterListSection({ mode = 'default', rows }: PartnerMasterListSectionProps) {
  const copy = buildPartnerMasterListSectionCopy(mode, rows.length);

  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description={copy.description}
        status={<span className="pill pill-info">{copy.statusLabel}</span>}
        title={copy.title}
      />
      <AdminTableScroll>
        <AdminDataTable
          className="service-trace"
          emptyMessage={<PartnerMasterEmptyState />}
          headers={PARTNER_MASTER_TABLE_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.provider.id}>
              <td>
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
              </td>
              <td>{row.gender}</td>
              <td>
                <span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>{row.status}</span>
              </td>
              <td>
                <strong>{row.level}</strong>
                <p className="muted">KYC {row.kycStatus}</p>
              </td>
              <td>
                <strong>{row.joinedAt ? formatDate(row.joinedAt) : 'Not recorded'}</strong>
                <p className="muted">
                  Recent access: {row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}
                </p>
              </td>
              <td>
                <strong>{row.latestSessionDevice}</strong>
                <p className="muted">{row.latestSessionIp}</p>
              </td>
              <td>
                <strong>{providerLocationLabel(row.locationState)}</strong>
                <p className="muted">{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</p>
              </td>
              <td>
                <strong>{row.bookingCount} total</strong>
                <p className="muted">
                  {row.completedCount} completed / {row.closedCount} closed
                </p>
                <p className="muted">
                  Customer {row.customerClosedCount} / admin {row.adminClosedCount} / partner{' '}
                  {row.partnerClosedCount}
                </p>
                <p className="muted">{row.noShowCount} no-show</p>
              </td>
              <td>
                <strong>{row.reviewCount} feedback record(s)</strong>
                <p className="muted">Open detail to read factual feedback records</p>
              </td>
              <td>
                <strong>{formatProviderMoney(row.grossRevenue)}</strong>
                <p className="muted">Platform fee {formatProviderMoney(row.platformFee)}</p>
              </td>
              <td>
                <strong>{formatProviderMoney(row.pendingPayout)}</strong>
                <p className="muted">Available {formatProviderMoney(row.availablePayout)}</p>
              </td>
              <td>
                <strong>{row.auditLogCount} memo/event(s)</strong>
                <p className="muted">{row.latestAuditTitle}</p>
                <p className="muted">{row.latestAuditDetail}</p>
              </td>
              <td>
                <span className={`pill ${row.accountBlocked ? 'pill-danger' : 'pill-success'}`}>
                  {row.accountBlocked ? 'Blocked' : 'Open'}
                </span>
                <p className="muted">{row.accountNote}</p>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </section>
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
