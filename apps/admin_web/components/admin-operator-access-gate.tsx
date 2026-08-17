import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { AdminFormControlLink } from './admin-form-light-controls';
import { AdminErrorState } from './admin-surface';
import type { AdminOperatorAccess } from '../lib/admin-api';
import { getAdminOperatorPageAccess } from '../lib/admin-operator-access';
import { adminOperatorPermissionCategoryDefinitions } from '../lib/admin-operator-permissions';
import { safeCustomerReturnTo } from '../app/customers/customer-filters';

const PUBLIC_PATH_PREFIXES = ['/api/', '/files/', '/login', '/r/'];

type AdminOperatorAccessGateProps = {
  readonly children: ReactNode;
  readonly operatorAccess?: AdminOperatorAccess | null;
  readonly operatorAccessAvailable?: boolean;
};

export async function AdminOperatorAccessGate({ children, operatorAccess, operatorAccessAvailable = true }: AdminOperatorAccessGateProps) {
  const pathname = await currentRequestPathname();
  if (!pathname || isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!operatorAccessAvailable) {
    return (
      <>
        <title>Operator access unavailable | HANDS Admin</title>
        <main className="admin-content admin-operator-access-denied-shell">
          <AdminErrorState
            action={<AdminFormControlLink href={pathname}>Retry</AdminFormControlLink>}
            className="admin-operator-access-denied-card"
            message="Operator permissions could not be verified. Page content remains hidden until the Admin API is available. No access denial was inferred."
            title="Operator access unavailable"
          />
        </main>
      </>
    );
  }

  const access = await getAdminOperatorPageAccess(pathname, operatorAccess);
  if (access.allowed) {
    return <>{children}</>;
  }

  const permissionLabel =
    adminOperatorPermissionCategoryDefinitions.find((definition) => definition.key === access.category)
      ?.label ?? 'this page';
  const customerDetailDenied = access.category === 'CUSTOMERS_DETAIL';
  const description = customerDetailDenied
    ? 'You can search the customer directory, but this account cannot open customer profiles. Ask a Master Admin for Customer detail access.'
    : access.category
      ? `This operator does not have ${permissionLabel} access. Ask a Master Admin to grant the matching category before opening this page.`
      : 'This page is not mapped to an operator category yet. Ask a Master Admin to review the route policy before opening this page.';
  const backHref = customerDetailDenied ? customerReturnTo(pathname) : '/';

  return (
    <>
      <title>Access restricted | HANDS Admin</title>
      <main className="admin-content admin-operator-access-denied-shell">
        <AdminErrorState
          action={
            <AdminFormControlLink href={backHref}>
              {customerDetailDenied ? 'Back to customers' : 'Back to command center'}
            </AdminFormControlLink>
          }
          className="admin-operator-access-denied-card"
          message={`${description} Page content is hidden. The denied page visit was recorded in the operator audit log.`}
          title={customerDetailDenied ? 'Customer detail access required' : 'Access restricted'}
        />
      </main>
    </>
  );
}

function customerReturnTo(pathname: string) {
  try {
    return safeCustomerReturnTo(
      new URL(pathname, 'http://admin.local').searchParams.get('returnTo') ?? undefined,
    );
  } catch {
    return '/customers';
  }
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
