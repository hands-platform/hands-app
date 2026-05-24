import { BadRequestException, Injectable } from '@nestjs/common';
import { FilePurpose, FileUploadStatus, FileVisibility } from '@prisma/client';
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
}
