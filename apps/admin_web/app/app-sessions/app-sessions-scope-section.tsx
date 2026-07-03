import Link from 'next/link';
import { X } from 'lucide-react';

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
        <Link className="button button-secondary" href="/app-sessions">
          <X aria-hidden="true" size={16} />
          Clear filters
        </Link>
      }
      bodyClassName="actions admin-mt-12 admin-justify-start"
      className="admin-mb-16"
      description={`${activeFilterLabel}. Showing ${loadedCount} of ${totalCount} heartbeat record(s).`}
      title="Session scope"
    >
      {quickFilters.map((item) => (
        <Link
          className={`pill ${item.href === activeFilterHref ? 'pill-success' : 'pill-info'}`}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </AdminSection>
  );
}
