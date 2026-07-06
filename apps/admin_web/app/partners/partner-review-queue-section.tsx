import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';

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
        <StatusBadge tone={queue.totalOpen === 0 ? 'success' : 'warning'}>
          {queue.totalOpen} open item(s)
        </StatusBadge>
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
            <AdminTextLink href={item.href}>
              {item.count}
            </AdminTextLink>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
