import type { ReactNode } from 'react';
import { PillClassBadge, StatusBadge } from '../../../components/status-badge';

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
    <details className="admin-disclosure booking-detail-section-disclosure">
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
              <PillClassBadge pillClass={item.tone ?? 'pill-neutral'} key={item.label}>
                {item.label}
              </PillClassBadge>
            ))}
          </span>
        )}
      </summary>
      <div className="booking-detail-section-disclosure-body">{children}</div>
    </details>
  );
}
