import { headers } from 'next/headers';

import {
  adminGet,
  adminPost,
  type AdminOperatorAccess,
} from './admin-api';
import { getAdminWebSession } from './admin-session';
import {
  adminOperatorCategoryForPath,
  hasAdminOperatorCategory,
  type AdminOperatorPermissionCategory,
} from './admin-operator-access-model';

export type AdminOperatorPageAccess =
  | {
      allowed: true;
      access: AdminOperatorAccess | null;
      category: AdminOperatorPermissionCategory | null;
    }
  | {
      allowed: false;
      access: AdminOperatorAccess | null;
      category: AdminOperatorPermissionCategory;
    };

export async function getCurrentAdminOperatorAccess() {
  const identity = await currentAdminWebSessionIdentity();
  if (!identity) {
    return null;
  }

  return adminGet<AdminOperatorAccess | null>(
    `/admin/users/admin-operator-access?identity=${encodeURIComponent(identity)}`,
    null,
  );
}

export async function getAdminOperatorPageAccess(pathname: string): Promise<AdminOperatorPageAccess> {
  const category = adminOperatorCategoryForPath(pathname);
  const access = await getCurrentAdminOperatorAccess();

  if (!category) {
    await recordAdminOperatorActivity('admin_web.page_view', pathname, { category: null });
    return { allowed: true, access, category };
  }

  if (hasAdminOperatorCategory(access, category)) {
    await recordAdminOperatorActivity('admin_web.page_view', pathname, { category });
    return { allowed: true, access, category };
  }

  await recordAdminOperatorActivity('admin_web.access_denied', pathname, { category });
  return { allowed: false, access, category };
}

export async function recordAdminOperatorActivity(
  action: string,
  target: string,
  metadata?: Record<string, unknown>,
) {
  const identity = await currentAdminWebSessionIdentity();
  if (!identity) {
    return null;
  }

  return adminPost<{ ok: boolean } | null>(
    '/admin/operator-activity',
    {
      action,
      metadata,
      operatorIdentity: identity,
      target,
    },
    null,
  );
}

async function currentAdminWebSessionIdentity() {
  try {
    const headerList = await headers();
    const session = getAdminWebSession({ headers: headerList });

    return session?.sub ?? null;
  } catch {
    return null;
  }
}
