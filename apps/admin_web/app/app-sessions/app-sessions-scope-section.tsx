import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

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
    <section className="card admin-mb-16">
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/app-sessions">
            Clear filters
          </Link>
        }
        description={`${activeFilterLabel}. Showing ${loadedCount} of ${totalCount} heartbeat record(s).`}
        title="Session scope"
      />
      <div className="actions admin-mt-12" style={{ justifyContent: 'flex-start' }}>
        {quickFilters.map((item) => (
          <Link
            className={`pill ${item.href === activeFilterHref ? 'pill-success' : 'pill-info'}`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
