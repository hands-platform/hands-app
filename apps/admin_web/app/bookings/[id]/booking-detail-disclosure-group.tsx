import type { ReactNode } from 'react';

export type BookingDetailDisclosureGroupProps = {
  children: ReactNode;
  helper: string;
  label: string;
  title: string;
};

export function BookingDetailDisclosureGroup({
  children,
  helper,
  label,
  title,
}: BookingDetailDisclosureGroupProps) {
  return (
    <details className="booking-detail-section-disclosure">
      <summary
        aria-label={`${label}: ${title}. ${helper}`}
        className="booking-detail-section-summary"
      >
        <span className="pill pill-info">{label}</span>
        {' '}
        <span className="booking-detail-section-summary-copy">
          <strong>{title}</strong>
          {' '}
          <small>{helper}</small>
        </span>
      </summary>
      <div className="booking-detail-section-disclosure-body">{children}</div>
    </details>
  );
}
