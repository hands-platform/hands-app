import { FilePurpose, FileUploadStatus, FileVisibility, Role } from '@prisma/client';

import { AdminService } from './admin.service';

describe('AdminService Partner profile content and media', () => {
  const actor = { id: 'admin-1', roles: [Role.ADMIN] };

  function createService() {
    const prisma = {
      $transaction: vi.fn().mockImplementation((operations: unknown[]) => Promise.all(operations)),
      adminAuditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      fileAsset: {
        aggregate: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      providerProfile: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const files = {
      completeUpload: vi.fn(),
      createPresignedUploadForOwner: vi.fn(),
      deleteFile: vi.fn(),
    };
    const service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      files as never,
    );
    return { files, prisma, service };
  }

  it('stores translated bios without replacing the Vietnamese source bio', async () => {
    const { prisma, service } = createService();
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'partner-1', bio: 'Nguon tieng Viet' });
    prisma.providerProfile.update.mockResolvedValue({
      id: 'partner-1',
      bio: 'Nguon tieng Viet',
      bioTranslations: { en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' },
    });

    await service.updatePartnerProfileContent('admin-1', 'partner-1', {
      bioEn: ' English ',
      bioJa: 'Japanese',
      bioKo: 'Korean',
      bioZh: 'Chinese',
    });

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: {
        bioTranslations: { en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' },
      },
      select: { id: true, bio: true, bioTranslations: true },
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'provider.profile_translations_updated' }),
      }),
    );
  });

  it('appends a new public profile photo after the current ordered media', async () => {
    const { files, prisma, service } = createService();
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'partner-1', userId: 'provider-user-1' });
    prisma.fileAsset.count.mockResolvedValue(2);
    prisma.fileAsset.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    files.createPresignedUploadForOwner.mockResolvedValue({
      file: { id: 'file-3' },
      upload: { method: 'PUT', url: 'https://storage.example/upload' },
    });
    prisma.fileAsset.update.mockResolvedValue({
      id: 'file-3',
      purpose: FilePurpose.PROVIDER_GALLERY,
      sortOrder: 5,
    });

    const result = await service.createPartnerPublicMediaUpload(actor, 'partner-1', {
      contentType: 'image/jpeg',
      purpose: 'provider-gallery',
    });

    expect(files.createPresignedUploadForOwner).toHaveBeenCalledWith(
      actor,
      'provider-user-1',
      expect.objectContaining({ visibility: FileVisibility.PUBLIC }),
    );
    expect(prisma.fileAsset.update).toHaveBeenCalledWith({
      where: { id: 'file-3' },
      data: { sortOrder: 5 },
    });
    expect(result.file.sortOrder).toBe(5);
  });

  it('reorders every uploaded public image in the submitted sequence', async () => {
    const { prisma, service } = createService();
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'partner-1', userId: 'provider-user-1' });
    prisma.fileAsset.findMany.mockResolvedValue([{ id: 'file-a' }, { id: 'file-b' }]);
    prisma.fileAsset.update.mockImplementation(({ data, where }: { data: unknown; where: { id: string } }) =>
      Promise.resolve({ id: where.id, ...data }),
    );

    await service.reorderPartnerPublicMedia('admin-1', 'partner-1', {
      fileIds: ['file-b', 'file-a'],
    });

    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uploadStatus: FileUploadStatus.UPLOADED }),
      }),
    );
    expect(prisma.fileAsset.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'file-b' },
      data: { sortOrder: 0 },
    });
    expect(prisma.fileAsset.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'file-a' },
      data: { sortOrder: 1 },
    });
  });

  it('deletes only public media owned by the selected Partner', async () => {
    const { files, prisma, service } = createService();
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'partner-1', userId: 'provider-user-1' });
    prisma.fileAsset.findFirst.mockResolvedValue({
      id: 'file-1',
      purpose: FilePurpose.PROFILE_IMAGE,
      sortOrder: 0,
    });
    files.deleteFile.mockResolvedValue({ ok: true, fileId: 'file-1' });

    await service.deletePartnerPublicMedia(actor, 'partner-1', 'file-1');

    expect(prisma.fileAsset.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        ownerUserId: 'provider-user-1',
        purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
        visibility: FileVisibility.PUBLIC,
      },
      select: { id: true, purpose: true, sortOrder: true },
    });
    expect(files.deleteFile).toHaveBeenCalledWith(actor, 'file-1');
  });
});
