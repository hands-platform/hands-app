import { ExternalLink } from 'lucide-react';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import {
  AdminNotePanel,
  AdminSection,
  AdminTaskBreakdown,
  AdminTaskCard,
  AdminTaskGrid,
} from '../../components/admin-surface';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { policyCountLabel } from './policy-copy';

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
      statusLabel={`${policyCountLabel(drilldown.totalCount, 'item')} to review`}
      statusTone="info"
      title="Policy impact drill-down"
    >
      <AdminTaskGrid className="admin-mt-14">
        {drilldown.lists.map((list) => (
          <PolicyDrilldownList key={list.key} list={list} />
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function PolicyDrilldownList({ list }: { readonly list: PolicyDrilldownListView }) {
  return (
    <AdminTaskCard
      className={`admin-min-h-0 ${list.className}`}
      detail={list.helper}
      leading={
        <StatusBadgeFromPillClass pillClass={list.pillClass}>
          {policyCountLabel(list.rows.length, 'item')}
        </StatusBadgeFromPillClass>
      }
      title={list.title}
    >
      {list.rows.length ? (
        <AdminTaskBreakdown>
          {list.rows.map((row) => (
            <AdminNotePanel key={`${list.key}-${row.id}`}>
              <AdminFormControlLink className="button-secondary policy-inline-action" href={row.href}>
                <ExternalLink aria-hidden="true" size={14} />
                {row.title}
              </AdminFormControlLink>
              <p className="muted admin-my-6">{row.subtitle}</p>
            <AdminFilterChipGroup>
              {row.pills.map((pill) => (
                <StatusBadgeFromPillClass
                  key={`${row.id}-${pill.label}`}
                  pillClass={pill.className}
                  >
                  {pill.label}
                </StatusBadgeFromPillClass>
              ))}
            </AdminFilterChipGroup>
              <small>{row.operatorAction}</small>
            </AdminNotePanel>
          ))}
        </AdminTaskBreakdown>
      ) : (
        <AdminNotePanel>
          <AdminEmptyState className="admin-m-0" message={list.emptyText} title={null} />
        </AdminNotePanel>
      )}
    </AdminTaskCard>
  );
}
