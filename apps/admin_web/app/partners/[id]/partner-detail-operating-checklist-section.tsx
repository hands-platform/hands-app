import Link from 'next/link';

type PartnerChecklistTone = 'blocked' | 'done' | 'pending';

export type PartnerOperatingChecklistRow = {
  readonly area: string;
  readonly detail: string;
  readonly href: string;
  readonly nextAction: string;
  readonly status: string;
  readonly tone: PartnerChecklistTone;
};

type PartnerDetailOperatingChecklistSectionProps = {
  readonly pillClassForTone: (tone: PartnerChecklistTone) => string;
  readonly rows: readonly PartnerOperatingChecklistRow[];
};

export function PartnerDetailOperatingChecklistSection({
  pillClassForTone,
  rows,
}: PartnerDetailOperatingChecklistSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-operating-checklist">
      <div className="ops-section-header">
        <div>
          <h2>Partner operating checklist</h2>
          <p className="muted">
            Factual work-control checklist for support and operations. It shows whether bookings, payout,
            tax, location, and service setup need action.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} check(s)</span>
      </div>
      <div className="setup-stage-list admin-mt-16">
        {rows.map((item) => (
          <div className="setup-stage-item" key={item.area}>
            <span>{item.area}</span>
            <div>
              <strong>{item.status}</strong>
              <p className="muted">{item.detail}</p>
              <span className={`pill ${pillClassForTone(item.tone)}`}>{item.nextAction}</span>
            </div>
            <Link className="text-link" href={item.href}>
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
