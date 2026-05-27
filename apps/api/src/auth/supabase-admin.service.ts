import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

type SupabaseUserResponse = {
  id?: string;
  app_metadata?: Record<string, unknown>;
  user?: {
    id?: string;
    app_metadata?: Record<string, unknown>;
  };
};

export type SupabaseRoleSyncResult = {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  configured: boolean;
  supabaseUserId?: string | null;
  roles?: Role[];
  reason?: string;
};

@Injectable()
export class SupabaseAdminService {
  constructor(private readonly config: ConfigService) {}

  async grantProviderRole(supabaseUserId?: string | null): Promise<SupabaseRoleSyncResult> {
    if (!supabaseUserId) {
      return {
        status: 'SKIPPED',
        configured: this.isConfigured(),
        supabaseUserId,
        reason: 'Partner user is not linked to Supabase Auth yet.',
      };
    }

    if (!this.isConfigured()) {
      return {
        status: 'SKIPPED',
        configured: false,
        supabaseUserId,
        reason: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Auth Admin role sync.',
      };
    }

    try {
      const currentUser = await this.fetchAuthUser(supabaseUserId);
      const appMetadata = currentUser.user?.app_metadata ?? currentUser.app_metadata ?? {};
      const roles = normalizeRoles([
        appMetadata.role,
        ...(Array.isArray(appMetadata.roles) ? appMetadata.roles : []),
        Role.PROVIDER,
      ]);

      await this.updateAuthUser(supabaseUserId, {
        ...appMetadata,
        role: Role.PROVIDER,
        roles,
      });

      return {
        status: 'SYNCED',
        configured: true,
        supabaseUserId,
        roles,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        configured: true,
        supabaseUserId,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private isConfigured() {
    return Boolean(this.supabaseUrl() && this.serviceRoleKey());
  }

  private async fetchAuthUser(supabaseUserId: string): Promise<SupabaseUserResponse> {
    const response = await fetch(`${this.authAdminUrl()}/${encodeURIComponent(supabaseUserId)}`, {
      headers: this.adminHeaders(),
    });
    return this.parseSupabaseResponse(response, 'retrieve Supabase Auth user');
  }

  private async updateAuthUser(supabaseUserId: string, appMetadata: Record<string, unknown>) {
    const response = await fetch(`${this.authAdminUrl()}/${encodeURIComponent(supabaseUserId)}`, {
      method: 'PUT',
      headers: {
        ...this.adminHeaders(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ app_metadata: appMetadata }),
    });
    return this.parseSupabaseResponse(response, 'update Supabase Auth app_metadata');
  }

  private async parseSupabaseResponse(response: Response, action: string) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText;
      throw new Error(`Unable to ${action}: ${response.status} ${message}`);
    }
    return body;
  }

  private adminHeaders() {
    const serviceRoleKey = this.serviceRoleKey();
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
    }
    return {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    };
  }

  private authAdminUrl() {
    const url = this.supabaseUrl();
    if (!url) {
      throw new Error('SUPABASE_URL is not configured.');
    }
    return `${url.replace(/\/$/, '')}/auth/v1/admin/users`;
  }

  private supabaseUrl() {
    return this.config.get<string>('SUPABASE_URL')?.trim();
  }

  private serviceRoleKey() {
    return this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  }
}

function normalizeRoles(values: unknown[]): Role[] {
  const roles = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toUpperCase())
    .filter((value): value is Role => Object.values(Role).includes(value as Role));

  return Array.from(new Set(roles));
}
