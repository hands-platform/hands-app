import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard, AdminTaskCard } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';

type PartnerOpsTone = 'done' | 'pending' | 'blocked';

type PartnerOpsCommandCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  tone: PartnerOpsTone;
};

type PartnerOpsCommandSummary = {
  ready: boolean;
  cards: PartnerOpsCommandCard[];
};

type PartnerDetailOpsCommandCenterSectionProps = {
  cardClassForTone: (tone: PartnerOpsTone) => string;
  locationFreshnessMinutes: number;
  pillClassForTone: (tone: PartnerOpsTone) => string;
  summary: PartnerOpsCommandSummary;
};

export function PartnerDetailOpsCommandCenterSection({
  cardClassForTone,
  locationFreshnessMinutes,
  pillClassForTone,
  summary,
}: PartnerDetailOpsCommandCenterSectionProps) {
  return (
    <AdminCard className="admin-mb-16">
      <AdminSectionHeader
        actions={(
          <>
            <StatusBadge tone={summary.ready ? 'success' : 'warning'}>
              {summary.ready ? 'Operational' : 'Needs operator attention'}
            </StatusBadge>
            <AdminTextLink href="/operations-policy">
              Location freshness: {locationFreshnessMinutes}m
            </AdminTextLink>
          </>
        )}
        description="One-page operating view for dispatch, payout, reports, and the next admin action."
        title="Partner ops command center"
      />
      <div className="ops-task-grid">
        {summary.cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.action}
            className={cardClassForTone(card.tone)}
            detail={card.detail}
            key={card.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(pillClassForTone(card.tone))}>
                {card.status}
              </StatusBadge>
            }
            title={card.title}
          />
        ))}
      </div>
    </AdminCard>
  );
}
