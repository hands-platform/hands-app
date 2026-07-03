import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminSection } from './admin-surface';
import { getAdminOperatorPageAccess } from '../lib/admin-operator-access';

const PUBLIC_PATH_PREFIXES = ['/api/', '/files/', '/login', '/r/'];

export async function AdminOperatorAccessGate({ children }: { readonly children: ReactNode }) {
  const pathname = await currentRequestPathname();
  if (!pathname || isPublicPath(pathname)) {
    return <>{children}</>;
  }

  const access = await getAdminOperatorPageAccess(pathname);
  if (access.allowed) {
    return <>{children}</>;
  }

  const description = access.category
    ? `This operator does not have ${access.category.toLowerCase()} category access. Ask a Master Admin to grant the matching category before opening this page.`
    : 'This page is not mapped to an operator category yet. Ask a Master Admin to review the route policy before opening this page.';

  return (
    <main className="admin-content admin-operator-access-denied-shell">
      <AdminSection
        bodyClassName="admin-empty-state"
        className="admin-operator-access-denied-card"
        description={description}
        statusLabel={access.category ?? 'UNMAPPED_PAGE'}
        statusTone="danger"
        title="Access restricted"
      >
        <strong>Page content is hidden.</strong>
        <p className="muted">The denied page visit was recorded in the operator audit log.</p>
        <Link className="button button-secondary" href="/">
          Back to command center
        </Link>
      </AdminSection>
    </main>
  );
}

async function currentRequestPathname() {
  try {
    const headerList = await headers();
    return headerList.get('x-admin-pathname');
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}
