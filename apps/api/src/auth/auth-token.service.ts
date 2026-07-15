import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './auth.types';
import {
  adminRealtimeTokenSecretFromConfig,
  adminWebApiTokenSecretFromConfig,
  jwtAccessSecretFromConfig,
} from './jwt-secrets';
import { normalizeVietnamPhoneIdentifier } from './phone-number';

type NestJwtPayload = {
  activeRole?: Role;
  role?: Role;
  sub?: string;
  roles?: Role[];
};

type SupabaseJwtPayload = {
  sub?: string;
  aud?: string | string[];
  iss?: string;
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

type AdminWebApiJwtPayload = AdminRealtimeJwtPayload;

const ADMIN_REALTIME_TOKEN_TYPE = 'admin-realtime';
const ADMIN_REALTIME_TOKEN_AUDIENCE = 'hands-socket';
const ADMIN_REALTIME_TOKEN_SCOPE = 'admin:realtime';
const ADMIN_WEB_API_TOKEN_TYPE = 'admin-web-api';
const ADMIN_WEB_API_TOKEN_AUDIENCE = 'hands-api';
const ADMIN_WEB_API_TOKEN_SCOPE = 'admin:api';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticateBearerToken(token: string): Promise<AuthenticatedUser> {
    const adminWebUser = await this.tryVerifyAdminWebApiJwt(token);
    if (adminWebUser) {
      return adminWebUser;
    }

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

  private async tryVerifyAdminWebApiJwt(token: string): Promise<AuthenticatedUser | null> {
    if (unverifiedJwtType(token) !== ADMIN_WEB_API_TOKEN_TYPE) {
      return null;
    }

    let payload: AdminWebApiJwtPayload;
    try {
      payload = this.jwt.verify<AdminWebApiJwtPayload>(token, {
        secret: adminWebApiTokenSecretFromConfig(this.config),
      });
    } catch {
      return null;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      !payload.sub ||
      payload.typ !== ADMIN_WEB_API_TOKEN_TYPE ||
      payload.scope !== ADMIN_WEB_API_TOKEN_SCOPE ||
      payload.role !== Role.ADMIN ||
      !audiences.includes(ADMIN_WEB_API_TOKEN_AUDIENCE)
    ) {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        roles: { has: Role.ADMIN },
        OR: [
          { id: payload.sub },
          { email: payload.sub },
          { phone: payload.sub },
          { adminOperatorCredential: { is: { email: payload.sub } } },
        ],
      },
      select: { id: true, roles: true },
    });
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      activeRole: Role.ADMIN,
      roles: user.roles,
      authProvider: 'admin-web',
    };
  }

  private async tryVerifySupabaseJwt(
    token: string,
    requestedRoles: Role[] = [],
  ): Promise<AuthenticatedUser | null> {
    const payload = await this.verifySupabaseJwt(token);

    if (!payload?.sub) {
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

  private async verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload | null> {
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (supabaseJwtSecret) {
      try {
        return this.jwt.verify<SupabaseJwtPayload>(token, {
          secret: supabaseJwtSecret,
        });
      } catch {
        // Projects using Supabase signing keys require Auth/JWKS verification.
      }
    }

    return this.verifySupabaseJwtWithAuthServer(token);
  }

  private async verifySupabaseJwtWithAuthServer(token: string): Promise<SupabaseJwtPayload | null> {
    const projectUrl = this.supabaseProjectUrl();
    const apiKey = this.config.get<string>('SUPABASE_ANON_KEY')?.trim();
    if (!projectUrl || !apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${projectUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: apiKey,
          authorization: `Bearer ${token}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        return null;
      }

      const authUser = (await response.json()) as {
        id?: string;
        phone?: string;
        email?: string;
        app_metadata?: SupabaseJwtPayload['app_metadata'];
        user_metadata?: SupabaseJwtPayload['user_metadata'];
      };
      const decoded = this.jwt.decode<SupabaseJwtPayload>(token);
      if (!decoded?.sub || !authUser.id || decoded.sub !== authUser.id) {
        return null;
      }

      const expectedIssuer = `${projectUrl}/auth/v1`;
      if (decoded.iss && decoded.iss !== expectedIssuer) {
        return null;
      }

      return {
        ...decoded,
        phone: authUser.phone ?? decoded.phone,
        email: authUser.email ?? decoded.email,
        app_metadata: authUser.app_metadata ?? decoded.app_metadata,
        user_metadata: authUser.user_metadata ?? decoded.user_metadata,
      };
    } catch {
      return null;
    }
  }

  private supabaseProjectUrl(): string | null {
    const rawUrl = this.config.get<string>('SUPABASE_URL')?.trim().replace(/\/+$/, '');
    if (!rawUrl) {
      return null;
    }

    try {
      const url = new URL(rawUrl);
      return url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : null;
    } catch {
      return null;
    }
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
    const phone = payload.phone
      ? normalizeVietnamPhoneIdentifier(payload.phone)
      : `supabase:${payload.sub}`;
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

function unverifiedJwtType(token: string) {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as { typ?: unknown };
    return typeof payload.typ === 'string' ? payload.typ : null;
  } catch {
    return null;
  }
}
