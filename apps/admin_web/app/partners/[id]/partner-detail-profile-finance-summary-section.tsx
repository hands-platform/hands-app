import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailInfoLine = {
  readonly label: string;
  readonly value?: string | null;
};

export type PartnerAgreementBadge = {
  readonly id: string;
  readonly label: string;
};

export type PartnerRecentPayoutRecordLine = {
  readonly id: string;
  readonly label: string;
};

export type PartnerLocationSnapshotBadge = {
  readonly id: string;
  readonly label: string;
};

type PartnerDetailBasicProfileCardProps = {
  readonly note: string;
  readonly rows: readonly PartnerDetailInfoLine[];
};

type PartnerDetailAgreementsCardProps = {
  readonly agreements: readonly PartnerAgreementBadge[];
};

type PartnerDetailRecentPayoutRecordsCardProps = {
  readonly earningCount: number;
  readonly earnings: readonly PartnerRecentPayoutRecordLine[];
  readonly payoutBatchCount: number;
};

type PartnerDetailLocationActivityCardProps = {
  readonly coordinatesLabel?: string | null;
  readonly lastLocationLabel?: string | null;
  readonly snapshots: readonly PartnerLocationSnapshotBadge[];
};

export function PartnerDetailBasicProfileCard({ note, rows }: PartnerDetailBasicProfileCardProps) {
  return (
    <div className="card">
      <div className="ops-section-header">
        <div>
          <h2>Basic profile</h2>
          <p className="muted">Partner identity, service area, profile review, and user account fields.</p>
        </div>
        <span className="pill pill-info">{rows.length} field(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<ProfileEmptyState message="No basic profile fields loaded." />}
          headers={profileTableHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.label}>
              <td>
                <strong>{row.label}</strong>
              </td>
              <td>
                <ProfileValue value={row.value} />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <div className="partner-detail-note admin-mt-12">
        <strong>Operator note</strong>
        <p className="muted">{marketplaceDisplayText(note)}</p>
      </div>
    </div>
  );
}

export function PartnerDetailAgreementsCard({ agreements }: PartnerDetailAgreementsCardProps) {
  return (
    <div className="card">
      <h2>Agreements</h2>
      {agreements.length ? (
        <div className="participant-list">
          {agreements.map((agreement) => (
            <span className="pill pill-success" key={agreement.id}>
              {agreement.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">No legal agreements accepted yet.</p>
      )}
    </div>
  );
}

export function PartnerDetailRecentPayoutRecordsCard({
  earningCount,
  earnings,
  payoutBatchCount,
}: PartnerDetailRecentPayoutRecordsCardProps) {
  return (
    <div className="card">
      <h2>Recent payout records</h2>
      <InfoLine label="Recent earnings" value={earningCount.toString()} />
      <InfoLine label="Recent payout batches" value={payoutBatchCount.toString()} />
      {earnings.map((earning) => (
        <p className="muted" key={earning.id}>
          {earning.label}
        </p>
      ))}
    </div>
  );
}

export function PartnerDetailLocationActivityCard({
  coordinatesLabel,
  lastLocationLabel,
  snapshots,
}: PartnerDetailLocationActivityCardProps) {
  return (
    <div className="card" id="location">
      <div className="ops-section-header">
        <div>
          <h2>Location and activity</h2>
          <p className="muted">Latest Partner app location evidence and recent recorded snapshots.</p>
        </div>
        <span className="pill pill-info">{snapshots.length} snapshot(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<ProfileEmptyState message="No location evidence loaded." />}
          headers={locationTableHeaders}
          rowCount={3}
        >
          <tr>
            <td>
              <strong>Last location</strong>
            </td>
            <td>
              <ProfileValue value={lastLocationLabel} />
            </td>
          </tr>
          <tr>
            <td>
              <strong>Coordinates</strong>
            </td>
            <td>
              <ProfileValue value={coordinatesLabel} />
            </td>
          </tr>
          <tr>
            <td>
              <strong>Recent snapshots</strong>
            </td>
            <td>
              {snapshots.length ? (
                <div className="participant-list">
                  {snapshots.map((snapshot) => (
                    <span className="pill pill-neutral" key={snapshot.id}>
                      {snapshot.label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="muted">Missing</span>
              )}
            </td>
          </tr>
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const profileTableHeaders = ['Field', 'Value'] as const;
const locationTableHeaders = ['Signal', 'Evidence'] as const;

function ProfileValue({ value }: { readonly value?: string | null }) {
  return <span>{value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}</span>;
}

function ProfileEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No profile evidence found</strong>
      <p className="muted">{message}</p>
    </>
  );
}

function InfoLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
