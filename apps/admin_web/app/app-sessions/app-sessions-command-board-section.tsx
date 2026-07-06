import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

export type SessionCommandCard = {
  readonly action: string;
  readonly detail: string;
  readonly status: string;
  readonly title: string;
  readonly tone: 'ops-task-done' | 'ops-task-pending' | 'ops-task-blocked';
  readonly value: string;
};

type AppSessionsCommandBoardSectionProps = {
  readonly cards: readonly SessionCommandCard[];
  readonly checkCount: number;
};

export function AppSessionsCommandBoardSection({
  cards,
  checkCount,
}: AppSessionsCommandBoardSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Live demand, Partner supply, push reachability, and shared-device checks for the current shift."
      status={
        <StatusBadge tone={checkCount ? 'warning' : 'success'}>
          {checkCount ? `${checkCount} check item(s)` : 'Clear'}
        </StatusBadge>
      }
      title="Session command board"
    >
      <AdminTaskGrid className="admin-mt-12">
        {cards.map((card) => (
          <AdminTaskCard
            actionLabel={card.action}
            className={card.tone}
            key={card.title}
            leading={<small>{card.status}</small>}
            title={card.title}
          >
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </AdminTaskCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
