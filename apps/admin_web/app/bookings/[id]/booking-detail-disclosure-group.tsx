import type { ReactNode } from 'react';
import { AdminDisclosure } from '../../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';

export type BookingDetailDisclosureSummaryItem = {
  readonly label: string;
  readonly tone?: string;
};

export type BookingDetailDisclosureGroupProps = {
  children: ReactNode;
  helper: string;
  label: string;
  summaryItems?: readonly BookingDetailDisclosureSummaryItem[];
  title: string;
};

export function BookingDetailDisclosureGroup({
  children,
  helper,
  label,
  summaryItems = [],
  title,
}: BookingDetailDisclosureGroupProps) {
  const summaryLabel = summaryItems.length
    ? ` ${summaryItems.length} groups: ${summaryItems.map((item) => item.label).join(', ')}.`
    : '';

  return (
    <AdminDisclosure className="booking-detail-section-disclosure">
      <summary
        aria-label={`${label}: ${title}. ${helper}${summaryLabel}`}
        className="booking-detail-section-summary"
      >
        <StatusBadge tone="info">{label}</StatusBadge>
        {' '}
        <span className="booking-detail-section-summary-copy">
          <strong>{title}</strong>
          {' '}
          <small>{helper}</small>
        </span>
        {summaryItems.length > 0 && (
          <span className="booking-detail-section-summary-meta">
            <StatusBadge tone="neutral">{summaryItems.length} groups</StatusBadge>
            {summaryItems.map((item) => (
              <StatusBadgeFromPillClass key={item.label} pillClass={item.tone ?? 'pill-neutral'}>
                {item.label}
              </StatusBadgeFromPillClass>
            ))}
          </span>
        )}
      </summary>
      <div className="booking-detail-section-disclosure-body">{children}</div>
    </AdminDisclosure>
  );
}
