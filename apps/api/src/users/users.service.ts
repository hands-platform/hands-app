import { BadRequestException, Injectable } from '@nestjs/common';
import { FilePurpose, FileUploadStatus, FileVisibility, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

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
          include: { verification: { include: { files: true } }, services: { include: { service: true } } },
        },
        fileAssets: {
          where: {
            visibility: FileVisibility.PUBLIC,
            uploadStatus: FileUploadStatus.UPLOADED,
            purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
          },
          orderBy: { createdAt: 'desc' },
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
    },
    ipAddress?: string,
  ) {
    if (!user?.id) {
      throw new BadRequestException('Authenticated user is required');
    }

    const role = input.role && user.roles.includes(input.role) ? input.role : user.roles[0];
    if (!role) {
      throw new BadRequestException('Authenticated user role is required');
    }

    const deviceId = input.deviceId?.trim();
    if (!deviceId) {
      throw new BadRequestException('deviceId is required');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const metadata = input.metadata as Prisma.InputJsonValue | undefined;

    return this.prisma.appSession.upsert({
      where: {
        userId_role_deviceId: {
          userId: user.id,
          role,
          deviceId,
        },
      },
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
  }
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
