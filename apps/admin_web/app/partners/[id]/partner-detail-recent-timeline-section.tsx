import Link from 'next/link';

import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailRecentTimelineRecord = {
  readonly at: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly type: string;
};

type PartnerDetailRecentTimelineSectionProps = {
  readonly formatDate: (value: string) => string;
  readonly records: readonly PartnerDetailRecentTimelineRecord[];
};

export function PartnerDetailRecentTimelineSection({
  formatDate,
  records,
}: PartnerDetailRecentTimelineSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-recent-operations-timeline">
      <div className="ops-section-header">
        <div>
          <h2>Partner recent operations timeline</h2>
          <p className="muted">
            Latest factual partner events in the order operators need them: onboarding, app, location,
            booking, chat, finance, payout, document, tax, and staff records.
          </p>
        </div>
        <Link className="text-link" href="#app-activity">
          Open full timeline
        </Link>
      </div>
      <div className="setup-stage-list admin-mt-12">
        {records.length ? (
          records.slice(0, 8).map((record, index) => (
            <div
              className="setup-stage-item"
              key={`recent-${record.type}-${record.id}-${record.at}-${index}`}
            >
              <span>{record.type}</span>
              <div>
                <Link className="text-link" href={record.href}>
                  <strong>{displayTimelineTitle(record.title)}</strong>
                </Link>
                <p className="muted">{marketplaceDisplayText(record.detail)}</p>
              </div>
              <small>{formatDate(record.at)}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No partner event matched this filter</strong>
              <p className="muted">Clear the date filter or choose a wider period.</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}

function displayTimelineTitle(value: string) {
  const displayText = marketplaceDisplayText(value);
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/.test(displayText)) {
    return displayText;
  }

  return displayText
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
