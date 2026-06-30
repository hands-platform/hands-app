import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
import { adminRealtimeTokenSecretFromConfig, jwtAccessSecretFromConfig } from './jwt-secrets';

type NestJwtPayload = {
  activeRole?: Role;
  role?: Role;
  sub?: string;
  roles?: Role[];
};

type SupabaseJwtPayload = {
  sub?: string;
  aud?: string | string[];
  phone?: string;
  email?: string;
  app_metadata?: {
    role?: string;
    roles?: string[];
  };
  user_metadata?: Record<string, unknown>;
};

type AdminRealtimeJwtPayload = {
  sub?: string;
  typ?: string;
  aud?: string | string[];
  scope?: string;
  role?: Role;
  jti?: string;
  exp?: number;
};

const ADMIN_REALTIME_TOKEN_TYPE = 'admin-realtime';
const ADMIN_REALTIME_TOKEN_AUDIENCE = 'hands-socket';
const ADMIN_REALTIME_TOKEN_SCOPE = 'admin:realtime';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticateBearerToken(token: string): Promise<AuthenticatedUser> {
    const nestUser = this.tryVerifyNestJwt(token);
    if (nestUser) {
      return nestUser;
    }

    const supabaseUser = await this.tryVerifySupabaseJwt(token);
    if (supabaseUser) {
      return supabaseUser;
    }

    throw new UnauthorizedException('Invalid bearer token');
  }

  async authenticateSupabaseBearerToken(
    token: string,
    requestedRoles: Role[] = [],
  ): Promise<AuthenticatedUser> {
    const supabaseUser = await this.tryVerifySupabaseJwt(token, requestedRoles);
    if (!supabaseUser) {
      throw new UnauthorizedException('Invalid Supabase bearer token');
    }
    return supabaseUser;
  }

  async authenticateSocketToken(token: string): Promise<AuthenticatedUser> {
    const adminRealtimeUser = this.tryVerifyAdminRealtimeJwt(token);
    if (adminRealtimeUser) {
      return adminRealtimeUser;
    }

    return this.authenticateBearerToken(token);
  }

  private tryVerifyNestJwt(token: string): AuthenticatedUser | null {
    try {
      const payload = this.jwt.verify<NestJwtPayload>(token, {
        secret: jwtAccessSecretFromConfig(this.config),
      });

      if (!payload.sub) {
        return null;
      }

      return {
        id: payload.sub,
        activeRole: payload.activeRole ?? payload.role,
        roles: payload.roles ?? [],
        authProvider: 'nest',
      };
    } catch {
      return null;
    }
  }

  private tryVerifyAdminRealtimeJwt(token: string): AuthenticatedUser | null {
    let payload: AdminRealtimeJwtPayload;
    try {
      payload = this.jwt.verify<AdminRealtimeJwtPayload>(token, {
        secret: adminRealtimeTokenSecretFromConfig(this.config),
      });
    } catch {
      return null;
    }

    if (
      !payload.sub ||
      payload.typ !== ADMIN_REALTIME_TOKEN_TYPE ||
      payload.scope !== ADMIN_REALTIME_TOKEN_SCOPE ||
      payload.role !== Role.ADMIN
    ) {
      return null;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(ADMIN_REALTIME_TOKEN_AUDIENCE)) {
      return null;
    }

    return {
      id: payload.sub,
      activeRole: Role.ADMIN,
      roles: [Role.ADMIN],
      authProvider: 'admin-realtime',
    };
  }

  private async tryVerifySupabaseJwt(
    token: string,
    requestedRoles: Role[] = [],
  ): Promise<AuthenticatedUser | null> {
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!supabaseJwtSecret) {
      return null;
    }

    let payload: SupabaseJwtPayload;
    try {
      payload = this.jwt.verify<SupabaseJwtPayload>(token, {
        secret: supabaseJwtSecret,
      });
    } catch {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    this.assertSupabaseAudience(payload);
    const tokenRoles = this.resolveSupabaseRoles(payload);
    const user = await this.syncSupabaseUser(payload, tokenRoles);
    const effectiveRoles = Array.from(new Set([...user.roles, ...tokenRoles]));
    this.assertRequestedRoles(effectiveRoles, requestedRoles);

    return {
      id: user.id,
      activeRole: requestedRoles[0],
      roles: effectiveRoles,
      authProvider: 'supabase',
      externalUserId: payload.sub,
    };
  }

  private assertSupabaseAudience(payload: SupabaseJwtPayload) {
    const expectedAudience = this.config.get<string>('SUPABASE_JWT_AUDIENCE') ?? 'authenticated';
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAudience)) {
      throw new UnauthorizedException('Invalid Supabase token audience');
    }
  }

  private resolveSupabaseRoles(payload: SupabaseJwtPayload): Role[] {
    const rawRoles = [
      payload.app_metadata?.role,
      ...(payload.app_metadata?.roles ?? []),
    ].filter((role): role is string => Boolean(role));

    const roles = rawRoles
      .map((role) => role.toUpperCase())
      .filter((role): role is Role => Object.values(Role).includes(role as Role));

    return roles.length > 0 ? Array.from(new Set(roles)) : [Role.CUSTOMER];
  }

  private assertRequestedRoles(effectiveRoles: Role[], requestedRoles: Role[]) {
    const missingRoles = requestedRoles.filter((role) => !effectiveRoles.includes(role));
    if (missingRoles.length > 0) {
      throw new UnauthorizedException('Supabase token is not allowed for the requested role');
    }
  }

  private async syncSupabaseUser(payload: SupabaseJwtPayload, roles: Role[]) {
    const phone = payload.phone?.trim() || `supabase:${payload.sub}`;
    const email = payload.email?.trim() || null;

    const existingBySupabaseId = await this.prisma.user.findUnique({
      where: { supabaseUserId: payload.sub },
      include: { customerProfile: true, providerProfile: true },
    });
    if (existingBySupabaseId) {
      return this.prisma.user.update({
        where: { id: existingBySupabaseId.id },
        data: {
          phone,
          email,
          roles: { set: Array.from(new Set([...existingBySupabaseId.roles, ...roles])) },
          customerProfile:
            roles.includes(Role.CUSTOMER) && !existingBySupabaseId.customerProfile
              ? { create: {} }
              : undefined,
          providerProfile:
            roles.includes(Role.PROVIDER) && !existingBySupabaseId.providerProfile
              ? {
                  create: {
                    displayName: `Partner ${phone.slice(-4)}`,
                    verification: { create: {} },
                  },
                }
              : undefined,
        },
      });
    }

    const existingByPhone = await this.prisma.user.findUnique({
      where: { phone },
      include: { customerProfile: true, providerProfile: true },
    });

    if (existingByPhone) {
      return this.prisma.user.update({
        where: { id: existingByPhone.id },
        data: {
          supabaseUserId: payload.sub,
          email,
          roles: { set: Array.from(new Set([...existingByPhone.roles, ...roles])) },
          customerProfile:
            roles.includes(Role.CUSTOMER) && !existingByPhone.customerProfile ? { create: {} } : undefined,
          providerProfile:
            roles.includes(Role.PROVIDER) && !existingByPhone.providerProfile
              ? {
                  create: {
                    displayName: `Partner ${phone.slice(-4)}`,
                    verification: { create: {} },
                  },
                }
              : undefined,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        supabaseUserId: payload.sub,
        phone,
        email,
        roles,
        customerProfile: roles.includes(Role.CUSTOMER) ? { create: {} } : undefined,
        providerProfile: roles.includes(Role.PROVIDER)
          ? {
              create: {
                displayName: `Partner ${phone.slice(-4)}`,
                verification: { create: {} },
              },
            }
          : undefined,
      },
    });
  }
}
