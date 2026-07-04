import { X } from 'lucide-react';

import { ActionMenu } from '../../components/action-menu';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';

export type AppSessionQuickFilter = {
  readonly href: string;
  readonly label: string;
};

type AppSessionsScopeSectionProps = {
  readonly activeFilterHref: string;
  readonly activeFilterLabel: string;
  readonly loadedCount: number;
  readonly quickFilters: readonly AppSessionQuickFilter[];
  readonly totalCount: number;
};

export function AppSessionsScopeSection({
  activeFilterHref,
  activeFilterLabel,
  loadedCount,
  quickFilters,
  totalCount,
}: AppSessionsScopeSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/app-sessions">
          <X aria-hidden="true" size={16} />
          Clear filters
        </AdminFormControlLink>
      }
      bodyClassName="actions admin-mt-12 admin-justify-start"
      className="admin-mb-16"
      description={`${activeFilterLabel}. Showing ${loadedCount} of ${totalCount} heartbeat record(s).`}
      title="Session scope"
    >
      <ActionMenu
        actions={quickFilters.map((item) => ({
          href: item.href,
          kind: 'link',
          label: item.label,
          tone: item.href === activeFilterHref ? 'success' : 'info',
        }))}
        label="App session quick filters"
      />
    </AdminSection>
  );
}
