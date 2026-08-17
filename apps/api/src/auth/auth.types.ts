import { AdminOperatorPermissionCategory, Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  activeRole?: Role;
  roles: Role[];
  authProvider?: 'nest' | 'supabase' | 'admin-realtime' | 'admin-web';
  externalUserId?: string;
  sessionId?: string;
  sessionAuthEpoch?: string;
  sessionFamilyId?: string;
  tokenExpiresAt?: number;
  adminPermissionCategories?: AdminOperatorPermissionCategory[];
  adminPermissionVersion?: number;
  adminMfaEnrollmentRequired?: boolean;
};
