import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { AdminFormControlLink } from './admin-form-controls';
import { AdminErrorState } from './admin-surface';
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
  const categoryLabel = access.category ?? 'UNMAPPED_PAGE';

  return (
    <main className="admin-content admin-operator-access-denied-shell">
      <AdminErrorState
        action={
          <AdminFormControlLink href="/">
            Back to command center
          </AdminFormControlLink>
        }
        className="admin-operator-access-denied-card"
        message={`${categoryLabel}: ${description} Page content is hidden. The denied page visit was recorded in the operator audit log.`}
        title="Access restricted"
      />
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
