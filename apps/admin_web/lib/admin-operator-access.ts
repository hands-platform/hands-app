import { headers } from 'next/headers';
import { cache } from 'react';

import {
  adminGetResult,
  adminPost,
  type AdminGetResult,
  type AdminOperatorAccess,
} from './admin-api';
import { resolveEnvMasterAdminAccess } from './admin-env-master-access';
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
      category: AdminOperatorPermissionCategory | null;
    };

export const getCurrentAdminOperatorAccessResult = cache(async function getCurrentAdminOperatorAccessResult(): Promise<AdminGetResult<AdminOperatorAccess | null>> {
  const identity = await currentAdminWebSessionIdentity();
  if (!identity) {
    return { data: null, ok: true, status: null };
  }

  const forwardedAccess = await forwardedAdminOperatorAccess(identity);
  if (forwardedAccess) {
    return {
      data: resolveEnvMasterAdminAccess(identity, forwardedAccess),
      ok: true,
      status: 200,
    };
  }

  const result = await adminGetResult<AdminOperatorAccess | null>(
    `/admin/users/admin-operator-access?identity=${encodeURIComponent(identity)}`,
    null,
  );

  return {
    ...result,
    data: resolveEnvMasterAdminAccess(identity, result.data),
  };
});

export const getCurrentAdminOperatorAccess = cache(async function getCurrentAdminOperatorAccess() {
  return (await getCurrentAdminOperatorAccessResult()).data;
});

export async function getAdminOperatorPageAccess(
  pathname: string,
  loadedAccess?: AdminOperatorAccess | null,
): Promise<AdminOperatorPageAccess> {
  const category = adminOperatorCategoryForPath(pathname);
  const access = loadedAccess === undefined ? await getCurrentAdminOperatorAccess() : loadedAccess;
  const auditTarget = adminOperatorAuditTarget(pathname);

  if (!category) {
    await recordAdminOperatorActivity('admin_web.access_denied', auditTarget, {
      category: null,
      reason: 'unmapped_admin_page',
    });
    return { allowed: false, access, category };
  }

  if (hasAdminOperatorCategory(access, category)) {
    return { allowed: true, access, category };
  }

  await recordAdminOperatorActivity('admin_web.access_denied', auditTarget, { category });
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

async function forwardedAdminOperatorAccess(identity: string): Promise<AdminOperatorAccess | null> {
  try {
    const headerList = await headers();
    const id = headerList.get('x-hands-admin-operator-id');
    if (!id || id !== identity) {
      return null;
    }

    return {
      categories: commaSeparatedHeaderValues(headerList.get('x-hands-admin-operator-categories')),
      id,
      roles: commaSeparatedHeaderValues(headerList.get('x-hands-admin-operator-roles')),
    };
  } catch {
    return null;
  }
}

function commaSeparatedHeaderValues(value: string | null) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function adminOperatorAuditTarget(pathname: string) {
  const pathOnly = pathname.split(/[?#]/, 1)[0]?.trim() || '/';
  return `admin_page:${pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`}`;
}
