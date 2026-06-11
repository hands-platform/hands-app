export type PartnerDetailCommandSnapshotItem = {
  readonly helper: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

type PartnerDetailCommandSnapshotSectionProps = {
  readonly items: readonly PartnerDetailCommandSnapshotItem[];
};

export function PartnerDetailCommandSnapshotSection({
  items,
}: PartnerDetailCommandSnapshotSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-activity-command-snapshot">
      <div className="ops-section-header">
        <div>
          <h2>Partner command snapshot</h2>
          <p className="muted">
            Filter-aware facts for this partner: completed work, retained chat, marketplace participation,
            finance rows, latest location, app access, and staff records.
          </p>
        </div>
        <span className="pill pill-info">{items.length} fact groups</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {items.map((item) => (
          <a href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </a>
        ))}
      </div>
    </div>
  );
}
