import { Filter, ScrollText, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { AdminSignal, StatusBadge } from '../../components/status-badge';
import type { AdminAuditLog } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { commandSignalTone } from './booking-command-display';
import {
  bookingGateCount,
  bookingGateFilterOptions,
  type BookingGateFilter,
  type BookingGateTriageItem,
} from './booking-gate-filters';
import { bookingGateRejectionInfo } from './booking-gate-rejections';

export type BookingMonitorBlockedCreateSectionProps = {
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
  const gateFilterOptions = bookingGateFilterOptions.map((option) => ({
    label: `${option.label} (${bookingGateCount([...orderedBookingCreateRejections], option.value)})`,
    value: option.value,
  }));

  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/audit-log?query=booking.create.rejected">
          <ScrollText aria-hidden="true" size={16} />
          Open audit log
        </AdminFormControlLink>
      }
      className="admin-mt-16 booking-monitor-blocked-create-card"
      description="Booking create requests stopped before payment authorization and matching. These records are evidence for support follow-up, not customer or Partner priority decisions."
      title="Blocked booking attempts"
    >
      <div className="filter-grid admin-mt-14">
        <AdminFormSelect
          label="Create gate filter"
          name="gateFilter"
          onChange={(event) => onGateFilterChange(event.target.value as BookingGateFilter)}
          options={gateFilterOptions}
          value={gateFilter}
        />
        <div className="actions admin-align-end">
          <AdminFormControlButton
            className="button-secondary"
            onClick={() => onGateFilterChange('all')}
            type="button"
          >
            <X aria-hidden="true" size={16} />
            Clear create gate
          </AdminFormControlButton>
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
                <AdminSignal tone={commandSignalTone(item.tone)}>{item.status}</AdminSignal>
              </td>
              <td>
                <StatusBadge tone="neutral">{item.count} attempt(s)</StatusBadge>
              </td>
              <td>
                <span className="muted">{item.latestAge}</span>
              </td>
              <td>
                <span className="muted">{item.operatorHint}</span>
              </td>
              <td>
                <div className="actions">
                  <AdminFormControlButton
                    className="button-primary"
                    type="button"
                    onClick={() => onGateFilterChange(item.filter)}
                  >
                    <Filter aria-hidden="true" size={16} />
                    Show this gate
                  </AdminFormControlButton>
                  <AdminFormControlLink className="button-secondary" href={item.auditHref}>
                    <ScrollText aria-hidden="true" size={16} />
                    Audit evidence
                  </AdminFormControlLink>
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
                      <AdminTextLink href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                        {shortId(log.id)}
                      </AdminTextLink>
                      <div className="muted">
                        Created <DateTimeText value={log.createdAt} />
                      </div>
                    </td>
                    <td>
                      <AdminSignal tone={commandSignalTone(evidence.tone)}>
                        {evidence.reasonLabel}
                      </AdminSignal>
                      <div className="muted">{evidence.operatorAction}</div>
                    </td>
                    <td>
                      {evidence.customerHref ? (
                        <AdminTextLink href={evidence.customerHref}>
                          Customer detail
                        </AdminTextLink>
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
                        <StatusBadge tone="neutral">{evidence.customerDistanceLabel}</StatusBadge>
                        <StatusBadge tone="neutral">
                          {evidence.preferredPartnerDistanceLabel}
                        </StatusBadge>
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
                        <AdminTextLink href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                          Audit evidence
                        </AdminTextLink>
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
    </AdminSection>
  );
}
