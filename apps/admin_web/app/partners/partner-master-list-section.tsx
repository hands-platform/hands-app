import Link from 'next/link';
import { User } from 'lucide-react';

import { AdminTableScroll } from '../../components/admin-data-table';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminAvatarStatusDot } from '../../components/admin-person-cell';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { formatDate, providerLocationAgeLabel, providerLocationLabel } from './partner-list-ops';
import type { PartnerMasterRow } from './partner-master-row';

export type PartnerMasterListSectionRow = PartnerMasterRow;

type PartnerMasterListSectionProps = {
  readonly rows: readonly PartnerMasterListSectionRow[];
};

export function PartnerMasterListSection({ rows }: PartnerMasterListSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Compact admin list for ID, profile, contact, onboarding level, app status, location freshness, booking volume, feedback records, revenue, payout readiness, and account state."
        status={<span className="pill pill-info">{rows.length} visible row(s)</span>}
        title="Partner master list"
      />
      <AdminTableScroll>
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Partner ID</th>
              <th>Profile</th>
              <th>Name / activity name</th>
              <th>Phone</th>
              <th>Gender</th>
              <th>Current state</th>
              <th>Level</th>
              <th>Joined / recent access</th>
              <th>Device / IP</th>
              <th>Location</th>
              <th>Bookings</th>
              <th>Feedback records</th>
              <th>Revenue</th>
              <th>Payout</th>
              <th>Ops trail</th>
              <th>Account</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.provider.id}>
                <td>
                  <code>{row.provider.id}</code>
                </td>
                <td>
                  <div className="admin-person-avatar-shell">
                    <div className="media-thumb" aria-label={`${row.displayName} profile thumbnail placeholder`}>
                      {row.initials}
                    </div>
                    <AdminAvatarStatusDot status={row.avatarStatus} />
                  </div>
                </td>
                <td>
                  <strong>{row.displayName}</strong>
                  <p className="muted">{row.legalName}</p>
                </td>
                <td>{row.phone}</td>
                <td>{row.gender}</td>
                <td>
                  <span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>
                    {row.status}
                  </span>
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
                <td>
                  <Link className="button button-secondary admin-inline-action" href={`/partners/${row.provider.id}`}>
                    <User aria-hidden="true" size={14} />
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={17}>
                  <strong>No partner rows found</strong>
                  <p className="muted">Change the filters or clear search to view partner records.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AdminTableScroll>
    </section>
  );
}
