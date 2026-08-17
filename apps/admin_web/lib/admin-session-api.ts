import { createAdminWebApiToken } from './admin-api-token';
import type { AdminWebSession } from './admin-session';

const ADMIN_SESSION_PATH = '/admin/admin-operators/me/session';

export async function verifyAdminWebSessionWithApi(session: AdminWebSession) {
  return (await getAdminWebSessionStateWithApi(session)).valid;
}

export async function getAdminWebSessionStateWithApi(session: AdminWebSession) {
  return requestAdminSessionApi(session, 'GET', ADMIN_SESSION_PATH);
}

export async function revokeAdminWebSessionWithApi(session: AdminWebSession) {
  const result = await requestAdminSessionApi(session, 'POST', `${ADMIN_SESSION_PATH}/revoke`);
  if (result.valid) return 'revoked' as const;
  if (result.status && [401, 403, 404, 409].includes(result.status)) return 'inactive' as const;
  return 'unavailable' as const;
}

async function requestAdminSessionApi(session: AdminWebSession, method: 'GET' | 'POST', path: string) {
  try {
    const token = createAdminWebApiToken(session.sub, new Date(), process.env, session.jti);
    const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: '{}' } : {}),
      cache: 'no-store',
    });
    if (!response.ok) {
      return { valid: false, mfaEnrollmentRequired: false, status: response.status };
    }
    if (method === 'POST') {
      return { valid: true, mfaEnrollmentRequired: false, status: response.status };
    }
    const body = (await response.json().catch(() => null)) as {
      mfaEnrollmentRequired?: unknown;
      ok?: unknown;
      operatorAccess?: {
        categories?: unknown;
        id?: unknown;
        roles?: unknown;
      };
    } | null;
    const operatorAccess = body?.operatorAccess;
    return {
      valid: body?.ok === true,
      mfaEnrollmentRequired: body?.mfaEnrollmentRequired === true,
      operatorAccess:
        typeof operatorAccess?.id === 'string' &&
        Array.isArray(operatorAccess.roles) &&
        operatorAccess.roles.every((role) => typeof role === 'string') &&
        Array.isArray(operatorAccess.categories) &&
        operatorAccess.categories.every((category) => typeof category === 'string')
          ? {
              categories: operatorAccess.categories,
              id: operatorAccess.id,
              roles: operatorAccess.roles,
            }
          : null,
      status: response.status,
    };
  } catch {
    return { valid: false, mfaEnrollmentRequired: false, operatorAccess: null, status: null };
  }
}
