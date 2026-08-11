import type { AdminOperatorAccess } from './admin-api';

export function resolveEnvMasterAdminAccess(
  identity: string,
  access: AdminOperatorAccess | null,
): AdminOperatorAccess | null {
  const configuredEmail = process.env.ADMIN_WEB_LOGIN_EMAIL?.trim().toLowerCase();
  const normalizedIdentity = identity.trim().toLowerCase();
  const normalizedAccessEmail = access?.email?.trim().toLowerCase();

  if (
    !configuredEmail ||
    (normalizedIdentity !== configuredEmail && normalizedAccessEmail !== configuredEmail)
  ) {
    return access;
  }

  return {
    categories: access?.categories ?? [],
    email: access?.email ?? configuredEmail,
    fullName: access?.fullName ?? 'Master Admin',
    id: access?.id ?? 'admin-web-env-master',
    phone: access?.phone ?? null,
    roles: [...new Set(['ADMIN', ...(access?.roles ?? []), 'MASTER_ADMIN'])],
    updatedAt: access?.updatedAt ?? null,
  };
}
