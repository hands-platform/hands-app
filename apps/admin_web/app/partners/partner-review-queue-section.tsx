import Link from 'next/link';

import { AdminSection } from '../../components/admin-surface';

type PartnerReviewQueueSectionItem = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
};

export type PartnerReviewQueueSectionQueue = {
  readonly items: readonly PartnerReviewQueueSectionItem[];
  readonly totalOpen: number;
};

type PartnerReviewQueueSectionProps = {
  readonly queue: PartnerReviewQueueSectionQueue;
};

export function PartnerReviewQueueSection({ queue }: PartnerReviewQueueSectionProps) {
  return (
    <AdminSection
      actions={
        <span className={`pill ${queue.totalOpen === 0 ? 'pill-success' : 'pill-warn'}`}>
          {queue.totalOpen} open item(s)
        </span>
      }
      className="admin-mb-16 partner-review-queue-card"
      description="Grouped partner records for KYC, documents, payout readiness, device alerts, and dispatch location freshness."
      title="Review queue"
    >
      <div className="setup-stage-list">
        {queue.items.map((item) => (
          <div className="setup-stage-item" key={item.label}>
            <span>{item.count ? 'CHECK' : 'OK'}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <Link className="text-link" href={item.href}>
              {item.count}
            </Link>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
