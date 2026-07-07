import type { ReactNode } from 'react';

import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import type { AdminOperatorAccess } from '../lib/admin-api';
import { hasAdminOperatorCategory, type AdminOperatorPermissionCategory } from '../lib/admin-operator-access-model';

const developerSystemCategories: AdminOperatorPermissionCategory[] = [
  'DEVELOPER_SYSTEM',
  'DEVELOPER_SETUP',
  'DEVELOPER_HEALTH',
  'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
  'DEVELOPER_ROUTE_COMPAT',
];

export function canViewAdminDeveloperSystem(access: AdminOperatorAccess | null) {
  return developerSystemCategories.some((category) => hasAdminOperatorCategory(access, category));
}

export async function AdminDeveloperSystemSection({ children }: { readonly children: ReactNode }) {
  const access = await getCurrentAdminOperatorAccess();
  const allowed = canViewAdminDeveloperSystem(access);

  return allowed ? <>{children}</> : null;
}
