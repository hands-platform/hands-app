import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingGateAttemptRow = {
  readonly addressLabel: string;
  readonly at: string;
  readonly auditHref: string;
  readonly bookingMonitorHref: string;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly distanceLabel: string;
  readonly gate: string;
  readonly gateLabel: string;
  readonly id: string;
  readonly reasonLabel: string;
  readonly tone: string;
};

type PartnerDetailBookingGateEvidenceSectionProps = {
  readonly filteredAttempts: readonly PartnerBookingGateAttemptRow[];
  readonly loadedAttempts: readonly PartnerBookingGateAttemptRow[];
};

export function PartnerDetailBookingGateEvidenceSection({
  filteredAttempts,
  loadedAttempts,
}: PartnerDetailBookingGateEvidenceSectionProps) {
  const latestAttempt = loadedAttempts[0];
  const visibleAttempts = filteredAttempts.slice(0, 12);

  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Booking creation attempts where this Partner was the first-pick Partner. These rows show factual address, distance, and GPS evidence before payment and matching."
      footer={
        <Link className="text-link" href="/bookings?view=blocked-create&gate=first-pick-distance">
          Open gate queue
        </Link>
      }
      id="partner-booking-create-gates"
      resultLabel={`${visibleAttempts.length} attempt(s)`}
      title="Partner booking create gate evidence"
    >
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
          <small>
            <DateTimeText fallback="No gate row" value={latestAttempt?.at} />
          </small>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <AdminEmptyState message="No first-pick booking create gate attempt matched this date filter." />
          }
          headers={bookingGateEvidenceHeaders}
          rowCount={visibleAttempts.length}
        >
          {visibleAttempts.map((attempt) => (
            <tr key={attempt.id}>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(attempt.tone)}>
                  {attempt.gateLabel}
                </StatusBadge>
              </td>
              <td>
                <Link className="text-link" href={attempt.bookingMonitorHref}>
                  <strong>{attempt.reasonLabel}</strong>
                </Link>
                <p className="muted">{attempt.detailNode ?? attempt.detail}</p>
              </td>
              <td>
                <StatusBadge tone="neutral">{attempt.addressLabel}</StatusBadge>
              </td>
              <td>
                <StatusBadge tone="neutral">{attempt.distanceLabel}</StatusBadge>
              </td>
              <td>
                <span className="muted">
                  <DateTimeText fallback="Missing" value={attempt.at} />
                </span>
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
      <PartnerDetailVuexyTableFooter rowCount={visibleAttempts.length} />
    </AdminFilterPanel>
  );
}

const bookingGateEvidenceHeaders = ['Gate', 'Reason', 'Address', 'Distance', 'Attempted', 'Action'] as const;
