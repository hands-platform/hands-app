import { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  activeRole?: Role;
  roles: Role[];
  authProvider?: 'nest' | 'supabase';
  externalUserId?: string;
};
