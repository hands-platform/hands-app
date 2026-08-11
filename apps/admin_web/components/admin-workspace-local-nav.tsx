'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import {
  adminNavSearchEntries,
  adminWorkspaceNavigationGroups,
  type AdminNavSection,
} from '../lib/admin-navigation';
import { bestMatchingNavHref } from '../lib/admin-nav-match';
import { AdminSegmentedControl } from './admin-segmented-control';

export function AdminWorkspaceLocalNav({ sections }: { readonly sections: readonly AdminNavSection[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const allowedHrefs = new Set(adminNavSearchEntries(sections).map((entry) => entry.href));
  const availableGroups = adminWorkspaceNavigationGroups.map((group) => ({
    ...group,
    links: group.links.filter((link) => allowedHrefs.has(link.href)),
  })).filter((group) => group.links.length > 1);
  const activeGroup = availableGroups.find((group) =>
    bestMatchingNavHref(group.links.map((link) => link.href), pathname, search),
  );

  if (!activeGroup) return null;

  const activeHref = bestMatchingNavHref(
    activeGroup.links.map((link) => link.href),
    pathname,
    search,
  ) ?? activeGroup.links[0]?.href ?? '';

  return (
    <nav aria-label={`${activeGroup.label} workspace`} className="admin-workspace-local-nav">
      <strong>{activeGroup.label}</strong>
      <AdminSegmentedControl
        activeValue={activeHref}
        ariaLabel={`${activeGroup.label} pages`}
        className="admin-workspace-local-nav-links"
        options={activeGroup.links.map((link) => ({
          href: link.href,
          label: link.label,
          title: link.description,
          value: link.href,
        }))}
      />
    </nav>
  );
}
