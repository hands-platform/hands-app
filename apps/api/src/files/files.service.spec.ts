import { FileUploadStatus, FileVisibility, Role } from '@prisma/client';

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
      bucketForVisibility: vi.fn().mockReturnValue('hands-public'),
      configurationNote: vi.fn().mockReturnValue('Upload with PUT before the presigned URL expires.'),
      deleteObject: vi.fn().mockResolvedValue({ deleted: true }),
      inspectObject: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(false),
      allowsPlaceholderStorage: vi.fn().mockReturnValue(true),
      presign: vi.fn().mockReturnValue('https://storage.example/upload'),
      publicUrl: vi.fn().mockImplementation((key: string) => `https://cdn.example/${key}`),
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
        visibility: FileVisibility.PUBLIC,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        upload: expect.objectContaining({
          headers: { 'content-type': 'image/jpeg' },
        }),
      }),
    );

    expect(prisma.fileAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: 'image/jpeg',
        purpose: 'PROFILE_IMAGE',
        visibility: FileVisibility.PUBLIC,
      }),
    });
    expect(s3.presign).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'content-type': 'image/jpeg' },
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
        sizeBytes: 50 * 1024 * 1024,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        uploadStatus: FileUploadStatus.UPLOADED,
        sizeBytes: 50 * 1024 * 1024,
      }),
    );

    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({
        sizeBytes: 50 * 1024 * 1024,
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
