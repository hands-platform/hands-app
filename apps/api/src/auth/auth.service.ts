import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { AuthTokenService } from './auth-token.service';
import { verifyAdminOperatorPassword } from './admin-operator-credential';
import { jwtRefreshSecretFromConfig } from './jwt-secrets';
import { OtpDeliveryService } from './otp-delivery.service';
import { normalizeVietnamPhoneIdentifier } from './phone-number';

type RefreshPayload = {
  activeRole?: Role;
  authProvider?: 'supabase';
  role?: Role;
  sub?: string;
  tokenType?: string;
  exp?: number;
};

const MOBILE_EXCHANGE_ROLES = [Role.CUSTOMER, Role.PROVIDER] as const;
type MobileExchangeRole = (typeof MOBILE_EXCHANGE_ROLES)[number];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly fallbackOtps = new Map<string, { otp: string; expiresAt: number }>();
  private readonly fallbackRevokedRefreshTokens = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redisState: RedisStateService,
    private readonly otpDelivery: OtpDeliveryService,
    private readonly authTokens: AuthTokenService,
  ) {}

  async requestOtp(input: { phone: string; role?: Role }) {
    const role = this.assertMobileAuthRole(input.role ?? Role.CUSTOMER);
    const phone = normalizeVietnamPhoneIdentifier(input.phone);
    const isProduction = this.isProduction();
    const otp = isProduction ? this.generateOtp() : this.devOtp();
    await this.storeOtp(phone, otp);
    const delivery = await this.otpDelivery.deliverOtp(phone, otp);

    return {
      phone,
      role,
      status: 'OTP_REQUESTED',
      delivery,
      ...(isProduction ? {} : { devOtp: otp }),
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

    const { accessToken, refreshToken } = this.signSessionTokens(user, role);

    return {
      user,
      otpAccepted: true,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.consumeRefreshToken(refreshToken, payload.exp);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Refresh token subject no longer exists');
    }

    const activeRole = this.resolveRefreshActiveRole(payload, user.roles);

    const session = this.signSessionTokens(user, activeRole, {
      authProvider: payload.authProvider,
      refreshed: true,
    });
    return session;
  }

  async logout(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.revokeRefreshToken(refreshToken, payload.exp);
    return { ok: true };
  }

  async verifyAdminOperatorLogin(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    const credential = await this.prisma.adminOperatorCredential.findUnique({
      where: { email },
      select: {
        passwordHash: true,
        passwordSalt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roles: true,
          },
        },
      },
    });
    if (!credential?.user.roles.includes(Role.ADMIN) || !verifyAdminOperatorPassword(input.password, credential)) {
      throw new UnauthorizedException('Invalid admin operator credentials');
    }

    return {
      authenticated: true,
      user: credential.user,
    };
  }

  async exchangeSupabaseSession(input: { supabaseAccessToken: string; role?: Role }) {
    const role = this.assertExchangeRole(input.role ?? Role.CUSTOMER);
    const authenticated = await this.authTokens.authenticateSupabaseBearerToken(input.supabaseAccessToken, [
      role,
    ]);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: authenticated.id },
      include: { customerProfile: true, providerProfile: true },
    });

    const { accessToken, refreshToken } = this.signSessionTokens(user, role, {
      authProvider: 'supabase',
    });

    return {
      user,
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

  private signSessionTokens(
    user: { id: string; roles: Role[] },
    activeRole: Role | undefined,
    extraPayload: { authProvider?: 'supabase'; refreshed?: boolean } = {},
  ) {
    const sessionPayload = {
      sub: user.id,
      roles: user.roles,
      ...(activeRole ? { activeRole } : {}),
      ...extraPayload,
    };

    return {
      accessToken: this.jwt.sign(sessionPayload),
      refreshToken: this.jwt.sign(
        {
          sub: user.id,
          tokenType: 'refresh',
          jti: randomUUID(),
          ...(activeRole ? { activeRole } : {}),
          ...(extraPayload.authProvider ? { authProvider: extraPayload.authProvider } : {}),
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
    const storedOtp = await this.getStoredOtp(phone);
    const isProduction = this.isProduction();
    const devFallbackAllowed = !isProduction && otp === this.devOtp();

    if (storedOtp ? otp !== storedOtp : !devFallbackAllowed) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.consumeOtp(phone);
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

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private devOtp() {
    return this.config.get<string>('DEV_OTP') ?? '123456';
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

  private async consumeRefreshToken(refreshToken: string, expiresAtSeconds?: number) {
    const tokenHash = refreshTokenHash(refreshToken);
    const ttlSeconds = refreshTokenTtlSeconds(expiresAtSeconds);
    this.pruneFallbackRefreshRevocations();
    if (this.fallbackRevokedRefreshTokens.has(tokenHash)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    try {
      if (!(await this.redisState.consumeRefreshToken(tokenHash, ttlSeconds))) {
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

  private async revokeRefreshToken(refreshToken: string, expiresAtSeconds?: number) {
    const tokenHash = refreshTokenHash(refreshToken);
    const ttlSeconds = refreshTokenTtlSeconds(expiresAtSeconds);
    try {
      await this.redisState.revokeRefreshToken(tokenHash, ttlSeconds);
    } catch {
      if (this.isProduction()) {
        this.logger.warn('Redis refresh token revocation unavailable.');
        throw new ServiceUnavailableException('Authentication service is temporarily unavailable');
      }
      this.logger.warn('Redis refresh token revocation unavailable; using in-memory revocation fallback.');
      this.fallbackRevokedRefreshTokens.set(tokenHash, Date.now() + ttlSeconds * 1000);
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

function refreshTokenHash(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

function refreshTokenTtlSeconds(expiresAtSeconds?: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(1, (expiresAtSeconds ?? nowSeconds + 30 * 24 * 60 * 60) - nowSeconds);
}
