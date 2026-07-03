import Link from 'next/link';

import { AdminCard } from '../../../components/admin-surface';

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
      <div className="ops-section-header">
        <div>
          <h2>Partner ops command center</h2>
          <p className="muted">
            One-page operating view for dispatch, payout, reports, and the next admin action.
          </p>
        </div>
        <span className={`pill ${summary.ready ? 'pill-success' : 'pill-warn'}`}>
          {summary.ready ? 'Operational' : 'Needs operator attention'}
        </span>
        <Link className="text-link" href="/operations-policy">
          Location freshness: {locationFreshnessMinutes}m
        </Link>
      </div>
      <div className="ops-task-grid">
        {summary.cards.map((card) => (
          <div className={`ops-task-card ${cardClassForTone(card.tone)}`} key={card.title}>
            <div>
              <span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p className="muted">{card.detail}</p>
            </div>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
