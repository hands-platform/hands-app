import { FileUploadStatus, FileVisibility, Role } from '@prisma/client';

import { FilesService } from './files.service';

describe('FilesService upload security', () => {
  const providerUser = { id: 'provider-user-1', roles: [Role.PROVIDER] };

  function createService() {
    const prisma = {
      fileAsset: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'file-1', ...data })),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'file-1', ...data })),
      },
      providerProfile: {
        findUnique: vi.fn(),
      },
    };
    const s3 = {
      bucketForVisibility: vi.fn().mockReturnValue('hands-public'),
      configurationNote: vi.fn().mockReturnValue('Upload with PUT before the presigned URL expires.'),
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
    const { prisma, service } = createService();

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
});
