import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { AuthTokenService } from './auth-token.service';
import { jwtRefreshSecretFromConfig } from './jwt-secrets';
import { OtpDeliveryService } from './otp-delivery.service';

type RefreshPayload = {
  activeRole?: Role;
  authProvider?: 'supabase';
  role?: Role;
  sub?: string;
  tokenType?: string;
};

const MOBILE_EXCHANGE_ROLES = [Role.CUSTOMER, Role.PROVIDER] as const;
type MobileExchangeRole = (typeof MOBILE_EXCHANGE_ROLES)[number];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly fallbackOtps = new Map<string, { otp: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redisState: RedisStateService,
    private readonly otpDelivery: OtpDeliveryService,
    private readonly authTokens: AuthTokenService,
  ) {}

  async requestOtp(input: { phone: string; role?: Role }) {
    const isProduction = this.isProduction();
    const otp = isProduction ? this.generateOtp() : this.devOtp();
    await this.storeOtp(input.phone, otp);
    const delivery = await this.otpDelivery.deliverOtp(input.phone, otp);

    return {
      phone: input.phone,
      role: input.role ?? Role.CUSTOMER,
      status: 'OTP_REQUESTED',
      delivery,
      ...(isProduction ? {} : { devOtp: otp }),
    };
  }

  async verifyOtp(input: { phone: string; otp: string; role?: Role }) {
    await this.assertValidOtp(input.phone, input.otp);
    const role = input.role ?? Role.CUSTOMER;
    const existing = await this.prisma.user.findUnique({
      where: { phone: input.phone },
      include: { customerProfile: true, providerProfile: true },
    });

    const roles = Array.from(new Set([...(existing?.roles ?? []), role]));
    const user = await this.prisma.user.upsert({
      where: { phone: input.phone },
      update: {
        roles: { set: roles },
        customerProfile: role === Role.CUSTOMER && !existing?.customerProfile ? { create: {} } : undefined,
        providerProfile:
          role === Role.PROVIDER && !existing?.providerProfile
            ? {
                create: {
                  displayName: `Partner ${input.phone.slice(-4)}`,
                  verification: { create: {} },
                },
              }
            : undefined,
      },
      create: {
        phone: input.phone,
        roles: [role],
        customerProfile: role === Role.CUSTOMER ? { create: {} } : undefined,
        providerProfile:
          role === Role.PROVIDER
            ? {
                create: {
                  displayName: `Partner ${input.phone.slice(-4)}`,
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
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Refresh token subject no longer exists');
    }

    const activeRole = this.resolveRefreshActiveRole(payload, user.roles);

    return {
      refreshToken,
      accessToken: this.jwt.sign({
        sub: user.id,
        roles: user.roles,
        refreshed: true,
        ...(activeRole ? { activeRole } : {}),
        ...(payload.authProvider ? { authProvider: payload.authProvider } : {}),
      }),
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

  private signSessionTokens(
    user: { id: string; roles: Role[] },
    activeRole: Role,
    extraPayload: { authProvider?: 'supabase' } = {},
  ) {
    const sessionPayload = { sub: user.id, activeRole, roles: user.roles, ...extraPayload };

    return {
      accessToken: this.jwt.sign(sessionPayload),
      refreshToken: this.jwt.sign(
        { sub: user.id, tokenType: 'refresh', activeRole, ...extraPayload },
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
    } catch (error) {
      if (this.isProduction()) {
        this.logger.warn(`Redis OTP store unavailable. ${(error as Error).message}`);
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn(
        `Redis OTP store unavailable; using in-memory OTP fallback. ${(error as Error).message}`,
      );
      this.fallbackOtps.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    }
  }

  private async getStoredOtp(phone: string) {
    try {
      const otp = await this.redisState.getOtp(phone);
      if (otp) {
        return otp;
      }
    } catch (error) {
      if (this.isProduction()) {
        this.logger.warn(`Redis OTP lookup unavailable. ${(error as Error).message}`);
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn(
        `Redis OTP lookup unavailable; checking in-memory OTP fallback. ${(error as Error).message}`,
      );
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
    } catch (error) {
      if (this.isProduction()) {
        this.logger.warn(`Redis OTP consume unavailable. ${(error as Error).message}`);
        throw new ServiceUnavailableException('OTP service is temporarily unavailable');
      }
      this.logger.warn(`Redis OTP consume unavailable. ${(error as Error).message}`);
    }
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private devOtp() {
    return this.config.get<string>('DEV_OTP') ?? '123456';
  }

  private refreshSecret() {
    return jwtRefreshSecretFromConfig(this.config);
  }
}
