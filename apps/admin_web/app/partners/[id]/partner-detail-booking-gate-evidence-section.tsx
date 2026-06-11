import Link from 'next/link';

export type PartnerBookingGateAttemptRow = {
  readonly addressLabel: string;
  readonly at: string;
  readonly auditHref: string;
  readonly bookingMonitorHref: string;
  readonly detail: string;
  readonly distanceLabel: string;
  readonly gate: string;
  readonly gateLabel: string;
  readonly id: string;
  readonly reasonLabel: string;
  readonly tone: string;
};

type PartnerDetailBookingGateEvidenceSectionProps = {
  readonly filteredAttempts: readonly PartnerBookingGateAttemptRow[];
  readonly formatDate: (value?: string | null) => string;
  readonly loadedAttempts: readonly PartnerBookingGateAttemptRow[];
};

export function PartnerDetailBookingGateEvidenceSection({
  filteredAttempts,
  formatDate,
  loadedAttempts,
}: PartnerDetailBookingGateEvidenceSectionProps) {
  const latestAttempt = loadedAttempts[0];

  return (
    <div className="card admin-mb-16" id="partner-booking-create-gates">
      <div className="ops-section-header">
        <div>
          <h2>Partner booking create gate evidence</h2>
          <p className="muted">
            Booking creation attempts where this partner was the first-pick partner. These rows show factual
            address, distance, and GPS evidence before payment and matching.
          </p>
        </div>
        <Link className="text-link" href="/bookings?view=blocked-create&gate=first-pick-distance">
          Open gate queue
        </Link>
      </div>
      <div className="service-trace-summary admin-mt-12">
        <div>
          <span>Loaded attempts</span>
          <strong>{loadedAttempts.length}</strong>
          <small>All recent partner-linked gate attempts.</small>
        </div>
        <div>
          <span>Filtered attempts</span>
          <strong>{filteredAttempts.length}</strong>
          <small>Matches current date filter.</small>
        </div>
        <div>
          <span>Latest gate</span>
          <strong>{latestAttempt?.reasonLabel ?? 'None'}</strong>
          <small>{latestAttempt ? formatDate(latestAttempt.at) : 'No gate row'}</small>
        </div>
      </div>
      {filteredAttempts.length === 0 ? (
        <p className="muted admin-mt-12">
          No first-pick booking create gate attempt matched this date filter.
        </p>
      ) : (
        <div className="setup-stage-list admin-mt-14">
          {filteredAttempts.slice(0, 12).map((attempt) => (
            <div className="setup-stage-item" key={attempt.id}>
              <span>{attempt.gateLabel}</span>
              <div>
                <Link className="text-link" href={attempt.bookingMonitorHref}>
                  <strong>{attempt.reasonLabel}</strong>
                </Link>
                <p className="muted">{attempt.detail}</p>
                <div className="participant-list admin-mt-8">
                  <span className={`pill ${attempt.tone}`}>{attempt.gateLabel}</span>
                  <span className="pill pill-neutral">{attempt.addressLabel}</span>
                  <span className="pill pill-neutral">{attempt.distanceLabel}</span>
                </div>
                <div className="participant-list admin-mt-8">
                  <Link className="text-link" href={attempt.bookingMonitorHref}>
                    Booking gate queue
                  </Link>
                  <Link className="text-link" href={attempt.auditHref}>
                    Audit evidence
                  </Link>
                </div>
              </div>
              <small>{formatDate(attempt.at)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
