import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { formatDateTime, shortDisplayId } from '../../lib/admin-format';

type BookingCreateGateReview = {
  readonly currentPolicyLabel: string;
  readonly summary: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly rows: readonly {
    readonly key: string;
    readonly gate: string;
    readonly current: string;
    readonly defaultValue: string;
    readonly operatorMeaning: string;
    readonly evidence: string;
    readonly href: string;
    readonly pillClass: string;
  }[];
  readonly recentAttempts: readonly {
    readonly id: string;
    readonly reason: string;
    readonly detail: string;
    readonly createdAt: string;
    readonly href: string;
    readonly pillClass: string;
  }[];
};

type OperationsPolicyBookingCreateGateSectionProps = {
  readonly review: BookingCreateGateReview;
};

const BOOKING_CREATE_GATE_HEADERS = [
  'Gate',
  'Current',
  'Default',
  'Operator meaning',
  'Evidence',
] as const;

export function OperationsPolicyBookingCreateGateSection({
  review,
}: OperationsPolicyBookingCreateGateSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking create gate controls</h2>
          <p className="muted">
            These policies stop unsafe bookings before payment authorization and matching. Customers can
            browse globally, but immediate booking must pass the selected address, Vietnam service area, and
            first-pick Partner distance checks. Customer GPS is optional evidence only.
          </p>
        </div>
        <span className="pill pill-info">{review.currentPolicyLabel}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {review.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="service-trace"
          emptyMessage={null}
          headers={BOOKING_CREATE_GATE_HEADERS}
          rowCount={review.rows.length}
        >
          {review.rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className={`pill ${row.pillClass}`}>{row.gate}</span>
              </td>
              <td>{row.current}</td>
              <td>{row.defaultValue}</td>
              <td>{row.operatorMeaning}</td>
              <td>
                <Link className="button button-secondary policy-inline-action" href={row.href}>
                  <ExternalLink size={14} aria-hidden="true" />
                  {row.evidence}
                </Link>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <div className="ops-section-header admin-mt-18">
        <div>
          <h3>Recent blocked create attempts</h3>
          <p className="muted">Shows factual support evidence for failed booking creation and troubleshooting.</p>
        </div>
        <Link className="button button-secondary" href="/bookings?view=blocked-create">
          <ExternalLink size={16} aria-hidden="true" />
          Open blocked-create queue
        </Link>
      </div>
      {review.recentAttempts.length === 0 ? (
        <div className="empty-state admin-mt-12">
          No booking create gate rejections are currently recorded.
        </div>
      ) : (
        <div className="ops-task-grid admin-mt-14">
          {review.recentAttempts.map((attempt) => (
            <article className="ops-task-card" key={attempt.id}>
              <span className={`pill ${attempt.pillClass}`}>{attempt.reason}</span>
              <h3>Blocked booking create attempt</h3>
              <p>{attempt.detail}</p>
              <small>
                Attempt {shortDisplayId(attempt.id)} - Recorded {formatDateTime(attempt.createdAt)}
              </small>
              <div className="actions admin-mt-10">
                <Link className="button button-secondary" href={attempt.href}>
                  <ExternalLink size={16} aria-hidden="true" />
                  Open evidence
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
