import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  Prisma,
  Role,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { S3PresignService } from './s3-presign.service';

type PresignInput = {
  contentType: string;
  sizeBytes: number;
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
const VIDEO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

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

    if (normalizedInput.sizeBytes > maxUploadSizeBytesForContentType(normalizedInput.contentType)) {
      throw new BadRequestException('Uploaded file exceeds the allowed size for its type');
    }
    const extension = extensionForContentType(normalizedInput.contentType);
    const purpose = toFilePurpose(normalizedInput.purpose);
    const storageVisibility = isPublicMediaPurpose(purpose)
      ? FileVisibility.PRIVATE
      : normalizedInput.visibility;
    const key = `${storageVisibility.toLowerCase()}/${normalizedInput.purpose}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const bucket = this.s3.bucketForVisibility(storageVisibility);

    const file = await this.prisma.fileAsset.create({
      data: {
        key,
        contentType: normalizedInput.contentType,
        originalName: normalizeOriginalFileName(normalizedInput.fileName),
        purpose,
        visibility: normalizedInput.visibility,
        ownerUserId,
        providerVerificationId,
        sizeBytes: normalizedInput.sizeBytes,
        url: null,
      },
    });
    const presignedPutUrl = this.s3.presign({
      method: 'PUT',
      key,
      bucket,
      expiresInSeconds: 900,
      headers: {
        'content-length': String(normalizedInput.sizeBytes),
        'content-type': normalizedInput.contentType,
      },
    });

    return {
      file,
      upload: {
        method: 'PUT',
        url: presignedPutUrl ?? `/storage-upload-placeholder/${key}`,
        headers: {
          'content-length': String(normalizedInput.sizeBytes),
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

    if (
      file.visibility === FileVisibility.PUBLIC &&
      file.reviewStatus === FileReviewStatus.APPROVED
    ) {
      return {
        file: publicFileReadProjection(file),
        read: { method: 'GET', url: file.url ?? this.s3.publicUrl(file.key) },
        storageMode: 'public',
      };
    }

    if (
      file.visibility === FileVisibility.PUBLIC &&
      isPublicMediaPurpose(file.purpose) &&
      storageVisibilityForFile(file) === FileVisibility.PUBLIC
    ) {
      throw new ForbiddenException('Legacy public media must be reviewed before access');
    }

    const canRead =
      (await this.canManageFile(user, file)) ||
      (file.purpose === FilePurpose.CHAT_ATTACHMENT && (await this.canReadChatAttachment(user, file.id)));
    if (!canRead) {
      throw new ForbiddenException('You do not have access to this file');
    }
    this.assertStorageAvailable();

    const presignedGetUrl = this.s3.presign({
      method: 'GET',
      key: file.key,
      bucket: this.s3.bucketForVisibility(storageVisibilityForFile(file)),
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

    if (!(await this.canManageFile(user, file))) {
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
      const storageVisibility = storageVisibilityForFile(file);
      const inspection = await this.s3.inspectObject(file.key, storageVisibility);
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
      if (file.sizeBytes !== null && file.sizeBytes !== undefined && file.sizeBytes !== inspection.sizeBytes) {
        throw new BadRequestException('Uploaded object size does not match the presigned upload request');
      }
      if (!hasExpectedFileSignature(expectedContentType, inspection.prefix)) {
        throw new BadRequestException('Uploaded object content does not match its declared file type');
      }
      const scan = await this.s3.scanObject(file.key, storageVisibility);
      if (!scan.clean) {
        await this.s3.deleteObject(file.key, storageVisibility);
        await this.prisma.fileAsset.update({
          where: { id: fileId },
          data: { uploadStatus: FileUploadStatus.FAILED },
        });
        throw new BadRequestException('Uploaded file failed the malware safety scan');
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
    if (!(await this.canManageFile(user, file))) {
      throw new ForbiddenException('You do not have access to this file');
    }
    this.assertStorageAvailable();

    await this.s3.deleteObject(file.key, storageVisibilityForFile(file));
    await this.prisma.fileAsset.delete({ where: { id: fileId } });
    return { ok: true, fileId };
  }

  async approvePublicMedia(fileId: string, reviewerId: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.visibility !== FileVisibility.PUBLIC || !isPublicMediaPurpose(file.purpose)) {
      throw new BadRequestException('Only public Partner media can be approved');
    }
    if (file.uploadStatus !== FileUploadStatus.UPLOADED) {
      throw new BadRequestException('Only completed uploads can be approved');
    }
    if (file.reviewStatus === FileReviewStatus.APPROVED) {
      return file;
    }
    this.assertStorageAvailable();

    const sourceVisibility = storageVisibilityForFile(file);
    const needsPromotion =
      this.s3.isConfigured() && sourceVisibility === FileVisibility.PRIVATE;
    if (needsPromotion) {
      await this.s3.copyObject(file.key, sourceVisibility, FileVisibility.PUBLIC);
    }
    const approved = await this.prisma.fileAsset.update({
        where: { id: fileId },
        data: {
          reviewStatus: FileReviewStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewReason: null,
          url: this.s3.publicUrl(file.key),
        },
      }).catch(async (error) => {
        if (needsPromotion) {
          await this.s3.deleteObject(file.key, FileVisibility.PUBLIC).catch(() => undefined);
        }
        throw error;
      });
    if (needsPromotion) {
      await this.s3.deleteObject(file.key, sourceVisibility).catch((error) => {
        this.logger.warn(
          `Approved Partner media quarantine cleanup failed for file ${fileId}: ${
            error instanceof Error ? error.message : 'unknown storage error'
          }`,
        );
      });
    }
    return approved;
  }

  async rejectPublicMedia(fileId: string, reviewerId: string, reason: string) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.visibility !== FileVisibility.PUBLIC || !isPublicMediaPurpose(file.purpose)) {
      throw new BadRequestException('Only public Partner media can be rejected');
    }
    this.assertStorageAvailable();

    const sourceVisibility = storageVisibilityForFile(file);
    const needsQuarantine =
      this.s3.isConfigured() && sourceVisibility === FileVisibility.PUBLIC;
    const quarantineKey = needsQuarantine ? privateQuarantineKey(file.key) : file.key;
    if (needsQuarantine) {
      await this.s3.copyObject(
        file.key,
        sourceVisibility,
        FileVisibility.PRIVATE,
        quarantineKey,
      );
      await this.s3.deleteObject(file.key, sourceVisibility);
    }
    try {
      return await this.prisma.fileAsset.update({
        where: { id: fileId },
        data: {
          reviewStatus: FileReviewStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewReason: reason,
          url: null,
          ...(quarantineKey !== file.key ? { key: quarantineKey } : {}),
        },
      });
    } catch (error) {
      if (needsQuarantine) {
        await this.s3.copyObject(
          quarantineKey,
          FileVisibility.PRIVATE,
          FileVisibility.PUBLIC,
          file.key,
        )
          .then(() => this.s3.deleteObject(quarantineKey, FileVisibility.PRIVATE))
          .catch(() => undefined);
      }
      throw error;
    }
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
      if (user.roles.includes(Role.ADMIN)) {
        this.assertAdminFilePurposePermission(user, FilePurpose.PROVIDER_VERIFICATION);
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
      if (user.roles.includes(Role.ADMIN)) {
        this.assertAdminFilePurposePermission(
          user,
          input.purpose === 'provider-gallery' ? FilePurpose.PROVIDER_GALLERY : FilePurpose.PROFILE_IMAGE,
        );
      }
      if (input.visibility !== FileVisibility.PUBLIC) {
        throw new BadRequestException('Partner gallery and profile images must be public');
      }
    }

    if (input.purpose === 'chat-attachment') {
      if (user.roles.includes(Role.ADMIN)) {
        this.assertAdminFilePurposePermission(user, FilePurpose.CHAT_ATTACHMENT);
      }
      if (input.visibility !== FileVisibility.PRIVATE) {
        throw new BadRequestException('Chat attachments must be private in the MVP');
      }
    }

    if (input.purpose === 'finance-evidence') {
      if (!user.roles.includes(Role.ADMIN)) {
        throw new BadRequestException('Finance evidence uploads require admin role');
      }
      this.assertAdminFilePurposePermission(user, FilePurpose.FINANCE_EVIDENCE);
      if (input.visibility !== FileVisibility.PRIVATE) {
        throw new BadRequestException('Finance evidence files must be private');
      }
    }
  }

  private async canManageFile(
    user: AuthenticatedUser,
    file: {
      id: string;
      ownerUserId: string | null;
      purpose: FilePurpose;
      providerVerification?: { providerProfile: { userId: string } } | null;
    },
  ) {
    if (user.roles.includes(Role.ADMIN)) {
      if (!hasAdminFilePurposePermission(user, file.purpose)) return false;
      if (file.purpose === FilePurpose.PROVIDER_VERIFICATION) {
        return Boolean(file.providerVerification);
      }
      if (file.purpose === FilePurpose.CHAT_ATTACHMENT) {
        return this.isAttachedChatFile(file.id);
      }
      return true;
    }
    return file.ownerUserId === user.id ||
      (user.roles.includes(Role.PROVIDER) && file.providerVerification?.providerProfile.userId === user.id);
  }

  private assertAdminFilePurposePermission(user: AuthenticatedUser, purpose: FilePurpose) {
    if (!hasAdminFilePurposePermission(user, purpose)) {
      throw new ForbiddenException('Admin permission does not allow this file operation');
    }
  }

  private async isAttachedChatFile(fileId: string) {
    const message = await this.prisma.chatMessage.findFirst({
      where: { attachments: { array_contains: [{ id: fileId }] } },
      select: { id: true },
    });
    return Boolean(message);
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

const ADMIN_FILE_PURPOSE_CATEGORIES: Record<
  FilePurpose,
  readonly AdminOperatorPermissionCategory[]
> = {
  [FilePurpose.PROVIDER_VERIFICATION]: [
    AdminOperatorPermissionCategory.PARTNERS_KYC,
    AdminOperatorPermissionCategory.PARTNERS,
  ],
  [FilePurpose.PROVIDER_GALLERY]: [
    AdminOperatorPermissionCategory.PARTNERS_DETAIL,
    AdminOperatorPermissionCategory.PARTNERS,
  ],
  [FilePurpose.PROFILE_IMAGE]: [
    AdminOperatorPermissionCategory.PARTNERS_DETAIL,
    AdminOperatorPermissionCategory.PARTNERS,
  ],
  [FilePurpose.CHAT_ATTACHMENT]: [
    AdminOperatorPermissionCategory.BOOKINGS_DETAIL,
    AdminOperatorPermissionCategory.BOOKINGS,
  ],
  [FilePurpose.FINANCE_EVIDENCE]: [
    AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
    AdminOperatorPermissionCategory.FINANCE,
  ],
};

function hasAdminFilePurposePermission(user: AuthenticatedUser, purpose: FilePurpose) {
  if (user.roles.includes(Role.MASTER_ADMIN)) return true;
  const categories = user.adminPermissionCategories ?? [];
  return ADMIN_FILE_PURPOSE_CATEGORIES[purpose].some((category) => categories.includes(category));
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

function isPublicMediaPurpose(purpose: FilePurpose) {
  return purpose === FilePurpose.PROFILE_IMAGE || purpose === FilePurpose.PROVIDER_GALLERY;
}

function storageVisibilityForFile(file: {
  key: string;
  purpose: FilePurpose;
  reviewStatus?: FileReviewStatus | null;
  visibility: FileVisibility;
}) {
  if (file.visibility === FileVisibility.PUBLIC && isPublicMediaPurpose(file.purpose)) {
    if (file.reviewStatus === FileReviewStatus.APPROVED) {
      return FileVisibility.PUBLIC;
    }
    return file.key.startsWith('private/')
      ? FileVisibility.PRIVATE
      : FileVisibility.PUBLIC;
  }
  return file.visibility;
}

function privateQuarantineKey(key: string) {
  if (key.startsWith('private/')) return key;
  return key.startsWith('public/') ? `private/${key.slice('public/'.length)}` : `private/${key}`;
}

function publicFileReadProjection(file: {
  contentType?: string | null;
  id: string;
  purpose: FilePurpose;
  reviewStatus?: FileReviewStatus | null;
  reviewedAt?: Date | null;
  sizeBytes?: number | null;
  visibility: FileVisibility;
}) {
  return {
    id: file.id,
    contentType: file.contentType ?? null,
    purpose: file.purpose,
    reviewStatus: file.reviewStatus ?? null,
    reviewedAt: file.reviewedAt ?? null,
    sizeBytes: file.sizeBytes ?? null,
    visibility: file.visibility,
  };
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
