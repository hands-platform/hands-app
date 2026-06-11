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
      <h2>Basic profile</h2>
      {rows.map((row) => (
        <InfoLine key={row.label} label={row.label} value={row.value} />
      ))}
      <p className="muted">{note}</p>
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
      <h2>Location and activity</h2>
      <InfoLine label="Last location" value={lastLocationLabel} />
      <InfoLine label="Coordinates" value={coordinatesLabel} />
      <div className="participant-list">
        {snapshots.map((snapshot) => (
          <span className="pill pill-neutral" key={snapshot.id}>
            {snapshot.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
