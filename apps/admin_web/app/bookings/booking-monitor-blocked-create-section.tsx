import Link from 'next/link';
import type { AdminAuditLog } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { commandToneClass } from './booking-command-display';
import {
  bookingGateCount,
  bookingGateFilterOptions,
  type BookingGateFilter,
  type BookingGateTriageItem,
} from './booking-gate-filters';
import { bookingGateRejectionInfo } from './booking-gate-rejections';
import { formatBookingDate as formatDate } from './booking-list-time';

type BookingMonitorBlockedCreateSectionProps = {
  readonly bookingGateTriage: readonly BookingGateTriageItem[];
  readonly gateFilter: BookingGateFilter;
  readonly onGateFilterChange: (value: BookingGateFilter) => void;
  readonly orderedBookingCreateRejections: readonly AdminAuditLog[];
  readonly visibleBookingCreateRejections: readonly AdminAuditLog[];
};

export function BookingMonitorBlockedCreateSection({
  bookingGateTriage,
  gateFilter,
  onGateFilterChange,
  orderedBookingCreateRejections,
  visibleBookingCreateRejections,
}: BookingMonitorBlockedCreateSectionProps) {
  return (
    <section className="card admin-mt-16">
      <div className="ops-section-header">
        <div>
          <h2>Blocked booking attempts</h2>
          <p className="muted">
            Booking create requests stopped before payment authorization and matching. These records are
            evidence for support follow-up, not customer or Partner priority decisions.
          </p>
        </div>
        <Link className="text-link" href="/audit-log?query=booking.create.rejected">
          Open audit log
        </Link>
      </div>
      <div className="filter-grid admin-mt-14">
        <label>
          Create gate filter
          <select
            value={gateFilter}
            onChange={(event) => onGateFilterChange(event.target.value as BookingGateFilter)}
          >
            {bookingGateFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({bookingGateCount([...orderedBookingCreateRejections], option.value)})
              </option>
            ))}
          </select>
        </label>
        <div className="actions" style={{ alignSelf: 'end' }}>
          <button type="button" onClick={() => onGateFilterChange('all')}>
            Clear create gate
          </button>
        </div>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {bookingGateTriage.map((item) => (
          <article className="ops-task-card" key={item.filter}>
            <span className={`signal ${commandToneClass(item.tone)}`}>{item.status}</span>
            <h3>{item.label}</h3>
            <p>{item.operatorHint}</p>
            <div className="participant-list">
              <span className="pill">{item.count} attempt(s)</span>
              <span className="pill">Latest {item.latestAge}</span>
            </div>
            <div className="actions admin-mt-12">
              <button type="button" onClick={() => onGateFilterChange(item.filter)}>
                Show this gate
              </button>
              <Link className="text-link" href={item.auditHref}>
                Audit evidence
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="muted admin-mt-12">
        {bookingGateFilterOptions.find((option) => option.value === gateFilter)?.operatorHint}
      </p>
      {visibleBookingCreateRejections.length === 0 ? (
        <div className="empty-state admin-mt-14">
          No blocked booking create attempts match this create gate filter.
        </div>
      ) : (
        <div className="ops-task-grid admin-mt-14">
          {visibleBookingCreateRejections.slice(0, 30).map((log) => {
            const evidence = bookingGateRejectionInfo(log);
            return (
              <article className="ops-task-card" key={log.id}>
                <span className={`signal ${commandToneClass(evidence.tone)}`}>
                  {evidence.reasonLabel}
                </span>
                <h3>{shortId(log.id)}</h3>
                <p>{evidence.operatorAction}</p>
                <div className="participant-list">
                  <span className="pill">Created {formatDate(log.createdAt)}</span>
                  <span className="pill">{evidence.customerDistanceLabel}</span>
                  <span className="pill">{evidence.preferredPartnerDistanceLabel}</span>
                </div>
                <div className="stack admin-mt-10">
                  <span className="muted">Address: {evidence.addressText}</span>
                  <span className="muted">Optional customer GPS: {evidence.currentLocationLabel}</span>
                  <span className="muted">Booking pin: {evidence.bookingAddressLabel}</span>
                </div>
                <div className="actions admin-mt-12">
                  {evidence.customerHref && (
                    <Link className="text-link" href={evidence.customerHref}>
                      Customer detail
                    </Link>
                  )}
                  <Link className="text-link" href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                    Audit evidence
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
