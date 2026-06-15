import Link from 'next/link';

type FinalPartnerChoiceMatrix = {
  readonly blockingCount: number;
  readonly summary: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly cards: readonly {
    readonly title: string;
    readonly status: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
  readonly impact: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
};

type OperationsPolicyFinalPartnerChoiceSectionProps = {
  readonly matrix: FinalPartnerChoiceMatrix;
};

export function OperationsPolicyFinalPartnerChoiceSection({
  matrix,
}: OperationsPolicyFinalPartnerChoiceSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Final partner choice control matrix</h2>
          <p className="muted">
            Current owner choices for the direct booking window, marketplace participation, Partner push
            reach, and the negative wallet marketplace/payout gate. This is the screen operators should
            check before changing the mobile flow.
          </p>
        </div>
        <span className={`pill ${matrix.blockingCount ? 'pill-warn' : 'pill-success'}`}>
          {matrix.blockingCount} control choice(s)
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {matrix.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {matrix.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.title}>
            <span className={`pill ${card.pillClass}`}>{card.status}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.operatorAction}</small>
          </div>
        ))}
      </div>
      <div className="ops-section-header admin-mt-18">
        <div>
          <h3>Current partner acceptance impact</h3>
          <p className="muted">
            Applies the policy posture to the current Partner snapshot so operators can see who can pass
            marketplace and payout gates, who needs account or identity follow-up, and who only needs
            readiness follow-up.
          </p>
        </div>
        <Link className="text-link" href="/partners">
          Open Partner queue
        </Link>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {matrix.impact.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
