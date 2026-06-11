import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Live demand, Partner supply, push reachability, and shared-device checks for the current shift."
        status={
          <span className={`pill ${checkCount ? 'pill-warn' : 'pill-success'}`}>
            {checkCount ? `${checkCount} check item(s)` : 'Clear'}
          </span>
        }
        title="Session command board"
      />
      <div className="ops-task-grid admin-mt-12">
        {cards.map((card) => (
          <div className={`ops-task-card ${card.tone}`} key={card.title}>
            <small>{card.status}</small>
            <h3>{card.title}</h3>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
            <span className="ops-task-card-action">{card.action}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
