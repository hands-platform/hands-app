import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GetMobileAppVersionDto,
  RegisterMobileDeviceDto,
  UnregisterMobileDeviceDto,
} from './mobile.dto';

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  registerDevice(user: AuthenticatedUser, input: RegisterMobileDeviceDto) {
    return this.notifications.registerDeviceToken(user, {
      token: input.token,
      platform: input.platform.toLowerCase(),
      pushProvider: input.pushProvider ?? 'FCM',
      appVersion: normalizeOptionalText(input.appVersion),
      osVersion: normalizeOptionalText(input.osVersion),
      deviceModel: normalizeOptionalText(input.deviceModel),
      locale: normalizeOptionalText(input.locale),
      timezone: normalizeOptionalText(input.timezone),
    });
  }

  unregisterDevice(user: AuthenticatedUser, input: UnregisterMobileDeviceDto) {
    return this.notifications.disableDeviceToken(user, { token: input.token });
  }

  async getAppVersion(input: GetMobileAppVersionDto) {
    const policy = await this.prisma.appVersionPolicy.findUnique({
      where: {
        appType_platform: {
          appType: input.appType,
          platform: input.platform,
        },
      },
    });

    if (!policy?.isActive) {
      return defaultAppVersionPolicy(input);
    }

    return {
      appType: policy.appType,
      platform: policy.platform,
      minimumSupportedVersion: policy.minimumSupportedVersion,
      latestVersion: policy.latestVersion,
      forceUpdate: policy.forceUpdate,
      updateUrl: policy.updateUrl,
      releaseNotes: policy.releaseNotes,
      source: 'DATABASE' as const,
    };
  }
}

function defaultAppVersionPolicy(input: GetMobileAppVersionDto) {
  return {
    appType: input.appType,
    platform: input.platform,
    minimumSupportedVersion: null,
    latestVersion: null,
    forceUpdate: false,
    updateUrl: null,
    releaseNotes: null,
    source: 'DEFAULT' as const,
  };
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
