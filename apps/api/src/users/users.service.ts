import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  AppUsageEventType,
  AppUsageOrigin,
  FilePurpose,
  FileUploadStatus,
  FileVisibility,
  Role,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  appUsageDailyAggregateBoundsUpdates,
  appUsageDailyAggregateUpsert,
} from '../app-usage/app-usage-daily-aggregate';
import { PrismaService } from '../prisma/prisma.service';
import { customerAppSessionMetadata } from './customer-marketing-attribution';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getMe(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        customerProfile: true,
        providerProfile: {
          include: {
            verification: { include: { files: true } },
            services: { include: { service: true } },
            workingHours: { orderBy: { weekday: 'asc' } },
          },
        },
        fileAssets: {
          where: {
            visibility: FileVisibility.PUBLIC,
            uploadStatus: FileUploadStatus.UPLOADED,
            purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 12,
        },
      },
    });
  }

  updateMe(userId: string | undefined, input: { fullName?: string; email?: string }) {
    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        email: input.email,
      },
    });
  }

  async recordAppSession(
    user: AuthenticatedUser | undefined,
    input: {
      role?: Role;
      deviceId?: string;
      platform?: string;
      appVersion?: string;
      deviceLanguage?: string;
      lastLoginAddress?: string;
      metadata?: Record<string, unknown>;
      eventType?: AppUsageEventType;
      clientEventId?: string;
    },
    ipAddress?: string,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Authenticated user is required');
    }

    if (user.roles.includes(Role.ADMIN) || user.roles.includes(Role.MASTER_ADMIN)) {
      throw new ForbiddenException('Admin operators cannot record mobile app sessions');
    }

    const mobileRoles = user.roles.filter(
      (role) => role === Role.CUSTOMER || role === Role.PROVIDER,
    );
    if (
      input.role &&
      ((input.role !== Role.CUSTOMER && input.role !== Role.PROVIDER) ||
        !user.roles.includes(input.role))
    ) {
      throw new ForbiddenException('Requested mobile app role is not authorized');
    }
    const role = input.role ?? mobileRoles[0];
    if (!role) {
      throw new ForbiddenException('Customer or Partner role is required');
    }

    const deviceId = input.deviceId?.trim();
    if (!deviceId) {
      throw new BadRequestException('deviceId is required');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const clientEventId = normalizeOptionalText(input.clientEventId);

    return this.prisma.$transaction(async (transaction) => {
      const sessionWhere = {
        userId_role_deviceId: {
          userId: user.id,
          role,
          deviceId,
        },
      } as const;
      const hasCustomerMarketingAttribution =
        role === Role.CUSTOMER &&
        input.metadata &&
        Object.prototype.hasOwnProperty.call(input.metadata, 'marketingAttribution');
      const existingSession = hasCustomerMarketingAttribution
        ? await transaction.appSession.findUnique({
            where: sessionWhere,
            select: { metadata: true },
          })
        : null;
      const metadata = role === Role.CUSTOMER
        ? customerAppSessionMetadata(existingSession?.metadata, input.metadata)
        : undefined;
      const session = await transaction.appSession.upsert({
        where: sessionWhere,
        update: {
          platform: normalizeOptionalText(input.platform),
          appVersion: normalizeOptionalText(input.appVersion),
          deviceLanguage: normalizeOptionalText(input.deviceLanguage),
          lastLoginAddress: normalizeOptionalText(input.lastLoginAddress),
          ipAddress: normalizeOptionalText(ipAddress),
          active: true,
          lastSeenAt: now,
          expiresAt,
          metadata,
        },
        create: {
          userId: user.id,
          role,
          deviceId,
          platform: normalizeOptionalText(input.platform),
          appVersion: normalizeOptionalText(input.appVersion),
          deviceLanguage: normalizeOptionalText(input.deviceLanguage),
          lastLoginAddress: normalizeOptionalText(input.lastLoginAddress),
          ipAddress: normalizeOptionalText(ipAddress),
          active: true,
          lastSeenAt: now,
          expiresAt,
          metadata,
        },
      });

      if (input.eventType) {
        const existingEvent = clientEventId
          ? await transaction.appUsageEvent.findUnique({
              where: { clientEventId },
              select: { eventType: true, userId: true },
            })
          : null;

        if (
          existingEvent &&
          (existingEvent.userId !== user.id || existingEvent.eventType !== input.eventType)
        ) {
          throw new BadRequestException('clientEventId is already assigned to another app event');
        }

        if (!existingEvent) {
          await transaction.appUsageEvent.create({
            data: {
              clientEventId,
              userId: user.id,
              role,
              eventType: input.eventType,
              origin: AppUsageOrigin.PRODUCTION,
              deviceId,
              occurredAt: now,
              metadata,
            },
            select: { id: true },
          });
          const aggregateInput = {
            eventType: input.eventType,
            occurredAt: now,
            origin: AppUsageOrigin.PRODUCTION,
            role,
            userId: user.id,
          };
          await transaction.appUsageDailyAggregate.upsert(appUsageDailyAggregateUpsert(aggregateInput));
          for (const boundsUpdate of appUsageDailyAggregateBoundsUpdates(aggregateInput)) {
            await transaction.appUsageDailyAggregate.updateMany(boundsUpdate);
          }
        }
      }

      return session;
    });
  }

  async updateCustomerMe(
    userId: string | undefined,
    input: { fullName?: string; email?: string; gender?: string; nationality?: string },
  ) {
    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.customerProfile.update({
        where: { userId },
        data: {
          gender: input.gender,
          nationality: nullableText(input.nationality),
        },
      });
      return transaction.user.update({
        where: { id: userId },
        data: {
          fullName: input.fullName,
          email: input.email,
        },
        include: { customerProfile: true },
      });
    });
  }
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function nullableText(value: string | undefined) {
  if (value === undefined) return undefined;
  return value.trim() || null;
}
