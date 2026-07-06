import { ExternalLink } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminTaskGrid } from '../../components/admin-surface';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { shortDisplayId } from '../../lib/admin-format';

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
    <AdminTableSection
      className="admin-mb-16"
      description="These policies stop unsafe bookings before payment authorization and matching. Customers can browse globally, but immediate booking must pass the selected address, Vietnam service area, and first-pick Partner distance checks. Customer GPS is optional evidence only."
      statusLabel={review.currentPolicyLabel}
      statusTone="info"
      title="Booking create gate controls"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={review.summary.map((item) => ({
          detail: item.helper,
          label: item.label,
          value: item.value,
        }))}
      />
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
                <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.gate}</StatusBadgeFromPillClass>
              </td>
              <td>{row.current}</td>
              <td>{row.defaultValue}</td>
              <td>{row.operatorMeaning}</td>
              <td>
                <AdminFormControlLink className="button-secondary policy-inline-action" href={row.href}>
                  <ExternalLink size={14} aria-hidden="true" />
                  {row.evidence}
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminSectionHeader
        actions={(
          <AdminFormControlLink className="button-secondary" href="/bookings?view=blocked-create">
            <ExternalLink size={16} aria-hidden="true" />
            Open blocked-create queue
          </AdminFormControlLink>
        )}
        className="admin-mt-18"
        description="Shows factual support evidence for failed booking creation and troubleshooting."
        title="Recent blocked create attempts"
      />
      {review.recentAttempts.length === 0 ? (
        <AdminEmptyState
          className="admin-mt-12"
          framed
          message="No booking create gate rejections are currently recorded."
          title={null}
        />
      ) : (
        <AdminTaskGrid className="admin-mt-14">
          {review.recentAttempts.map((attempt) => (
            <section className="operations-policy-blocked-attempt-section" key={attempt.id}>
              <StatusBadgeFromPillClass pillClass={attempt.pillClass}>
                {attempt.reason}
              </StatusBadgeFromPillClass>
              <h3>Blocked booking create attempt</h3>
              <p>{attempt.detail}</p>
              <small>
                Attempt {shortDisplayId(attempt.id)} - Recorded <DateTimeText value={attempt.createdAt} />
              </small>
              <div className="actions admin-mt-10">
                <AdminFormControlLink className="button-secondary" href={attempt.href}>
                  <ExternalLink size={16} aria-hidden="true" />
                  Open evidence
                </AdminFormControlLink>
              </div>
            </section>
          ))}
        </AdminTaskGrid>
      )}
    </AdminTableSection>
  );
}
