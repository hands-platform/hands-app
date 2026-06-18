import Link from 'next/link';
import { Filter, ScrollText, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
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

const BLOCKED_CREATE_TABLE_HEADERS = [
  'Attempt',
  'Create Gate',
  'Customer',
  'Service Address',
  'Distance Evidence',
  'Location Evidence',
  'Actions',
] as const;

const BOOKING_GATE_TRIAGE_TABLE_HEADERS = [
  'Create Gate',
  'Status',
  'Attempts',
  'Latest',
  'Operator Hint',
  'Actions',
] as const;

export function BookingMonitorBlockedCreateSection({
  bookingGateTriage,
  gateFilter,
  onGateFilterChange,
  orderedBookingCreateRejections,
  visibleBookingCreateRejections,
}: BookingMonitorBlockedCreateSectionProps) {
  const visibleEvidenceRows = visibleBookingCreateRejections.slice(0, 30);

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
        <Link className="button button-secondary" href="/audit-log?query=booking.create.rejected">
          <ScrollText aria-hidden="true" size={16} />
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
        <div className="actions admin-align-end">
          <button className="button button-secondary" type="button" onClick={() => onGateFilterChange('all')}>
            <X aria-hidden="true" size={16} />
            Clear create gate
          </button>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table admin-mt-14"
          emptyMessage="No booking create gates are configured for this view."
          headers={BOOKING_GATE_TRIAGE_TABLE_HEADERS}
          rowCount={bookingGateTriage.length}
        >
          {bookingGateTriage.map((item) => (
            <tr key={item.filter}>
              <td>
                <strong>{item.label}</strong>
              </td>
              <td>
                <span className={`signal ${commandToneClass(item.tone)}`}>{item.status}</span>
              </td>
              <td>
                <span className="pill">{item.count} attempt(s)</span>
              </td>
              <td>
                <span className="muted">{item.latestAge}</span>
              </td>
              <td>
                <span className="muted">{item.operatorHint}</span>
              </td>
              <td>
                <div className="actions">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => onGateFilterChange(item.filter)}
                  >
                    <Filter aria-hidden="true" size={16} />
                    Show this gate
                  </button>
                  <Link className="button button-secondary" href={item.auditHref}>
                    <ScrollText aria-hidden="true" size={16} />
                    Audit evidence
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <p className="muted admin-mt-12">
        {bookingGateFilterOptions.find((option) => option.value === gateFilter)?.operatorHint}
      </p>
      {visibleBookingCreateRejections.length === 0 ? (
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table admin-mt-14"
            emptyMessage="No blocked booking create attempts match this create gate filter."
            headers={BLOCKED_CREATE_TABLE_HEADERS}
            rowCount={0}
          >
            {null}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <>
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table admin-mt-14"
              emptyMessage="No blocked booking create attempts match this create gate filter."
              headers={BLOCKED_CREATE_TABLE_HEADERS}
              rowCount={visibleEvidenceRows.length}
            >
              {visibleEvidenceRows.map((log) => {
                const evidence = bookingGateRejectionInfo(log);
                return (
                  <tr key={log.id}>
                    <td>
                      <Link className="text-link" href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                        {shortId(log.id)}
                      </Link>
                      <div className="muted">Created {formatDate(log.createdAt)}</div>
                    </td>
                    <td>
                      <span className={`signal ${commandToneClass(evidence.tone)}`}>
                        {evidence.reasonLabel}
                      </span>
                      <div className="muted">{evidence.operatorAction}</div>
                    </td>
                    <td>
                      {evidence.customerHref ? (
                        <Link className="text-link" href={evidence.customerHref}>
                          Customer detail
                        </Link>
                      ) : (
                        <span className="muted">Customer not linked</span>
                      )}
                    </td>
                    <td>
                      <strong>{evidence.addressText}</strong>
                      <div className="muted">Booking address selected by customer</div>
                    </td>
                    <td>
                      <div className="stack">
                        <span className="pill">{evidence.customerDistanceLabel}</span>
                        <span className="pill">{evidence.preferredPartnerDistanceLabel}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack">
                        <span className="muted">Optional customer GPS: {evidence.currentLocationLabel}</span>
                        <span className="muted">Booking pin: {evidence.bookingAddressLabel}</span>
                      </div>
                    </td>
                    <td>
                      <div className="actions">
                        <Link className="text-link" href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                          Audit evidence
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </AdminDataTable>
          </AdminTableScroll>
          {visibleBookingCreateRejections.length > visibleEvidenceRows.length && (
            <p className="muted admin-mt-10">
              Showing the latest {visibleEvidenceRows.length} of {visibleBookingCreateRejections.length}
              blocked create attempts. Use the audit log for older evidence.
            </p>
          )}
        </>
      )}
    </section>
  );
}
