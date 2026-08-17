import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { AuthenticatedUser } from './auth.types';
import {
  adminRealtimeTokenSecretFromConfig,
  adminWebApiTokenSecretFromConfig,
  jwtAccessSecretFromConfig,
} from './jwt-secrets';
import { normalizeVietnamPhoneIdentifier } from './phone-number';

type NestJwtPayload = {
  activeRole?: Role;
  authEpoch?: string;
  exp?: number;
  familyId?: string;
  role?: Role;
  sub?: string;
  roles?: Role[];
};

type NestAuthenticatedUser = AuthenticatedUser & {
  sessionAuthEpoch: string;
  sessionFamilyId: string;
};

type SupabaseJwtPayload = {
  sub?: string;
  aud?: string | string[];
  iss?: string;
  phone?: string;
  email?: string;
  exp?: number;
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
  developmentFallback?: boolean;
};

type AdminWebApiJwtPayload = AdminRealtimeJwtPayload;

const ADMIN_REALTIME_TOKEN_TYPE = 'admin-realtime';
const ADMIN_REALTIME_TOKEN_AUDIENCE = 'hands-socket';
const ADMIN_REALTIME_TOKEN_SCOPE = 'admin:realtime';
const ADMIN_WEB_API_TOKEN_TYPE = 'admin-web-api';
const ADMIN_WEB_API_TOKEN_AUDIENCE = 'hands-api';
const ADMIN_WEB_API_TOKEN_SCOPE = 'admin:api';
const SUPABASE_MOBILE_ROLES = new Set<Role>([Role.CUSTOMER, Role.PROVIDER]);
const DEFAULT_ADMIN_WEB_SESSION_IDLE_TIMEOUT_SECONDS = 30 * 60;
const ADMIN_AUTHENTICATION_DENIAL_AUDIT_WINDOW_MS = 60_000;

@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly localAuthenticationDenialAuditAt = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly redisState?: RedisStateService,
  ) {}

  async authenticateBearerToken(token: string): Promise<AuthenticatedUser> {
    const adminWebUser = await this.tryVerifyAdminWebApiJwt(token);
    if (adminWebUser) {
      return adminWebUser;
    }

    const nestUser = this.tryVerifyNestJwt(token);
    if (nestUser) {
      const currentNestUser = await this.verifyCurrentMobileUser(nestUser);
      if (currentNestUser) return currentNestUser;
    }

    const supabaseUser = await this.tryVerifySupabaseJwt(token, [], true);
    if (supabaseUser) {
      return supabaseUser;
    }

    throw new UnauthorizedException('Invalid bearer token');
  }

  async authenticateSupabaseBearerToken(
    token: string,
    requestedRoles: Role[] = [],
    options: { requireAuthServer?: boolean } = {},
  ): Promise<AuthenticatedUser> {
    const supabaseUser = await this.tryVerifySupabaseJwt(
      token,
      requestedRoles,
      options.requireAuthServer ?? false,
    );
    if (!supabaseUser) {
      throw new UnauthorizedException('Invalid Supabase bearer token');
    }
    return supabaseUser;
  }

  async authenticateSocketToken(token: string): Promise<AuthenticatedUser> {
    const adminRealtimeUser = await this.tryVerifyAdminRealtimeJwt(token);
    if (adminRealtimeUser) {
      return adminRealtimeUser;
    }

    const user = await this.authenticateBearerToken(token);
    if (user.roles.includes(Role.ADMIN)) {
      throw new UnauthorizedException('Admin sockets require an admin realtime token');
    }
    return user;
  }

  private tryVerifyNestJwt(token: string): NestAuthenticatedUser | null {
    try {
      const payload = this.jwt.verify<NestJwtPayload>(token, {
        algorithms: ['HS256'],
        secret: jwtAccessSecretFromConfig(this.config),
      });

      if (
        !payload.sub ||
        !payload.exp ||
        !payload.authEpoch ||
        !payload.familyId ||
        nestJwtCarriesAdminRole(payload)
      ) {
        return null;
      }

      return {
        id: payload.sub,
        activeRole: payload.activeRole ?? payload.role,
        roles: payload.roles ?? [],
        authProvider: 'nest',
        sessionAuthEpoch: payload.authEpoch,
        sessionFamilyId: payload.familyId,
        ...(payload.exp ? { tokenExpiresAt: payload.exp * 1000 } : {}),
      };
    } catch {
      return null;
    }
  }

  private async verifyCurrentMobileUser(
    tokenUser: NestAuthenticatedUser,
  ): Promise<AuthenticatedUser | null> {
    if (
      !(await this.isMobileSessionFamilyActive(
        tokenUser.sessionFamilyId,
        tokenUser.sessionAuthEpoch,
      ))
    ) {
      return null;
    }
    const claimedRoles = tokenUser.roles.filter((role) => SUPABASE_MOBILE_ROLES.has(role));
    if (
      claimedRoles.length === 0 ||
      claimedRoles.length !== tokenUser.roles.length ||
      (tokenUser.activeRole && !claimedRoles.includes(tokenUser.activeRole))
    ) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenUser.id },
      select: {
        id: true,
        roles: true,
        customerProfile: { select: { id: true } },
        providerProfile: { select: { id: true, deletedAt: true } },
      },
    });
    if (!user || user.roles.some((role) => !SUPABASE_MOBILE_ROLES.has(role))) {
      return null;
    }

    const currentRoles = claimedRoles.filter((role) => user.roles.includes(role));
    if (
      currentRoles.length !== claimedRoles.length ||
      (currentRoles.includes(Role.CUSTOMER) && !user.customerProfile) ||
      (currentRoles.includes(Role.PROVIDER) && (!user.providerProfile || user.providerProfile.deletedAt))
    ) {
      return null;
    }

    return {
      ...tokenUser,
      activeRole: tokenUser.activeRole ?? currentRoles[0],
      roles: currentRoles,
    };
  }

  private async isMobileSessionFamilyActive(familyId: string, authEpoch: string) {
    if (!this.redisState) {
      this.logger.warn('Mobile access-token revocation state is unavailable');
      return false;
    }
    try {
      return await this.redisState.isMobileSessionActive(familyId, authEpoch);
    } catch {
      this.logger.warn('Mobile access-token revocation check failed');
      return false;
    }
  }

  private async tryVerifyAdminRealtimeJwt(token: string): Promise<AuthenticatedUser | null> {
    if (unverifiedJwtType(token) !== ADMIN_REALTIME_TOKEN_TYPE) {
      return null;
    }

    let payload: AdminRealtimeJwtPayload;
    try {
      payload = this.jwt.verify<AdminRealtimeJwtPayload>(token, {
        algorithms: ['HS256'],
        secret: adminRealtimeTokenSecretFromConfig(this.config),
      });
    } catch {
      return null;
    }

    if (
      !payload.sub ||
      payload.typ !== ADMIN_REALTIME_TOKEN_TYPE ||
      payload.scope !== ADMIN_REALTIME_TOKEN_SCOPE ||
      payload.role !== Role.ADMIN ||
      !payload.jti ||
      !payload.exp
    ) {
      return null;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(ADMIN_REALTIME_TOKEN_AUDIENCE)) {
      return null;
    }

    return this.verifyAdminWebSession(payload, 'admin-realtime');
  }

  private async tryVerifyAdminWebApiJwt(token: string): Promise<AuthenticatedUser | null> {
    if (unverifiedJwtType(token) !== ADMIN_WEB_API_TOKEN_TYPE) {
      return null;
    }

    let payload: AdminWebApiJwtPayload;
    try {
      payload = this.jwt.verify<AdminWebApiJwtPayload>(token, {
        algorithms: ['HS256'],
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
      !payload.jti ||
      !payload.exp ||
      !audiences.includes(ADMIN_WEB_API_TOKEN_AUDIENCE)
    ) {
      return null;
    }

    return this.verifyAdminWebSession(payload, 'admin-web');
  }

  private async verifyAdminWebSession(
    payload: AdminWebApiJwtPayload,
    authProvider: 'admin-realtime' | 'admin-web',
  ): Promise<AuthenticatedUser | null> {
    if (!payload.sub || !payload.jti) {
      return null;
    }
    const session = await this.prisma.adminWebSession.findUnique({
      where: { id: payload.jti },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        mfaVerifiedAt: true,
        revokedAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            roles: true,
            adminOperatorPermission: { select: { id: true, categories: true, version: true } },
            adminOperatorCredential: { select: { disabledAt: true, lockedUntil: true } },
          },
        },
      },
    });
    const now = new Date();
    const idleTimeoutMs = this.adminWebSessionIdleTimeoutMs();
    const denialReason = !session
      ? 'SESSION_NOT_FOUND'
      : session.userId !== payload.sub
        ? 'SESSION_IDENTITY_MISMATCH'
        : session.revokedAt
          ? 'SESSION_REVOKED'
          : session.expiresAt <= now
            ? 'SESSION_EXPIRED'
            : now.getTime() - session.lastSeenAt.getTime() >= idleTimeoutMs
              ? 'SESSION_IDLE_EXPIRED'
              : !session.user.roles.includes(Role.ADMIN)
              ? 'ADMIN_ROLE_REVOKED'
              : !session.user.adminOperatorPermission
                ? 'ADMIN_PERMISSION_MISSING'
                : !session.user.adminOperatorCredential
                  ? 'ADMIN_CREDENTIAL_MISSING'
                  : session.user.adminOperatorCredential.disabledAt
                    ? 'ADMIN_CREDENTIAL_DISABLED'
                    : (session.user.adminOperatorCredential.lockedUntil?.getTime() ?? 0) > now.getTime()
                      ? 'ADMIN_CREDENTIAL_LOCKED'
                      : null;
    if (denialReason) {
      if (authProvider === 'admin-realtime' && payload.developmentFallback === true) {
        const fallback = await this.tryVerifyDevelopmentAdminRealtimeFallback(payload);
        if (fallback) return fallback;
      }
      await this.recordAdminAuthenticationDenial(authProvider, payload.jti, denialReason);
      return null;
    }
    if (!session || !session.user.adminOperatorPermission || !session.user.adminOperatorCredential) {
      return null;
    }
    if (authProvider === 'admin-realtime' && !session.mfaVerifiedAt) {
      await this.recordAdminAuthenticationDenial(authProvider, payload.jti, 'SESSION_MFA_UNVERIFIED');
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() >= 60_000) {
      await this.prisma.adminWebSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    return {
      id: session.user.id,
      activeRole: Role.ADMIN,
      roles: session.user.roles,
      authProvider,
      sessionId: session.id,
      adminPermissionCategories: session.user.adminOperatorPermission.categories,
      adminPermissionVersion: session.user.adminOperatorPermission.version,
      adminMfaEnrollmentRequired: !session.mfaVerifiedAt,
      ...(payload.exp ? { tokenExpiresAt: payload.exp * 1000 } : {}),
    };
  }

  private adminWebSessionIdleTimeoutMs() {
    const configured = Number(this.config.get<string>('ADMIN_WEB_SESSION_IDLE_TIMEOUT_SECONDS'));
    const seconds = Number.isFinite(configured) && configured >= 60
      ? configured
      : DEFAULT_ADMIN_WEB_SESSION_IDLE_TIMEOUT_SECONDS;
    return seconds * 1000;
  }

  private async recordAdminAuthenticationDenial(
    authProvider: 'admin-realtime' | 'admin-web',
    sessionId: string,
    reason: string,
  ) {
    if (!(await this.shouldRecordAdminAuthenticationDenial(authProvider, sessionId, reason))) return;
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: null,
          action: authProvider === 'admin-realtime'
            ? 'admin_operator.realtime.authentication_denied'
            : 'admin_operator.rest.authentication_denied',
          target: `admin_web_session:${sessionId}`,
          metadata: { authProvider, reason, sessionId },
        },
      });
    } catch {
      this.logger.warn('Could not record Admin authentication denial');
    }
  }

  private async shouldRecordAdminAuthenticationDenial(
    authProvider: 'admin-realtime' | 'admin-web',
    sessionId: string,
    reason: string,
  ) {
    const key = `${authProvider}:${sessionId}:${reason}`;
    if (this.redisState) {
      try {
        const result = await this.redisState.consumeRateLimit(
          `audit:admin-authentication-denial:${key}`,
          ADMIN_AUTHENTICATION_DENIAL_AUDIT_WINDOW_MS,
        );
        return result.count === 1;
      } catch {
        this.logger.warn('Admin authentication denial audit limiter unavailable');
      }
    }

    const now = Date.now();
    const lastRecordedAt = this.localAuthenticationDenialAuditAt.get(key) ?? 0;
    if (now - lastRecordedAt < ADMIN_AUTHENTICATION_DENIAL_AUDIT_WINDOW_MS) return false;
    this.localAuthenticationDenialAuditAt.set(key, now);
    if (this.localAuthenticationDenialAuditAt.size > 1_000) {
      for (const [candidate, recordedAt] of this.localAuthenticationDenialAuditAt) {
        if (now - recordedAt >= ADMIN_AUTHENTICATION_DENIAL_AUDIT_WINDOW_MS) {
          this.localAuthenticationDenialAuditAt.delete(candidate);
        }
      }
      while (this.localAuthenticationDenialAuditAt.size > 1_000) {
        const oldestKey = this.localAuthenticationDenialAuditAt.keys().next().value;
        if (typeof oldestKey !== 'string') break;
        this.localAuthenticationDenialAuditAt.delete(oldestKey);
      }
    }
    return true;
  }

  private async tryVerifyDevelopmentAdminRealtimeFallback(
    payload: AdminRealtimeJwtPayload,
  ): Promise<AuthenticatedUser | null> {
    if (
      this.config.get<string>('NODE_ENV') === 'production' ||
      this.config.get<string>('ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN') !== 'true' ||
      !payload.sub
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
      select: {
        id: true,
        roles: true,
        adminOperatorPermission: { select: { categories: true, version: true } },
      },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      activeRole: Role.ADMIN,
      roles: user.roles,
      authProvider: 'admin-realtime',
      adminPermissionCategories: user.adminOperatorPermission?.categories ?? [],
      adminPermissionVersion: user.adminOperatorPermission?.version,
      ...(payload.exp ? { tokenExpiresAt: payload.exp * 1000 } : {}),
    };
  }

  private async tryVerifySupabaseJwt(
    token: string,
    requestedRoles: Role[] = [],
    requireAuthServer = false,
  ): Promise<AuthenticatedUser | null> {
    const payload = requireAuthServer
      ? await this.verifySupabaseJwtWithAuthServer(token)
      : await this.verifySupabaseJwt(token);

    if (!payload?.sub) {
      return null;
    }

    this.assertSupabaseAudience(payload);
    const tokenRoles = this.resolveSupabaseRoles(payload);
    this.assertRequestedRoles(tokenRoles, requestedRoles);
    const user = await this.syncSupabaseUser(payload, tokenRoles);

    return {
      id: user.id,
      activeRole: requestedRoles[0] ?? tokenRoles[0],
      roles: tokenRoles,
      authProvider: 'supabase',
      externalUserId: payload.sub,
      ...(payload.exp ? { tokenExpiresAt: payload.exp * 1000 } : {}),
    };
  }

  private async verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload | null> {
    const supabaseJwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (supabaseJwtSecret) {
      try {
        return this.jwt.verify<SupabaseJwtPayload>(token, {
          algorithms: ['HS256'],
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
    const rawRoles = [payload.app_metadata?.role, ...(payload.app_metadata?.roles ?? [])].filter(
      (role): role is string => Boolean(role),
    );

    const roles = rawRoles
      .map((role) => role.toUpperCase())
      .filter((role): role is Role => SUPABASE_MOBILE_ROLES.has(role as Role));

    return roles.length > 0 ? Array.from(new Set(roles)) : [Role.CUSTOMER];
  }

  private assertRequestedRoles(effectiveRoles: Role[], requestedRoles: Role[]) {
    const missingRoles = requestedRoles.filter((role) => !effectiveRoles.includes(role));
    if (missingRoles.length > 0) {
      throw new UnauthorizedException('Supabase token is not allowed for the requested role');
    }
  }

  private async syncSupabaseUser(payload: SupabaseJwtPayload, roles: Role[]) {
    const phone = payload.phone ? normalizeVietnamPhoneIdentifier(payload.phone) : `supabase:${payload.sub}`;
    const email = payload.email?.trim() || null;

    const existingBySupabaseId = await this.prisma.user.findUnique({
      where: { supabaseUserId: payload.sub },
      include: { customerProfile: true, providerProfile: true },
    });
    if (existingBySupabaseId) {
      assertSupabaseMobileIdentityBoundary(existingBySupabaseId.roles);
      return this.prisma.user.update({
        where: { id: existingBySupabaseId.id },
        data: {
          phone,
          email,
          roles: { set: roles },
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
      assertSupabaseMobileIdentityBoundary(existingByPhone.roles);
      return this.prisma.user.update({
        where: { id: existingByPhone.id },
        data: {
          supabaseUserId: payload.sub,
          email,
          roles: { set: roles },
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

function nestJwtCarriesAdminRole(payload: NestJwtPayload) {
  return (
    payload.activeRole === Role.ADMIN ||
    payload.role === Role.ADMIN ||
    payload.roles?.includes(Role.ADMIN) === true
  );
}

function assertSupabaseMobileIdentityBoundary(roles: Role[]) {
  if (roles.some((role) => !SUPABASE_MOBILE_ROLES.has(role))) {
    throw new UnauthorizedException('Supabase mobile identity cannot use an Admin operator account');
  }
}

function unverifiedJwtType(token: string) {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
      typ?: unknown;
    };
    return typeof payload.typ === 'string' ? payload.typ : null;
  } catch {
    return null;
  }
}
