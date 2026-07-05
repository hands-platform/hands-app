import { ExternalLink } from 'lucide-react';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminNotePanel, AdminSection, AdminTaskCard } from '../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

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
    <AdminSection
      className="admin-mb-16"
      description="Click into the exact bookings and Partner records operators should review before changing live matching, wallet, or response-window policy."
      statusLabel={`${drilldown.totalCount} item(s) to review`}
      statusTone="info"
      title="Policy impact drill-down"
    >
      <div className="ops-task-grid admin-mt-14">
        {drilldown.lists.map((list) => (
          <PolicyDrilldownList key={list.key} list={list} />
        ))}
      </div>
    </AdminSection>
  );
}

function PolicyDrilldownList({ list }: { readonly list: PolicyDrilldownListView }) {
  return (
    <AdminTaskCard
      className={`admin-min-h-0 ${list.className}`}
      detail={list.helper}
      leading={
        <StatusBadge tone={statusBadgeToneFromPillClass(list.pillClass)}>
          {list.rows.length} item(s)
        </StatusBadge>
      }
      title={list.title}
    >
      {list.rows.length ? (
        <div className="ops-task-breakdown">
          {list.rows.map((row) => (
            <AdminNotePanel key={`${list.key}-${row.id}`}>
              <AdminFormControlLink className="button-secondary policy-inline-action" href={row.href}>
                <ExternalLink aria-hidden="true" size={14} />
                {row.title}
              </AdminFormControlLink>
              <p className="muted admin-my-6">{row.subtitle}</p>
              <div className="participant-list">
                {row.pills.map((pill) => (
                  <StatusBadge
                    key={`${row.id}-${pill.label}`}
                    tone={statusBadgeToneFromPillClass(pill.className)}
                  >
                    {pill.label}
                  </StatusBadge>
                ))}
              </div>
              <small>{row.operatorAction}</small>
            </AdminNotePanel>
          ))}
        </div>
      ) : (
        <AdminNotePanel>
          <p className="muted admin-m-0">{list.emptyText}</p>
        </AdminNotePanel>
      )}
    </AdminTaskCard>
  );
}
