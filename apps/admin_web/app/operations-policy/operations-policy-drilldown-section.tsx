import { ExternalLink } from 'lucide-react';
import { PillClassBadge } from '../../components/status-badge';

export type PolicyDrilldownPill = {
  readonly label: string;
  readonly className: string;
};

export type PolicyDrilldownRow = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
  readonly pills: readonly PolicyDrilldownPill[];
  readonly operatorAction: string;
};

export type PolicyDrilldownListView = {
  readonly key: string;
  readonly title: string;
  readonly helper: string;
  readonly className: string;
  readonly pillClass: string;
  readonly emptyText: string;
  readonly rows: readonly PolicyDrilldownRow[];
};

type OperationsPolicyDrilldownSectionProps = {
  readonly drilldown: {
    readonly totalCount: number;
    readonly lists: readonly PolicyDrilldownListView[];
  };
};

export function OperationsPolicyDrilldownSection({ drilldown }: OperationsPolicyDrilldownSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Policy impact drill-down</h2>
          <p className="muted">
            Click into the exact bookings and Partner records operators should review before changing live
            matching, wallet, or response-window policy.
          </p>
        </div>
        <span className="pill pill-info">{drilldown.totalCount} item(s) to review</span>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {drilldown.lists.map((list) => (
          <PolicyDrilldownList key={list.key} list={list} />
        ))}
      </div>
    </section>
  );
}

function PolicyDrilldownList({ list }: { readonly list: PolicyDrilldownListView }) {
  return (
    <div className={`ops-task-card admin-min-h-0 ${list.className}`}>
      <div>
        <PillClassBadge pillClass={list.pillClass}>{list.rows.length} item(s)</PillClassBadge>
        <h3>{list.title}</h3>
        <p>{list.helper}</p>
      </div>
      {list.rows.length ? (
        <div className="ops-task-breakdown">
          {list.rows.map((row) => (
            <div className="ops-task-note" key={`${list.key}-${row.id}`}>
              <a className="button button-secondary policy-inline-action" href={row.href}>
                <ExternalLink aria-hidden="true" size={14} />
                {row.title}
              </a>
              <p className="muted admin-my-6">{row.subtitle}</p>
              <div className="participant-list">
                {row.pills.map((pill) => (
                  <PillClassBadge key={`${row.id}-${pill.label}`} pillClass={pill.className}>
                    {pill.label}
                  </PillClassBadge>
                ))}
              </div>
              <small>{row.operatorAction}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="ops-task-note">
          <p className="muted admin-m-0">{list.emptyText}</p>
        </div>
      )}
    </div>
  );
}
