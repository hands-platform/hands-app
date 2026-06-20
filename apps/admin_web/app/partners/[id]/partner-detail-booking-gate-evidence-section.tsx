import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

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
  const visibleAttempts = filteredAttempts.slice(0, 12);

  return (
    <div className="card admin-mb-16" id="partner-booking-create-gates">
      <div className="ops-section-header">
        <div>
          <h2>Partner booking create gate evidence</h2>
          <p className="muted">
            Booking creation attempts where this Partner was the first-pick Partner. These rows show factual
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
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={
            <PartnerBookingGateEvidenceEmptyState message="No first-pick booking create gate attempt matched this date filter." />
          }
          headers={bookingGateEvidenceHeaders}
          rowCount={visibleAttempts.length}
        >
          {visibleAttempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>
                <span className={`pill ${attempt.tone}`}>{attempt.gateLabel}</span>
              </td>
              <td>
                <Link className="text-link" href={attempt.bookingMonitorHref}>
                  <strong>{attempt.reasonLabel}</strong>
                </Link>
                <p className="muted">{attempt.detail}</p>
              </td>
              <td>
                <span className="pill pill-neutral">{attempt.addressLabel}</span>
              </td>
              <td>
                <span className="pill pill-neutral">{attempt.distanceLabel}</span>
              </td>
              <td>
                <span className="muted">{formatDate(attempt.at)}</span>
              </td>
              <td>
                <div className="participant-list">
                  <Link className="text-link" href={attempt.bookingMonitorHref}>
                    Booking gate queue
                  </Link>
                  <Link className="text-link" href={attempt.auditHref}>
                    Audit evidence
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const bookingGateEvidenceHeaders = ['Gate', 'Reason', 'Address', 'Distance', 'Attempted', 'Action'] as const;

function PartnerBookingGateEvidenceEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No records found</strong>
      <p className="muted">{message}</p>
    </>
  );
}
