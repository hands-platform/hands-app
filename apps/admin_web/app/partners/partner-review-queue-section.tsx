import { AdminSection } from '../../components/admin-surface';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';
import { adminCountLabel } from '../../lib/admin-copy';

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
          {adminCountLabel(queue.totalOpen, 'open item')}
        </StatusBadge>
      }
      className="admin-mb-16 partner-review-queue-card"
      description="Grouped partner records for KYC, documents, payout readiness, device alerts, and dispatch location freshness."
      title="Review queue"
    >
      <AdminStageList>
        {queue.items.map((item) => (
          <AdminStageItem key={item.label}>
            <span>{item.count ? 'CHECK' : 'OK'}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <AdminTextLink href={item.href}>
              {item.count}
            </AdminTextLink>
          </AdminStageItem>
        ))}
      </AdminStageList>
    </AdminSection>
  );
}
