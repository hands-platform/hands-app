import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminTextLink } from '../../../components/admin-text-link';
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
        <AdminTextLink href="/bookings?view=blocked-create&gate=first-pick-distance">
          Open gate queue
        </AdminTextLink>
      }
      id="partner-booking-create-gates"
      resultLabel={`${visibleAttempts.length} attempt(s)`}
      title="Partner booking create gate evidence"
    >
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          {
            detail: 'All recent partner-linked gate attempts.',
            label: 'Loaded attempts',
            value: loadedAttempts.length,
          },
          {
            detail: 'Matches current date filter.',
            label: 'Filtered attempts',
            value: filteredAttempts.length,
          },
          {
            detail: <DateTimeText fallback="No gate row" value={latestAttempt?.at} />,
            label: 'Latest gate',
            value: latestAttempt?.reasonLabel ?? 'None',
          },
        ]}
      />
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
                <AdminTextLink href={attempt.bookingMonitorHref}>
                  <strong>{attempt.reasonLabel}</strong>
                </AdminTextLink>
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
                  <AdminTextLink href={attempt.bookingMonitorHref}>
                    Booking gate queue
                  </AdminTextLink>
                  <AdminTextLink href={attempt.auditHref}>
                    Audit evidence
                  </AdminTextLink>
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
