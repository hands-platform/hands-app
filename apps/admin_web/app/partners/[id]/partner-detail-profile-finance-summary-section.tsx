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

function InfoLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
