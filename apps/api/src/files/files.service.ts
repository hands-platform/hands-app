import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FilePurpose, FileUploadStatus, FileVisibility, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { S3PresignService } from './s3-presign.service';

type PresignInput = {
  contentType: string;
  visibility: FileVisibility;
  purpose: 'provider-verification' | 'provider-gallery' | 'chat-attachment' | 'profile-image';
  providerVerificationId?: string;
};

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']);
const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3PresignService,
  ) {}

  async createPresignedUpload(user: AuthenticatedUser, input: PresignInput) {
    const normalizedInput = { ...input, contentType: normalizeContentType(input.contentType) };
    const providerVerificationId = await this.resolveProviderVerificationId(user, normalizedInput);
    this.validateUploadRequest(user, { ...normalizedInput, providerVerificationId });

    const extension = extensionForContentType(normalizedInput.contentType);
    const key = `${normalizedInput.visibility.toLowerCase()}/${normalizedInput.purpose}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const bucket = this.s3.bucketForVisibility(normalizedInput.visibility);

    const file = await this.prisma.fileAsset.create({
      data: {
        key,
        contentType: normalizedInput.contentType,
        purpose: toFilePurpose(normalizedInput.purpose),
        visibility: normalizedInput.visibility,
        ownerUserId: user.id,
        providerVerificationId,
        url: normalizedInput.visibility === FileVisibility.PUBLIC ? this.s3.publicUrl(key) : null,
      },
    });
    const presignedPutUrl = this.s3.presign({ method: 'PUT', key, bucket, expiresInSeconds: 900 });

    return {
      file,
      upload: {
        method: 'PUT',
        url: presignedPutUrl ?? `/storage-upload-placeholder/${key}`,
        headers: {
          'content-type': normalizedInput.contentType,
        },
      },
      storageMode: this.s3.storageMode(),
      note: this.s3.configurationNote(),
    };
  }

  async createReadUrl(user: AuthenticatedUser, fileId: string) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      include: { providerVerification: { include: { providerProfile: true } } },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.visibility === FileVisibility.PUBLIC) {
      return {
        file,
        read: { method: 'GET', url: file.url ?? this.s3.publicUrl(file.key) },
        storageMode: 'public',
      };
    }

    const canRead =
      user.roles.includes(Role.ADMIN) ||
      (user.roles.includes(Role.PROVIDER) && file.providerVerification?.providerProfile.userId === user.id);
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const presignedGetUrl = this.s3.presign({
      method: 'GET',
      key: file.key,
      bucket: this.s3.bucketForVisibility(file.visibility),
      expiresInSeconds: 300,
    });
    return {
      file,
      read: { method: 'GET', url: presignedGetUrl ?? `/storage-read-placeholder/${file.key}` },
      storageMode: this.s3.storageMode(),
    };
  }

  async completeUpload(user: AuthenticatedUser, fileId: string, input: { sizeBytes?: number }) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      include: { providerVerification: { include: { providerProfile: true } } },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!this.canManageFile(user, file)) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const sizeBytes = Number(input.sizeBytes ?? 0);
    if (input.sizeBytes !== undefined && (!Number.isInteger(sizeBytes) || sizeBytes < 0)) {
      throw new BadRequestException('sizeBytes must be a non-negative integer');
    }
    if (input.sizeBytes !== undefined && sizeBytes > maxUploadSizeBytesForContentType(file.contentType)) {
      throw new BadRequestException('Uploaded file exceeds the allowed size for its type');
    }

    return this.prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        uploadStatus: FileUploadStatus.UPLOADED,
        uploadedAt: new Date(),
        sizeBytes: input.sizeBytes === undefined ? undefined : sizeBytes,
      },
    });
  }

  private async resolveProviderVerificationId(user: AuthenticatedUser, input: PresignInput) {
    if (input.purpose !== 'provider-verification') {
      return input.providerVerificationId;
    }
    if (input.providerVerificationId && user.roles.includes(Role.ADMIN)) {
      return input.providerVerificationId;
    }

    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: user.id },
      include: { verification: true },
    });
    if (!provider) {
      return input.providerVerificationId;
    }

    if (provider.verification) {
      return provider.verification.id;
    }

    const verification = await this.prisma.providerVerification.create({
      data: { providerProfileId: provider.id },
    });
    return verification.id;
  }

  private validateUploadRequest(user: AuthenticatedUser, input: PresignInput) {
    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(input.contentType)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and MP4 uploads are allowed in MVP');
    }

    if (input.purpose === 'provider-verification') {
      if (!user.roles.includes(Role.PROVIDER) && !user.roles.includes(Role.ADMIN)) {
        throw new BadRequestException('Partner verification uploads require partner or admin role');
      }
      if (input.visibility !== FileVisibility.PRIVATE) {
        throw new BadRequestException('Partner verification files must be private');
      }
      if (!input.providerVerificationId) {
        throw new BadRequestException('providerVerificationId is required for provider verification files');
      }
    }

    if (['provider-gallery', 'profile-image'].includes(input.purpose)) {
      if (!user.roles.includes(Role.PROVIDER) && !user.roles.includes(Role.ADMIN)) {
        throw new BadRequestException('Partner media uploads require partner or admin role');
      }
      if (input.visibility !== FileVisibility.PUBLIC) {
        throw new BadRequestException('Partner gallery and profile images must be public');
      }
    }

    if (input.purpose === 'chat-attachment') {
      if (input.visibility !== FileVisibility.PRIVATE) {
        throw new BadRequestException('Chat attachments must be private in the MVP');
      }
    }
  }

  private canManageFile(
    user: AuthenticatedUser,
    file: {
      ownerUserId: string | null;
      providerVerification?: { providerProfile: { userId: string } } | null;
    },
  ) {
    return (
      user.roles.includes(Role.ADMIN) ||
      file.ownerUserId === user.id ||
      (user.roles.includes(Role.PROVIDER) && file.providerVerification?.providerProfile.userId === user.id)
    );
  }
}

function normalizeContentType(contentType: string) {
  return contentType.trim().toLowerCase();
}

function toFilePurpose(purpose: PresignInput['purpose']) {
  if (purpose === 'provider-gallery') {
    return FilePurpose.PROVIDER_GALLERY;
  }
  if (purpose === 'chat-attachment') {
    return FilePurpose.CHAT_ATTACHMENT;
  }
  if (purpose === 'profile-image') {
    return FilePurpose.PROFILE_IMAGE;
  }
  return FilePurpose.PROVIDER_VERIFICATION;
}

function maxUploadSizeBytesForContentType(contentType: string) {
  return normalizeContentType(contentType) === 'video/mp4' ? VIDEO_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES;
}

function extensionForContentType(contentType: string) {
  if (contentType === 'image/png') {
    return '.png';
  }
  if (contentType === 'image/webp') {
    return '.webp';
  }
  if (contentType === 'video/mp4') {
    return '.mp4';
  }
  return '.jpg';
}
