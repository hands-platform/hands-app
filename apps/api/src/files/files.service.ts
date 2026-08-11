import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FilePurpose, FileUploadStatus, FileVisibility, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { S3PresignService } from './s3-presign.service';

type PresignInput = {
  contentType: string;
  visibility: FileVisibility;
  purpose:
    | 'provider-verification'
    | 'provider-gallery'
    | 'chat-attachment'
    | 'profile-image'
    | 'finance-evidence';
  fileName?: string;
  providerVerificationId?: string;
};

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]);
const IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3PresignService,
  ) {}

  async createPresignedUpload(user: AuthenticatedUser, input: PresignInput) {
    return this.createPresignedUploadForOwner(user, user.id, input);
  }

  async createPresignedUploadForOwner(user: AuthenticatedUser, ownerUserId: string, input: PresignInput) {
    if (ownerUserId !== user.id && !user.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Only admins can upload files for another user');
    }
    const normalizedInput = { ...input, contentType: normalizeContentType(input.contentType) };
    const providerVerificationId = await this.resolveProviderVerificationId(user, normalizedInput);
    this.validateUploadRequest(user, { ...normalizedInput, providerVerificationId });
    this.assertStorageAvailable();

    const extension = extensionForContentType(normalizedInput.contentType);
    const key = `${normalizedInput.visibility.toLowerCase()}/${normalizedInput.purpose}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const bucket = this.s3.bucketForVisibility(normalizedInput.visibility);

    const file = await this.prisma.fileAsset.create({
      data: {
        key,
        contentType: normalizedInput.contentType,
        originalName: normalizeOriginalFileName(normalizedInput.fileName),
        purpose: toFilePurpose(normalizedInput.purpose),
        visibility: normalizedInput.visibility,
        ownerUserId,
        providerVerificationId,
        url: normalizedInput.visibility === FileVisibility.PUBLIC ? this.s3.publicUrl(key) : null,
      },
    });
    const presignedPutUrl = this.s3.presign({
      method: 'PUT',
      key,
      bucket,
      expiresInSeconds: 900,
      headers: { 'content-type': normalizedInput.contentType },
    });

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
      this.canManageFile(user, file) ||
      (file.purpose === FilePurpose.CHAT_ATTACHMENT && (await this.canReadChatAttachment(user, file.id)));
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this file');
    }
    this.assertStorageAvailable();

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
    this.assertStorageAvailable();

    const claimedSizeBytes = Number(input.sizeBytes ?? 0);
    if (input.sizeBytes !== undefined && (!Number.isSafeInteger(claimedSizeBytes) || claimedSizeBytes < 0)) {
      throw new BadRequestException('sizeBytes must be a non-negative integer');
    }
    if (
      input.sizeBytes !== undefined &&
      claimedSizeBytes > maxUploadSizeBytesForContentType(file.contentType)
    ) {
      throw new BadRequestException('Uploaded file exceeds the allowed size for its type');
    }

    let verifiedSizeBytes = input.sizeBytes === undefined ? undefined : claimedSizeBytes;
    if (this.s3.isConfigured()) {
      const inspection = await this.s3.inspectObject(file.key, file.visibility);
      if (!inspection) {
        throw new BadRequestException('Uploaded object was not found in storage');
      }
      const expectedContentType = normalizeContentType(file.contentType);
      if (normalizeContentType(inspection.contentType) !== expectedContentType) {
        throw new BadRequestException('Uploaded object content type does not match the upload request');
      }
      if (inspection.sizeBytes > maxUploadSizeBytesForContentType(expectedContentType)) {
        throw new BadRequestException('Uploaded file exceeds the allowed size for its type');
      }
      if (input.sizeBytes !== undefined && claimedSizeBytes !== inspection.sizeBytes) {
        throw new BadRequestException('Uploaded object size does not match the completion request');
      }
      if (!hasExpectedFileSignature(expectedContentType, inspection.prefix)) {
        throw new BadRequestException('Uploaded object content does not match its declared file type');
      }
      verifiedSizeBytes = inspection.sizeBytes;
    }

    return this.prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        uploadStatus: FileUploadStatus.UPLOADED,
        uploadedAt: new Date(),
        sizeBytes: verifiedSizeBytes,
      },
    });
  }

  async deleteFile(user: AuthenticatedUser, fileId: string) {
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
    this.assertStorageAvailable();

    await this.s3.deleteObject(file.key, file.visibility);
    await this.prisma.fileAsset.delete({ where: { id: fileId } });
    return { ok: true, fileId };
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

    if (input.purpose === 'finance-evidence') {
      if (!user.roles.includes(Role.ADMIN)) {
        throw new BadRequestException('Finance evidence uploads require admin role');
      }
      if (input.visibility !== FileVisibility.PRIVATE) {
        throw new BadRequestException('Finance evidence files must be private');
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

  private async canReadChatAttachment(user: AuthenticatedUser, fileId: string) {
    const bookingScopes: Prisma.BookingWhereInput[] = [];
    if (user.roles.includes(Role.CUSTOMER)) {
      const customer = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (customer) {
        bookingScopes.push({ customerProfileId: customer.id });
      }
    }
    if (user.roles.includes(Role.PROVIDER)) {
      const provider = await this.prisma.providerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (provider) {
        bookingScopes.push({ selectedProviderId: provider.id });
      }
    }
    if (bookingScopes.length === 0) {
      return false;
    }

    const message = await this.prisma.chatMessage.findFirst({
      where: {
        attachments: { array_contains: [{ id: fileId }] },
        chatRoom: { booking: { OR: bookingScopes } },
      },
      select: { id: true },
    });
    return Boolean(message);
  }

  private assertStorageAvailable() {
    if (!this.s3.isConfigured() && !this.s3.allowsPlaceholderStorage()) {
      throw new ServiceUnavailableException('File storage is not configured for this environment');
    }
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
  if (purpose === 'finance-evidence') {
    return FilePurpose.FINANCE_EVIDENCE;
  }
  return FilePurpose.PROVIDER_VERIFICATION;
}

function maxUploadSizeBytesForContentType(contentType: string) {
  return normalizeContentType(contentType) === 'video/mp4' ? VIDEO_UPLOAD_MAX_BYTES : IMAGE_UPLOAD_MAX_BYTES;
}

function normalizeOriginalFileName(value?: string) {
  const normalized = value?.trim().replace(/[\\/]/gu, '-').slice(0, 255);
  return normalized || null;
}

function extensionForContentType(contentType: string) {
  if (contentType === 'application/pdf') {
    return '.pdf';
  }
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

function hasExpectedFileSignature(contentType: string, prefix: Uint8Array) {
  if (contentType === 'application/pdf') {
    return matchesAscii(prefix, 0, '%PDF-');
  }
  if (contentType === 'image/jpeg') {
    return matchesBytes(prefix, 0, [0xff, 0xd8, 0xff]);
  }
  if (contentType === 'image/png') {
    return matchesBytes(prefix, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === 'image/webp') {
    return matchesAscii(prefix, 0, 'RIFF') && matchesAscii(prefix, 8, 'WEBP');
  }
  if (contentType === 'video/mp4') {
    return matchesAscii(prefix, 4, 'ftyp');
  }
  return false;
}

function matchesAscii(value: Uint8Array, offset: number, expected: string) {
  return matchesBytes(
    value,
    offset,
    [...expected].map((character) => character.charCodeAt(0)),
  );
}

function matchesBytes(value: Uint8Array, offset: number, expected: number[]) {
  return expected.every((byte, index) => value[offset + index] === byte);
}
