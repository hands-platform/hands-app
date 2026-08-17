import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminUserProvenance, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { AuthTokenService } from './auth-token.service';
import {
  hashAdminOperatorPassword,
  verifyAdminOperatorPasswordOrDummy,
} from './admin-operator-credential';
import {
  assertAdminMfaEncryptionSecret,
  type AdminMfaVerification,
  verifyAdminMfaCode,
} from './admin-mfa';
import { jwtAccessSecretFromConfig, jwtRefreshSecretFromConfig } from './jwt-secrets';
import { OtpDeliveryService } from './otp-delivery.service';
import { normalizeVietnamPhoneIdentifier } from './phone-number';
import { SocketAuthService } from './socket-auth.service';
import { developmentOtpFromConfig } from './development-otp';

type RefreshPayload = {
  activeRole?: Role;
  authProvider?: 'supabase';
  familyId?: string;
  jti?: string;
  role?: Role;
  sub?: string;
  tokenType?: string;
  exp?: number;
};

const ADMIN_LOGIN_ACCOUNT_FAILURE_WINDOW_MS = 15 * 60_000;
const ADMIN_LOGIN_ACCOUNT_MAX_FAILURES = 20;
const ADMIN_LOGIN_ACCOUNT_FALLBACK_MAX_KEYS = 1_000;

const MOBILE_EXCHANGE_ROLES = [Role.CUSTOMER, Role.PROVIDER] as const;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_SEND_COOLDOWN_MS = 60_000;
const OTP_SEND_BUDGET_WINDOW_MS = 24 * 60 * 60_000;
const OTP_SEND_PHONE_DAILY_MAX = 10;
const OTP_SEND_PREFIX_DAILY_MAX = 200;
const OTP_SEND_GLOBAL_DAILY_MAX = 10_000;
const REFRESH_TOKEN_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const ADMIN_WEB_SESSION_MAX_TTL_SECONDS = 8 * 60 * 60;
const ADMIN_LOGIN_AUDIT_VALUE_MAX_LENGTH = 200;
type MobileExchangeRole = (typeof MOBILE_EXCHANGE_ROLES)[number];

type AdminLoginRequestContext = {
  sourceIp?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly fallbackOtps = new Map<string, { otp: string; expiresAt: number }>();
  private readonly fallbackOtpAttempts = new Map<string, number>();
  private readonly fallbackOtpSendCooldowns = new Map<string, number>();
  private readonly fallbackRevokedRefreshTokens = new Map<string, number>();
  private readonly fallbackAdminLoginFailures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redisState: RedisStateService,
    private readonly otpDelivery: OtpDeliveryService,
    private readonly authTokens: AuthTokenService,
    @Optional() private readonly socketAuth?: SocketAuthService,
  ) {}

  async requestOtp(input: { phone: string; role?: Role }) {
    const role = this.assertMobileAuthRole(input.role ?? Role.CUSTOMER);
    const phone = normalizeVietnamPhoneIdentifier(input.phone);
    await this.reserveOtpSend(phone);
    await this.enforceOtpSendBudget(phone);
    const developmentOtp = developmentOtpFromConfig(this.config);
    const otp = developmentOtp ?? this.generateOtp();
    await this.storeOtp(phone, otp);
    let delivery: Awaited<ReturnType<OtpDeliveryService['deliverOtp']>>;
    try {
      delivery = await this.otpDelivery.deliverOtp(phone, otp);
    } catch (error) {
      await this.clearFailedOtpDelivery(phone);
      throw error;
    }

    return {
      phone,
      role,
      status: 'OTP_REQUESTED',
      delivery,
      ...(developmentOtp ? { devOtp: developmentOtp } : {}),
    };
  }

  async verifyOtp(input: { phone: string; otp: string; role?: Role }) {
    const role = this.assertMobileAuthRole(input.role ?? Role.CUSTOMER);
    const phone = normalizeVietnamPhoneIdentifier(input.phone);
    await this.assertValidOtp(phone, input.otp);
    const existing = await this.prisma.user.findUnique({
      where: { phone },
      include: { customerProfile: true, providerProfile: true },
    });
    this.assertMobileIdentityBoundary(existing?.roles ?? []);

    const roles = Array.from(new Set([...(existing?.roles ?? []), role]));
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {
        roles: { set: roles },
        customerProfile: role === Role.CUSTOMER && !existing?.customerProfile ? { create: {} } : undefined,
        providerProfile:
          role === Role.PROVIDER && !existing?.providerProfile
            ? {
                create: {
                  displayName: `Partner ${phone.slice(-4)}`,
                  verification: { create: {} },
                },
              }
            : undefined,
      },
      create: {
        phone,
        roles: [role],
        customerProfile: role === Role.CUSTOMER ? { create: {} } : undefined,
        providerProfile:
          role === Role.PROVIDER
            ? {
                create: {
                  displayName: `Partner ${phone.slice(-4)}`,
                  verification: { create: {} },
                },
              }
            : undefined,
      },
      include: { customerProfile: true, providerProfile: true },
    });

    const sessionUser = { ...user, roles: [role] };
    const { accessToken, refreshToken } = this.signSessionTokens(sessionUser, role);

    return {
      user: sessionUser,
      otpAccepted: true,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    const refreshFamilyId = payload.familyId ?? refreshTokenHash(refreshToken);
    await this.consumeRefreshToken(refreshToken, payload.exp, refreshFamilyId);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Refresh token subject no longer exists');
    }
    this.assertMobileIdentityBoundary(user.roles);

    const activeRole = this.resolveRefreshActiveRole(payload, user.roles);
    if (!activeRole) {
      throw new UnauthorizedException('Refresh token requires an explicit mobile role');
    }

    const session = this.signSessionTokens(user, activeRole, {
      authProvider: payload.authProvider,
      refreshFamilyId,
      refreshed: true,
    });
    return session;
  }

  async logout(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    const familyId = payload.familyId ?? refreshTokenHash(refreshToken);
    await this.revokeRefreshToken(
      refreshToken,
      payload.exp,
      familyId,
    );
    await this.socketAuth?.disconnectMobileFamily(familyId);
    return { ok: true };
  }

  async verifyAdminOperatorLogin(input: {
    email: string;
    mfaCode?: string;
    password: string;
    platformSummary?: string;
  }, requestContext: AdminLoginRequestContext = {}) {
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    const credential = await this.prisma.adminOperatorCredential.findUnique({
      where: { email },
      select: {
        id: true,
        failedLoginCount: true,
        lastFailedLoginAt: true,
        lockedUntil: true,
        disabledAt: true,
        passwordHash: true,
        passwordSalt: true,
        mfaState: true,
        mfaSecretEncrypted: true,
        mfaRecoveryCodeHashes: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roles: true,
            adminOperatorPermission: { select: { id: true } },
          },
        },
      },
    });
    const passwordMatches = verifyAdminOperatorPasswordOrDummy(input.password, credential);
    let mfaVerification: AdminMfaVerification = {
      recoveryCodeHashes: null,
      totpCounter: null,
      verified: true,
    };
    if (
      credential &&
      !credential.disabledAt &&
      (credential.lockedUntil?.getTime() ?? 0) <= now.getTime() &&
      credential.user.roles.includes(Role.ADMIN) &&
      credential.user.adminOperatorPermission &&
      passwordMatches &&
      credential.mfaState === 'VERIFIED'
    ) {
      const encryptionSecret = this.config.get<string>('ADMIN_MFA_ENCRYPTION_KEY');
      try {
        assertAdminMfaEncryptionSecret(encryptionSecret);
        if (!credential.mfaSecretEncrypted) throw new Error('Admin MFA secret is missing');
        mfaVerification = verifyAdminMfaCode({
          code: input.mfaCode,
          encryptedSecret: credential.mfaSecretEncrypted,
          encryptionSecret,
          recoveryCodeHashes: credential.mfaRecoveryCodeHashes,
          nowMs: now.getTime(),
        });
      } catch {
        throw new ServiceUnavailableException('Admin MFA verification is unavailable');
      }
      if (mfaVerification.verified && mfaVerification.totpCounter !== null) {
        try {
          const consumed = await this.redisState.consumeAdminMfaTotp(
            credential.id,
            mfaVerification.totpCounter,
          );
          if (!consumed) {
            mfaVerification = {
              recoveryCodeHashes: null,
              totpCounter: null,
              verified: false,
            };
          }
        } catch {
          throw new ServiceUnavailableException('Admin MFA verification is unavailable');
        }
      }
    }
    if (
      !credential ||
      credential.disabledAt ||
      (credential.lockedUntil?.getTime() ?? 0) > now.getTime() ||
      !credential.user.roles.includes(Role.ADMIN) ||
      !credential.user.adminOperatorPermission ||
      !passwordMatches ||
      !mfaVerification.verified
    ) {
      if (credential && !credential.disabledAt && (credential.lockedUntil?.getTime() ?? 0) <= now.getTime()) {
        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.adminOperatorCredential.update({
            where: { id: credential.id },
            data: {
              failedLoginCount: { increment: 1 },
              lastFailedLoginAt: now,
            },
            select: { failedLoginCount: true },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId: null,
              action: 'admin_operator.login.failed',
              target: `user:${credential.user.id}`,
              metadata: {
                failedLoginCount: updated.failedLoginCount,
                locked: false,
                ...adminLoginAuditContext(requestContext),
              },
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } else if (credential) {
        await this.prisma.adminAuditLog.create({
          data: {
            actorId: null,
            action: 'admin_operator.login.blocked',
            target: `user:${credential.user.id}`,
            metadata: {
              disabled: Boolean(credential.disabledAt),
              locked: (credential.lockedUntil?.getTime() ?? 0) > now.getTime(),
              ...adminLoginAuditContext(requestContext),
            },
          },
        });
      } else {
        const identityHash = createHash('sha256').update(email).digest('hex');
        await this.prisma.adminAuditLog.create({
          data: {
            actorId: null,
            action: 'admin_operator.login.failed_unknown_identity',
            target: `admin_login_identity:${identityHash}`,
            metadata: {
              identityHash,
              ...adminLoginAuditContext(requestContext),
            },
          },
        });
      }
      await this.enforceAdminLoginAccountFailureLimit(email);
      throw new UnauthorizedException('Invalid admin operator credentials');
    }

    const sessionId = randomUUID();
    const ttlSeconds = adminWebSessionTtlSeconds(this.config.get<string>('ADMIN_WEB_SESSION_TTL_SECONDS'));
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    await this.prisma.$transaction([
      this.prisma.adminOperatorCredential.update({
        where: { id: credential.id },
        data: {
          failedLoginCount: 0,
          lastLoginAt: now,
          lockedUntil: null,
          ...(mfaVerification.recoveryCodeHashes
            ? { mfaRecoveryCodeHashes: { set: mfaVerification.recoveryCodeHashes } }
            : {}),
        },
      }),
      this.prisma.adminWebSession.create({
        data: {
          id: sessionId,
          userId: credential.user.id,
          issuedAt: now,
          expiresAt,
          lastSeenAt: now,
          reauthenticatedAt: now,
          mfaVerifiedAt: credential.mfaState === 'VERIFIED' ? now : null,
          platformSummary:
            requestContext.userAgent?.trim().slice(0, ADMIN_LOGIN_AUDIT_VALUE_MAX_LENGTH) || null,
        },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          actorId: credential.user.id,
          action: 'admin_operator.login.success',
          target: `user:${credential.user.id}`,
          metadata: { sessionId, ...adminLoginAuditContext(requestContext) },
        },
      }),
    ]);

    return {
      authenticated: true,
      user: credential.user,
      session: {
        id: sessionId,
        issuedAt: now,
        expiresAt,
        mfaEnrollmentRequired: credential.mfaState !== 'VERIFIED',
      },
    };
  }

  async acceptAdminOperatorInvitation(input: { token: string; password: string }) {
    const token = input.token.trim();
    if (!token) throw new BadRequestException('Invitation token is required');
    if (input.password.length < 12) {
      throw new BadRequestException('Operator password must be at least 12 characters');
    }
    const tokenHash = createHash('sha256').update(token).digest('base64url');
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.adminOperatorInvitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
        throw new ConflictException({
          code: 'ADMIN_OPERATOR_INVITATION_INVALID',
          message: 'This invitation is invalid, expired, or already used',
        });
      }
      const existingCredential = await tx.adminOperatorCredential.findUnique({
        where: { email: invitation.normalizedEmail },
        select: { id: true },
      });
      if (existingCredential) {
        throw new ConflictException({
          code: 'ADMIN_OPERATOR_CREDENTIAL_EXISTS',
          message: 'This operator already has login credentials',
        });
      }

      const targetUser = invitation.targetUserId
        ? await tx.user.findUnique({ where: { id: invitation.targetUserId } })
        : null;
      if (invitation.targetUserId && !targetUser) {
        throw new ConflictException({
          code: 'ADMIN_OPERATOR_INVITATION_TARGET_MISSING',
          message: 'The selected existing user no longer exists',
        });
      }
      if (!targetUser) {
        const ambiguousUsers = await tx.user.findMany({
          where: { email: { equals: invitation.normalizedEmail, mode: 'insensitive' } },
          select: { id: true },
          take: 2,
        });
        if (ambiguousUsers.length > 0) {
          throw new ConflictException({
            code: 'ADMIN_OPERATOR_EXISTING_USER_SELECTION_REQUIRED',
            message: 'Select the existing user explicitly before accepting this invitation',
          });
        }
      }

      const nextRoles = [...new Set([
        ...(targetUser?.roles ?? []),
        Role.ADMIN,
        ...(invitation.masterAdminEnabled ? [Role.MASTER_ADMIN] : []),
      ])];
      const user = targetUser
        ? await tx.user.update({
            where: { id: targetUser.id },
            data: {
              email: invitation.normalizedEmail,
              ...(invitation.fullName ? { fullName: invitation.fullName } : {}),
              roles: { set: nextRoles },
              adminUserProvenance: targetUser.adminUserProvenance ?? AdminUserProvenance.PRODUCTION,
            },
          })
        : await tx.user.create({
            data: {
              phone: generatedAdminOperatorPhone(invitation.normalizedEmail),
              email: invitation.normalizedEmail,
              fullName: invitation.fullName,
              roles: nextRoles,
              adminUserProvenance: AdminUserProvenance.PRODUCTION,
            },
          });
      const passwordCredential = hashAdminOperatorPassword(input.password);
      await tx.adminOperatorCredential.create({
        data: {
          userId: user.id,
          email: invitation.normalizedEmail,
          passwordHash: passwordCredential.passwordHash,
          passwordSalt: passwordCredential.passwordSalt,
          setupCompletedAt: now,
        },
      });
      await tx.adminOperatorPermission.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          categories: { set: invitation.permissionCategories },
        },
        update: {
          categories: { set: invitation.permissionCategories },
          version: { increment: 1 },
        },
      });
      await tx.adminOperatorInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: now, pendingKey: null, targetUserId: user.id },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: 'admin_operator.invitation.accept',
          target: `user:${user.id}`,
          metadata: { invitationId: invitation.id, invitedByAdminId: invitation.invitedByAdminId },
        },
      });

      return { accepted: true, user: { id: user.id, email: user.email, fullName: user.fullName } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async exchangeSupabaseSession(input: { supabaseAccessToken: string; role?: Role }) {
    const role = this.assertExchangeRole(input.role ?? Role.CUSTOMER);
    const authenticated = await this.authTokens.authenticateSupabaseBearerToken(
      input.supabaseAccessToken,
      [role],
      { requireAuthServer: true },
    );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authenticated.id },
      include: { customerProfile: true, providerProfile: true },
    });
    this.assertMobileIdentityBoundary(user.roles);

    const sessionUser = { ...user, roles: [role] };
    const { accessToken, refreshToken } = this.signSessionTokens(sessionUser, role, {
      authProvider: 'supabase',
    });

    return {
      user: sessionUser,
      accessToken,
      refreshToken,
      exchangedFrom: 'supabase',
    };
  }

  private assertExchangeRole(role: Role): MobileExchangeRole {
    if (!MOBILE_EXCHANGE_ROLES.includes(role as MobileExchangeRole)) {
      throw new UnauthorizedException('Supabase mobile exchange only supports CUSTOMER or PROVIDER roles');
    }
    return role as MobileExchangeRole;
  }

  private assertMobileAuthRole(role: Role): MobileExchangeRole {
    if (!MOBILE_EXCHANGE_ROLES.includes(role as MobileExchangeRole)) {
      throw new UnauthorizedException('Mobile auth only supports CUSTOMER or PROVIDER roles');
    }
    return role as MobileExchangeRole;
  }

  private assertMobileIdentityBoundary(roles: Role[]) {
    if (roles.some((role) => !this.isMobileExchangeRole(role))) {
      throw new UnauthorizedException('Mobile authentication cannot use an Admin operator account');
    }
  }

  private signSessionTokens(
    user: { id: string; roles: Role[] },
    activeRole: Role | undefined,
    extraPayload: {
      authProvider?: 'supabase';
      refreshed?: boolean;
      refreshFamilyId?: string;
    } = {},
  ) {
    const { refreshFamilyId = randomUUID(), ...accessMetadata } = extraPayload;
    const sessionRoles = activeRole
      ? [activeRole]
      : user.roles.filter((role): role is MobileExchangeRole => this.isMobileExchangeRole(role));
    const sessionPayload = {
      sub: user.id,
      roles: sessionRoles,
      familyId: refreshFamilyId,
      ...(activeRole ? { activeRole } : {}),
      ...accessMetadata,
    };

    return {
      accessToken: this.jwt.sign(sessionPayload, {
        secret: jwtAccessSecretFromConfig(this.config),
      }),
      refreshToken: this.jwt.sign(
        {
          sub: user.id,
          tokenType: 'refresh',
          jti: randomUUID(),
          familyId: refreshFamilyId,
          ...(activeRole ? { activeRole } : {}),
          ...(accessMetadata.authProvider ? { authProvider: accessMetadata.authProvider } : {}),
        },
        { secret: this.refreshSecret(), expiresIn: '30d' },
      ),
    };
  }

  private resolveRefreshActiveRole(payload: RefreshPayload, userRoles: Role[]) {
    const payloadRole = payload.activeRole ?? payload.role;
    if (payloadRole && this.isMobileExchangeRole(payloadRole) && userRoles.includes(payloadRole)) {
      return payloadRole;
    }

    const mobileRoles = userRoles.filter((role): role is MobileExchangeRole =>
      this.isMobileExchangeRole(role),
    );
    return mobileRoles.length === 1 ? mobileRoles[0] : undefined;
  }

  private isMobileExchangeRole(role: Role): role is MobileExchangeRole {
    return MOBILE_EXCHANGE_ROLES.includes(role as MobileExchangeRole);
  }

  private async assertValidOtp(phone: string, otp: string) {
    if (await this.consumeOtpIfMatches(phone, otp)) {
      return;
    }

    if (!this.isProduction()) {
      const storedOtp = await this.getStoredOtp(phone);
      if (storedOtp && otp === storedOtp) {
        await this.consumeOtp(phone);
        return;
      }
      const developmentOtp = developmentOtpFromConfig(this.config);
      if (!storedOtp && developmentOtp && otp === developmentOtp) {
        await this.consumeOtp(phone);
        return;
      }
    }

    const failedAttempts = await this.recordFailedOtpAttempt(phone);
    if (failedAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      await this.consumeOtp(phone);
    }
    throw new UnauthorizedException('Invalid OTP');
  }

  private async consumeOtpIfMatches(phone: string, otp: string) {
    try {
      return await this.redisState.consumeOtpIfMatches(phone, otp);
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis atomic OTP verification unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis atomic OTP verification unavailable; checking development fallback.');
      return false;
    }
  }

  private async storeOtp(phone: string, otp: string) {
    try {
      await this.redisState.setOtp(phone, otp);
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis OTP store unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP store unavailable; using in-memory OTP fallback.');
      this.fallbackOtps.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    }
  }

  private async clearFailedOtpDelivery(phone: string) {
    this.fallbackOtps.delete(phone);
    this.fallbackOtpAttempts.delete(phone);
    this.fallbackOtpSendCooldowns.delete(phone);
    try {
      await this.redisState.clearPendingOtp(phone);
    } catch {
      this.logger.warn('Redis OTP delivery cleanup unavailable.');
    }
  }

  private async reserveOtpSend(phone: string) {
    try {
      const reserved = await this.redisState.reserveOtpSend(phone);
      if (!reserved) {
        throw new HttpException('Please wait before requesting another OTP', HttpStatus.TOO_MANY_REQUESTS);
      }
      return;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }
      if (this.isProduction()) {
        this.logger.warn('Redis OTP send limiter unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP send limiter unavailable; using in-memory OTP cooldown.');
    }

    const now = Date.now();
    const cooldownUntil = this.fallbackOtpSendCooldowns.get(phone) ?? 0;
    if (cooldownUntil > now) {
      throw new HttpException('Please wait before requesting another OTP', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.fallbackOtpSendCooldowns.set(phone, now + OTP_SEND_COOLDOWN_MS);
  }

  private async enforceOtpSendBudget(phone: string) {
    const phoneHash = createHash('sha256').update(phone).digest('hex');
    const prefix = phone.replace(/\D/g, '').slice(0, 5) || 'unknown';
    const budgets = [
      {
        key: `otp-send:phone:${phoneHash}`,
        max: this.positiveIntegerConfig('OTP_SEND_PHONE_DAILY_MAX', OTP_SEND_PHONE_DAILY_MAX),
      },
      {
        key: `otp-send:prefix:${prefix}`,
        max: this.positiveIntegerConfig('OTP_SEND_PREFIX_DAILY_MAX', OTP_SEND_PREFIX_DAILY_MAX),
      },
      {
        key: 'otp-send:global',
        max: this.positiveIntegerConfig('OTP_SEND_GLOBAL_DAILY_MAX', OTP_SEND_GLOBAL_DAILY_MAX),
      },
    ];

    try {
      for (const budget of budgets) {
        const bucket = await this.redisState.consumeRateLimit(budget.key, OTP_SEND_BUDGET_WINDOW_MS);
        if (bucket.count > budget.max) {
          throw new HttpException('OTP request limit reached', HttpStatus.TOO_MANY_REQUESTS);
        }
      }
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }
      if (!this.isLocalOrTest()) {
        this.logger.warn('Redis OTP abuse budget unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP abuse budget unavailable in local/test environment.');
    }
  }

  private async enforceAdminLoginAccountFailureLimit(email: string) {
    const key = `admin-login-account:${createHash('sha256').update(email).digest('hex')}`;
    try {
      const bucket = await this.redisState.consumeRateLimit(key, ADMIN_LOGIN_ACCOUNT_FAILURE_WINDOW_MS);
      if (bucket.count > ADMIN_LOGIN_ACCOUNT_MAX_FAILURES) {
        throw new HttpException('Too many admin login attempts', HttpStatus.TOO_MANY_REQUESTS);
      }
      return;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }
      if (this.isProduction()) {
        this.logger.warn('Redis Admin login account limiter unavailable.');
        throw new ServiceUnavailableException('Admin login is temporarily unavailable');
      }
      this.logger.warn('Redis Admin login account limiter unavailable; using in-memory fallback.');
    }

    const now = Date.now();
    if (this.fallbackAdminLoginFailures.size >= ADMIN_LOGIN_ACCOUNT_FALLBACK_MAX_KEYS) {
      for (const [candidateKey, candidate] of this.fallbackAdminLoginFailures) {
        if (candidate.resetAt <= now) this.fallbackAdminLoginFailures.delete(candidateKey);
      }
      while (this.fallbackAdminLoginFailures.size >= ADMIN_LOGIN_ACCOUNT_FALLBACK_MAX_KEYS) {
        const oldestKey = this.fallbackAdminLoginFailures.keys().next().value as string | undefined;
        if (!oldestKey) break;
        this.fallbackAdminLoginFailures.delete(oldestKey);
      }
    }
    const current = this.fallbackAdminLoginFailures.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + ADMIN_LOGIN_ACCOUNT_FAILURE_WINDOW_MS };
    bucket.count += 1;
    this.fallbackAdminLoginFailures.set(key, bucket);
    if (bucket.count > ADMIN_LOGIN_ACCOUNT_MAX_FAILURES) {
      throw new HttpException('Too many admin login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async recordFailedOtpAttempt(phone: string) {
    try {
      return await this.redisState.incrementOtpAttempts(phone);
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis OTP attempt limiter unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP attempt limiter unavailable; using in-memory OTP attempts.');
      const count = (this.fallbackOtpAttempts.get(phone) ?? 0) + 1;
      this.fallbackOtpAttempts.set(phone, count);
      return count;
    }
  }

  private async getStoredOtp(phone: string) {
    try {
      const otp = await this.redisState.getOtp(phone);
      if (otp) {
        return otp;
      }
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis OTP lookup unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP lookup unavailable; checking in-memory OTP fallback.');
    }

    const fallback = this.fallbackOtps.get(phone);
    if (!fallback) {
      return null;
    }
    if (fallback.expiresAt < Date.now()) {
      this.fallbackOtps.delete(phone);
      return null;
    }
    return fallback.otp;
  }

  private async consumeOtp(phone: string) {
    this.fallbackOtps.delete(phone);
    this.fallbackOtpAttempts.delete(phone);
    try {
      await this.redisState.consumeOtp(phone);
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis OTP consume unavailable.');
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn('Redis OTP consume unavailable.');
    }
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isLocalOrTest() {
    return ['development', 'test'].includes(
      this.config.get<string>('NODE_ENV')?.trim().toLowerCase() ?? '',
    );
  }

  private positiveIntegerConfig(key: string, fallback: number) {
    const configured = Number(this.config.get<string>(key));
    return Number.isInteger(configured) && configured > 0 ? configured : fallback;
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private refreshSecret() {
    return jwtRefreshSecretFromConfig(this.config);
  }

  private verifyRefreshToken(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!payload.sub || payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    return payload;
  }

  private async consumeRefreshToken(
    refreshToken: string,
    expiresAtSeconds: number | undefined,
    familyId: string,
  ) {
    const tokenHash = refreshTokenHash(refreshToken);
    const ttlSeconds = refreshTokenTtlSeconds(expiresAtSeconds);
    const familyTtlSeconds = refreshFamilyTtlSeconds(ttlSeconds);
    this.pruneFallbackRefreshRevocations();
    if (
      this.fallbackRevokedRefreshTokens.has(tokenHash) ||
      this.fallbackRevokedRefreshTokens.has(`family:${familyId}`)
    ) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    try {
      if (await this.redisState.isRefreshFamilyRevoked(familyId)) {
        throw new UnauthorizedException('Refresh token family has been revoked');
      }
      if (!(await this.redisState.consumeRefreshToken(tokenHash, ttlSeconds))) {
        await this.redisState.revokeRefreshFamily(familyId, familyTtlSeconds);
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (this.isProduction()) {
        this.logger.warn('Redis refresh token lookup unavailable.');
        throw new ServiceUnavailableException('Authentication service is temporarily unavailable');
      }
      this.logger.warn('Redis refresh token consume unavailable; using in-memory revocation fallback.');
      this.fallbackRevokedRefreshTokens.set(tokenHash, Date.now() + ttlSeconds * 1000);
    }
  }

  private async revokeRefreshToken(
    refreshToken: string,
    expiresAtSeconds: number | undefined,
    familyId: string,
  ) {
    const tokenHash = refreshTokenHash(refreshToken);
    const ttlSeconds = refreshTokenTtlSeconds(expiresAtSeconds);
    const familyTtlSeconds = refreshFamilyTtlSeconds(ttlSeconds);
    try {
      await this.redisState.revokeRefreshSession(
        tokenHash,
        ttlSeconds,
        familyId,
        familyTtlSeconds,
      );
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis refresh token revocation unavailable.');
        throw new ServiceUnavailableException('Authentication service is temporarily unavailable');
      }
      this.logger.warn('Redis refresh token revocation unavailable; using in-memory revocation fallback.');
      this.fallbackRevokedRefreshTokens.set(tokenHash, Date.now() + ttlSeconds * 1000);
      this.fallbackRevokedRefreshTokens.set(
        `family:${familyId}`,
        Date.now() + familyTtlSeconds * 1000,
      );
    }
  }

  private pruneFallbackRefreshRevocations() {
    const now = Date.now();
    for (const [tokenHash, expiresAt] of this.fallbackRevokedRefreshTokens) {
      if (expiresAt <= now) {
        this.fallbackRevokedRefreshTokens.delete(tokenHash);
      }
    }
  }
}

function adminLoginAuditContext(context: AdminLoginRequestContext) {
  return {
    sourceIp: context.sourceIp?.trim().slice(0, ADMIN_LOGIN_AUDIT_VALUE_MAX_LENGTH) || null,
    userAgent: context.userAgent?.trim().slice(0, ADMIN_LOGIN_AUDIT_VALUE_MAX_LENGTH) || null,
  };
}

function refreshTokenHash(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

function refreshTokenTtlSeconds(expiresAtSeconds?: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(1, (expiresAtSeconds ?? nowSeconds + REFRESH_TOKEN_MAX_TTL_SECONDS) - nowSeconds);
}

function refreshFamilyTtlSeconds(tokenTtlSeconds: number) {
  return Math.max(tokenTtlSeconds, REFRESH_TOKEN_MAX_TTL_SECONDS);
}

function adminWebSessionTtlSeconds(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return ADMIN_WEB_SESSION_MAX_TTL_SECONDS;
  return Math.min(Math.floor(parsed), ADMIN_WEB_SESSION_MAX_TTL_SECONDS);
}

function generatedAdminOperatorPhone(email: string) {
  return `admin:${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
}
