import {
  AdminOperatorPermissionCategory,
  FilePurpose,
  FileUploadStatus,
  FileVisibility,
  Role,
} from '@prisma/client';

import { FilesService } from './files.service';

describe('FilesService upload security', () => {
  const providerUser = { id: 'provider-user-1', roles: [Role.PROVIDER] };

  function createService() {
    const prisma = {
      fileAsset: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'file-1', ...data })),
        delete: vi.fn().mockResolvedValue({ id: 'file-1' }),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'file-1', ...data })),
      },
      providerProfile: {
        findUnique: vi.fn(),
      },
      customerProfile: {
        findUnique: vi.fn(),
      },
      chatMessage: {
        findFirst: vi.fn(),
      },
    };
    const s3 = {
      bucketForVisibility: vi.fn((visibility: FileVisibility) =>
        visibility === FileVisibility.PUBLIC ? 'hands-public' : 'hands-private'),
      configurationNote: vi.fn().mockReturnValue('Upload with PUT before the presigned URL expires.'),
      copyObject: vi.fn().mockResolvedValue({ copied: true }),
      deleteObject: vi.fn().mockResolvedValue({ deleted: true }),
      inspectObject: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(false),
      allowsPlaceholderStorage: vi.fn().mockReturnValue(true),
      presign: vi.fn().mockReturnValue('https://storage.example/upload'),
      publicUrl: vi.fn().mockImplementation((key: string) => `https://cdn.example/${key}`),
      scanObject: vi.fn().mockResolvedValue({ clean: true, mode: 'external-scanner' }),
      storageMode: vi.fn().mockReturnValue('s3-compatible-presigned'),
    };
    return { prisma, s3, service: new FilesService(prisma as never, s3 as never) };
  }

  it('rejects browser-executable SVG uploads before creating file records', async () => {
    const { prisma, service } = createService();

    await expect(
      service.createPresignedUpload(providerUser, {
        contentType: 'image/svg+xml',
        purpose: 'profile-image',
        sizeBytes: 1024,
        visibility: FileVisibility.PUBLIC,
      }),
    ).rejects.toThrow('Only JPEG, PNG, WebP, and MP4 uploads are allowed in MVP');

    expect(prisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('normalizes allowed content types before creating presigned uploads', async () => {
    const { prisma, s3, service } = createService();

    await expect(
      service.createPresignedUpload(providerUser, {
        contentType: ' Image/JPEG ',
        purpose: 'profile-image',
        sizeBytes: 1024,
        visibility: FileVisibility.PUBLIC,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        upload: expect.objectContaining({
          headers: { 'content-length': '1024', 'content-type': 'image/jpeg' },
        }),
      }),
    );

    expect(prisma.fileAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: 'image/jpeg',
        key: expect.stringMatching(/^private\/profile-image\//u),
        purpose: 'PROFILE_IMAGE',
        sizeBytes: 1024,
        url: null,
        visibility: FileVisibility.PUBLIC,
      }),
    });
    expect(s3.presign).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'hands-private',
        headers: { 'content-length': '1024', 'content-type': 'image/jpeg' },
        method: 'PUT',
      }),
    );
  });

  it('fails closed before creating an upload record when production storage is unavailable', async () => {
    const { prisma, s3, service } = createService();
    s3.allowsPlaceholderStorage.mockReturnValue(false);

    await expect(
      service.createPresignedUpload(providerUser, {
        contentType: 'image/jpeg',
        purpose: 'profile-image',
        sizeBytes: 1024,
        visibility: FileVisibility.PUBLIC,
      }),
    ).rejects.toThrow('File storage is not configured for this environment');

    expect(prisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('returns a private read URL to the file owner', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'private/chat-attachment/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(service.createReadUrl(providerUser, 'file-1')).resolves.toMatchObject({
      read: { method: 'GET', url: 'https://storage.example/upload' },
    });
    expect(s3.presign).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'private/chat-attachment/file-1.jpg',
        method: 'GET',
      }),
    );
  });

  it('keeps pending public Partner media behind an authenticated private read URL', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'private/profile-image/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'PENDING_REVIEW',
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.createReadUrl(providerUser, 'file-1')).resolves.toMatchObject({
      read: { method: 'GET', url: 'https://storage.example/upload' },
    });
    expect(s3.presign).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'hands-private', method: 'GET' }),
    );
  });

  it('fails closed for unreviewed legacy media still stored in the public bucket', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'legacy-file-1',
      key: 'public/profile-image/legacy-file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'PENDING_REVIEW',
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.createReadUrl(providerUser, 'legacy-file-1')).rejects.toThrow(
      'Legacy public media must be reviewed before access',
    );
    expect(s3.presign).not.toHaveBeenCalled();
  });

  it('returns only a public-safe file projection for approved media', async () => {
    const { prisma, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'approved-file-1',
      contentType: 'image/jpeg',
      key: 'public/profile-image/approved-file-1.jpg',
      originalName: 'private-name.jpg',
      ownerUserId: 'provider-user-1',
      providerVerification: { providerProfile: { userId: 'provider-user-1' } },
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewReason: 'internal review note',
      reviewStatus: 'APPROVED',
      sizeBytes: 1024,
      visibility: FileVisibility.PUBLIC,
    });

    const result = await service.createReadUrl(
      { id: 'customer-user-1', roles: [Role.CUSTOMER] },
      'approved-file-1',
    );

    expect(result.file).toEqual({
      id: 'approved-file-1',
      contentType: 'image/jpeg',
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'APPROVED',
      reviewedAt: null,
      sizeBytes: 1024,
      visibility: FileVisibility.PUBLIC,
    });
    expect(result.file).not.toHaveProperty('key');
    expect(result.file).not.toHaveProperty('ownerUserId');
    expect(result.file).not.toHaveProperty('providerVerification');
    expect(result.file).not.toHaveProperty('reviewReason');
  });

  it('does not return a private read URL to an unrelated mobile user', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'private/chat-attachment/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(
      service.createReadUrl({ id: 'other-customer', roles: [Role.CUSTOMER] }, 'file-1'),
    ).rejects.toThrow('You do not have access to this file');
    expect(s3.presign).not.toHaveBeenCalled();
  });

  it('does not let an Admin read a private file without the purpose permission', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'kyc-file-1',
      key: 'private/provider-verification/kyc-file-1.jpg',
      ownerUserId: 'provider-user',
      providerVerification: { providerProfile: { userId: 'provider-user' } },
      purpose: FilePurpose.PROVIDER_VERIFICATION,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(
      service.createReadUrl(
        {
          id: 'support-admin',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
        },
        'kyc-file-1',
      ),
    ).rejects.toThrow('You do not have access to this file');
    expect(s3.presign).not.toHaveBeenCalled();
  });

  it('lets a KYC Admin read a private Partner verification file', async () => {
    const { prisma, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'kyc-file-1',
      key: 'private/provider-verification/kyc-file-1.jpg',
      ownerUserId: 'provider-user',
      providerVerification: { providerProfile: { userId: 'provider-user' } },
      purpose: FilePurpose.PROVIDER_VERIFICATION,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(
      service.createReadUrl(
        {
          id: 'kyc-admin',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.PARTNERS_KYC],
        },
        'kyc-file-1',
      ),
    ).resolves.toMatchObject({ read: { method: 'GET' } });
  });

  it('rejects Finance evidence uploads from an Admin without wallet-adjustment permission', async () => {
    const { prisma, service } = createService();

    await expect(
      service.createPresignedUpload(
        {
          id: 'support-admin',
          roles: [Role.ADMIN],
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
        },
        {
          contentType: 'image/jpeg',
          purpose: 'finance-evidence',
          sizeBytes: 1024,
          visibility: FileVisibility.PRIVATE,
        },
      ),
    ).rejects.toThrow('Admin permission does not allow this file operation');
    expect(prisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('returns a private chat attachment read URL to the other booking participant', async () => {
    const { prisma, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'private/chat-attachment/file-1.jpg',
      ownerUserId: 'customer-user',
      providerVerification: null,
      purpose: 'CHAT_ATTACHMENT',
      visibility: FileVisibility.PRIVATE,
    });
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'provider-1' });
    prisma.chatMessage.findFirst.mockResolvedValue({ id: 'message-1' });

    await expect(
      service.createReadUrl({ id: 'provider-user', roles: [Role.PROVIDER] }, 'file-1'),
    ).resolves.toMatchObject({
      read: { method: 'GET', url: 'https://storage.example/upload' },
    });
    expect(prisma.chatMessage.findFirst).toHaveBeenCalledWith({
      where: {
        attachments: { array_contains: [{ id: 'file-1' }] },
        chatRoom: { booking: { OR: [{ selectedProviderId: 'provider-1' }] } },
      },
      select: { id: true },
    });
  });

  it('does not return a placeholder private read URL in production', async () => {
    const { prisma, s3, service } = createService();
    s3.allowsPlaceholderStorage.mockReturnValue(false);
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'private/chat-attachment/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(service.createReadUrl(providerUser, 'file-1')).rejects.toThrow(
      'File storage is not configured for this environment',
    );
    expect(s3.presign).not.toHaveBeenCalled();
  });

  it('rejects completed image uploads above the MVP size cap', async () => {
    const { prisma, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/jpeg',
      ownerUserId: providerUser.id,
      providerVerification: null,
    });

    await expect(
      service.completeUpload(providerUser, 'file-1', {
        sizeBytes: 10 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('Uploaded file exceeds the allowed size for its type');

    expect(prisma.fileAsset.update).not.toHaveBeenCalled();
  });

  it('allows completed video uploads within the MVP size cap', async () => {
    const { prisma, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'video/mp4',
      ownerUserId: providerUser.id,
      providerVerification: null,
    });

    await expect(
      service.completeUpload(providerUser, 'file-1', {
        sizeBytes: 10 * 1024 * 1024,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        uploadStatus: FileUploadStatus.UPLOADED,
        sizeBytes: 10 * 1024 * 1024,
      }),
    );

    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({
        sizeBytes: 10 * 1024 * 1024,
        uploadStatus: FileUploadStatus.UPLOADED,
      }),
    });
  });

  it('does not mark an upload complete from client claims when production storage is unavailable', async () => {
    const { prisma, s3, service } = createService();
    s3.allowsPlaceholderStorage.mockReturnValue(false);
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/jpeg',
      key: 'private/chat-attachment/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(service.completeUpload(providerUser, 'file-1', { sizeBytes: 1024 })).rejects.toThrow(
      'File storage is not configured for this environment',
    );
    expect(prisma.fileAsset.update).not.toHaveBeenCalled();
  });

  it('uses storage metadata instead of trusting a client-reported upload size', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    s3.inspectObject.mockResolvedValue({
      contentType: 'image/jpeg',
      prefix: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
      sizeBytes: 1024,
    });
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/jpeg',
      key: 'private/provider-verification/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(service.completeUpload(providerUser, 'file-1', {})).resolves.toEqual(
      expect.objectContaining({
        uploadStatus: FileUploadStatus.UPLOADED,
        sizeBytes: 1024,
      }),
    );

    expect(s3.inspectObject).toHaveBeenCalledWith(
      'private/provider-verification/file-1.jpg',
      FileVisibility.PRIVATE,
    );
    expect(s3.scanObject).toHaveBeenCalledWith(
      'private/provider-verification/file-1.jpg',
      FileVisibility.PRIVATE,
    );
  });

  it('deletes and rejects an uploaded object when malware scanning fails', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    s3.inspectObject.mockResolvedValue({
      contentType: 'image/jpeg',
      prefix: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
      sizeBytes: 1024,
    });
    s3.scanObject.mockResolvedValue({ clean: false, mode: 'external-scanner' });
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/jpeg',
      key: 'private/provider-verification/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      purpose: FilePurpose.PROVIDER_VERIFICATION,
      sizeBytes: 1024,
      visibility: FileVisibility.PRIVATE,
    });

    await expect(
      service.completeUpload(providerUser, 'file-1', { sizeBytes: 1024 }),
    ).rejects.toThrow('Uploaded file failed the malware safety scan');

    expect(s3.deleteObject).toHaveBeenCalledWith(
      'private/provider-verification/file-1.jpg',
      FileVisibility.PRIVATE,
    );
    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: { uploadStatus: FileUploadStatus.FAILED },
    });
  });

  it('promotes approved Partner media from private quarantine to the public bucket', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    const pending = {
      id: 'file-1',
      key: 'private/profile-image/file-1.jpg',
      ownerUserId: providerUser.id,
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'PENDING_REVIEW',
      uploadStatus: FileUploadStatus.UPLOADED,
      visibility: FileVisibility.PUBLIC,
    };
    prisma.fileAsset.findUnique.mockResolvedValue(pending);
    prisma.fileAsset.update.mockImplementation(({ data }) => Promise.resolve({ ...pending, ...data }));

    await expect(service.approvePublicMedia('file-1', 'admin-1')).resolves.toMatchObject({
      reviewStatus: 'APPROVED',
      reviewedById: 'admin-1',
      url: 'https://cdn.example/private/profile-image/file-1.jpg',
    });

    expect(s3.copyObject).toHaveBeenCalledWith(
      pending.key,
      FileVisibility.PRIVATE,
      FileVisibility.PUBLIC,
    );
    expect(s3.deleteObject).toHaveBeenCalledWith(pending.key, FileVisibility.PRIVATE);
  });

  it('approves legacy pending Partner media that was already stored in the public bucket', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    const legacyPending = {
      id: 'legacy-file-1',
      key: 'public/profile-image/legacy-file-1.jpg',
      ownerUserId: providerUser.id,
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'PENDING_REVIEW',
      uploadStatus: FileUploadStatus.UPLOADED,
      visibility: FileVisibility.PUBLIC,
    };
    prisma.fileAsset.findUnique.mockResolvedValue(legacyPending);
    prisma.fileAsset.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...legacyPending, ...data }),
    );

    await expect(service.approvePublicMedia('legacy-file-1', 'admin-1')).resolves.toMatchObject({
      reviewStatus: 'APPROVED',
      url: 'https://cdn.example/public/profile-image/legacy-file-1.jpg',
    });

    expect(s3.copyObject).not.toHaveBeenCalled();
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });

  it('moves rejected approved Partner media back to private quarantine', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    const approved = {
      id: 'file-1',
      key: 'public/profile-image/file-1.jpg',
      ownerUserId: providerUser.id,
      purpose: FilePurpose.PROFILE_IMAGE,
      reviewStatus: 'APPROVED',
      uploadStatus: FileUploadStatus.UPLOADED,
      visibility: FileVisibility.PUBLIC,
    };
    prisma.fileAsset.findUnique.mockResolvedValue(approved);
    prisma.fileAsset.update.mockImplementation(({ data }) => Promise.resolve({ ...approved, ...data }));

    await expect(
      service.rejectPublicMedia('file-1', 'admin-1', 'Customer privacy concern'),
    ).resolves.toMatchObject({
      reviewReason: 'Customer privacy concern',
      reviewStatus: 'REJECTED',
      url: null,
    });

    expect(s3.copyObject).toHaveBeenCalledWith(
      approved.key,
      FileVisibility.PUBLIC,
      FileVisibility.PRIVATE,
      'private/profile-image/file-1.jpg',
    );
    expect(s3.deleteObject).toHaveBeenCalledWith(approved.key, FileVisibility.PUBLIC);
    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({ key: 'private/profile-image/file-1.jpg' }),
    });
  });

  it('rejects stored objects whose bytes do not match the declared content type', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    s3.inspectObject.mockResolvedValue({
      contentType: 'image/jpeg',
      prefix: new TextEncoder().encode('<script>alert(1)'),
      sizeBytes: 1024,
    });
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/jpeg',
      key: 'public/profile-image/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.completeUpload(providerUser, 'file-1', { sizeBytes: 1024 })).rejects.toThrow(
      'Uploaded object content does not match its declared file type',
    );
    expect(prisma.fileAsset.update).not.toHaveBeenCalled();
  });

  it('rejects completion when the client-reported size differs from storage', async () => {
    const { prisma, s3, service } = createService();
    s3.isConfigured.mockReturnValue(true);
    s3.inspectObject.mockResolvedValue({
      contentType: 'image/png',
      prefix: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      sizeBytes: 2048,
    });
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      contentType: 'image/png',
      key: 'public/profile-image/file-1.png',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.completeUpload(providerUser, 'file-1', { sizeBytes: 1024 })).rejects.toThrow(
      'Uploaded object size does not match the completion request',
    );
    expect(prisma.fileAsset.update).not.toHaveBeenCalled();
  });

  it('deletes an owned file from object storage before removing its database record', async () => {
    const { prisma, s3, service } = createService();
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'public/provider-user-1/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.deleteFile(providerUser, 'file-1')).resolves.toEqual({
      ok: true,
      fileId: 'file-1',
    });

    expect(s3.deleteObject).toHaveBeenCalledWith('public/provider-user-1/file-1.jpg', FileVisibility.PUBLIC);
    expect(prisma.fileAsset.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
  });

  it('preserves file metadata when production object storage is unavailable during deletion', async () => {
    const { prisma, s3, service } = createService();
    s3.allowsPlaceholderStorage.mockReturnValue(false);
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: 'file-1',
      key: 'public/provider-user-1/file-1.jpg',
      ownerUserId: providerUser.id,
      providerVerification: null,
      visibility: FileVisibility.PUBLIC,
    });

    await expect(service.deleteFile(providerUser, 'file-1')).rejects.toThrow(
      'File storage is not configured for this environment',
    );
    expect(s3.deleteObject).not.toHaveBeenCalled();
    expect(prisma.fileAsset.delete).not.toHaveBeenCalled();
  });
});
