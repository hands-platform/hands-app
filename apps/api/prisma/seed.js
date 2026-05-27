const {
  PrismaClient,
  Role,
  ProviderStatus,
  ProviderKycStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderBankAccountStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const serviceCatalog = [
    {
      id: 'svc-foot-45',
      serviceGroupKey: 'foot',
      name: 'Foot Massage',
      description: 'Foot and lower-leg massage for quick recovery.',
      durationMin: 45,
      basePrice: 300000,
      displayOrder: 10,
    },
    {
      id: 'svc-foot-60',
      serviceGroupKey: 'foot',
      name: 'Foot Massage',
      description: 'Foot and lower-leg massage for quick recovery.',
      durationMin: 60,
      basePrice: 500000,
      displayOrder: 11,
    },
    {
      id: 'svc-foot-90',
      serviceGroupKey: 'foot',
      name: 'Foot Massage',
      description: 'Foot and lower-leg massage for quick recovery.',
      durationMin: 90,
      basePrice: 700000,
      displayOrder: 12,
    },
    {
      id: 'svc-foot-120',
      serviceGroupKey: 'foot',
      name: 'Foot Massage',
      description: 'Foot and lower-leg massage for quick recovery.',
      durationMin: 120,
      basePrice: 900000,
      displayOrder: 13,
    },
    {
      id: 'svc-swedish-60',
      serviceGroupKey: 'swedish',
      name: 'Swedish Massage',
      description: 'Relaxing full-body massage for first-time customers.',
      durationMin: 60,
      basePrice: 500000,
      displayOrder: 20,
    },
    {
      id: 'svc-swedish-90',
      serviceGroupKey: 'swedish',
      name: 'Swedish Massage',
      description: 'Relaxing full-body massage for first-time customers.',
      durationMin: 90,
      basePrice: 700000,
      displayOrder: 21,
    },
    {
      id: 'svc-swedish-120',
      serviceGroupKey: 'swedish',
      name: 'Swedish Massage',
      description: 'Relaxing full-body massage for first-time customers.',
      durationMin: 120,
      basePrice: 900000,
      displayOrder: 22,
    },
    {
      id: 'svc-deep-tissue-60',
      serviceGroupKey: 'deep_tissue',
      name: 'Deep Tissue Massage',
      description: 'Focused pressure for muscle tension and recovery.',
      durationMin: 60,
      basePrice: 500000,
      displayOrder: 30,
    },
    {
      id: 'svc-deep-tissue-90',
      serviceGroupKey: 'deep_tissue',
      name: 'Deep Tissue Massage',
      description: 'Focused pressure for muscle tension and recovery.',
      durationMin: 90,
      basePrice: 700000,
      displayOrder: 31,
    },
    {
      id: 'svc-deep-tissue-120',
      serviceGroupKey: 'deep_tissue',
      name: 'Deep Tissue Massage',
      description: 'Focused pressure for muscle tension and recovery.',
      durationMin: 120,
      basePrice: 900000,
      displayOrder: 32,
    },
  ];
  const services = await Promise.all(
    serviceCatalog.map((service) =>
      prisma.massageService.upsert({
        where: { id: service.id },
        update: {
          serviceGroupKey: service.serviceGroupKey,
          name: service.name,
          description: service.description,
          durationMin: service.durationMin,
          basePrice: service.basePrice,
          priceStep: 100000,
          displayOrder: service.displayOrder,
          active: true,
        },
        create: {
          ...service,
          priceStep: 100000,
        },
      }),
    ),
  );

  for (const service of services) {
    await prisma.servicePayoutRule.upsert({
      where: {
        serviceId_customerPrice: {
          serviceId: service.id,
          customerPrice: service.basePrice,
        },
      },
      update: {
        providerPayoutAmount: Math.max(0, service.basePrice - Math.round(service.basePrice * 0.2)),
        vatBps: 0,
        otherCostAmount: 0,
        currency: 'VND',
        active: true,
        notes: 'Default MVP payout rule generated from the 20% platform fee baseline.',
      },
      create: {
        serviceId: service.id,
        customerPrice: service.basePrice,
        providerPayoutAmount: Math.max(0, service.basePrice - Math.round(service.basePrice * 0.2)),
        vatBps: 0,
        otherCostAmount: 0,
        currency: 'VND',
        active: true,
        notes: 'Default MVP payout rule generated from the 20% platform fee baseline.',
      },
    });
  }

  const customer = await prisma.user.upsert({
    where: { phone: '+84900000001' },
    update: {},
    create: {
      phone: '+84900000001',
      fullName: 'Demo Customer',
      roles: [Role.CUSTOMER],
      customerProfile: { create: {} },
    },
    include: { customerProfile: true },
  });

  const provider = await prisma.user.upsert({
    where: { phone: '+84900000002' },
    update: {},
    create: {
      phone: '+84900000002',
      fullName: 'Demo Provider',
      roles: [Role.PROVIDER],
      providerProfile: {
        create: {
          displayName: 'Linh Wellness',
          bio: 'Verified provider available for home massage in Ho Chi Minh City.',
          experienceYears: 4,
          specialties: ['Foot massage', 'Swedish massage', 'Deep tissue'],
          languages: ['vi', 'en'],
          serviceStyle: 'Quiet, professional home massage with clear arrival communication.',
          status: ProviderStatus.ONLINE_AVAILABLE,
          currentLat: 10.7769,
          currentLng: 106.7009,
          verification: {
            create: {
              status: VerificationStatus.APPROVED,
              submittedAt: new Date(),
              reviewedAt: new Date(),
            },
          },
        },
      },
    },
    include: { providerProfile: true },
  });

  if (provider.providerProfile) {
    await prisma.providerProfile.update({
      where: { id: provider.providerProfile.id },
      data: {
        displayName: 'Linh Wellness',
        bio: 'Verified provider available for home massage in Ho Chi Minh City.',
        experienceYears: 4,
        specialties: ['Foot massage', 'Swedish massage', 'Deep tissue'],
        languages: ['vi', 'en'],
        serviceStyle: 'Quiet, professional home massage with clear arrival communication.',
      },
    });

    await prisma.providerKyc.upsert({
      where: { providerProfileId: provider.providerProfile.id },
      update: {
        cccdNumberHash: 'demo-cccd-hash',
        cccdNumberLast4: '0002',
        status: ProviderKycStatus.APPROVED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        rejectionReason: null,
        blockedAt: null,
      },
      create: {
        providerProfileId: provider.providerProfile.id,
        cccdNumberHash: 'demo-cccd-hash',
        cccdNumberLast4: '0002',
        status: ProviderKycStatus.APPROVED,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    for (const documentType of [
      ProviderDocumentType.CCCD_FRONT,
      ProviderDocumentType.CCCD_BACK,
      ProviderDocumentType.SELFIE,
    ]) {
      const file = await prisma.fileAsset.upsert({
        where: { key: `demo-provider/${provider.providerProfile.id}/${documentType}.jpg` },
        update: {
          uploadStatus: FileUploadStatus.UPLOADED,
          reviewStatus: FileReviewStatus.APPROVED,
          reviewedAt: new Date(),
          uploadedAt: new Date(),
        },
        create: {
          key: `demo-provider/${provider.providerProfile.id}/${documentType}.jpg`,
          url: null,
          contentType: 'image/jpeg',
          purpose: FilePurpose.PROVIDER_VERIFICATION,
          visibility: FileVisibility.PRIVATE,
          uploadStatus: FileUploadStatus.UPLOADED,
          reviewStatus: FileReviewStatus.APPROVED,
          reviewedAt: new Date(),
          uploadedAt: new Date(),
          ownerUserId: provider.id,
          sizeBytes: 204800,
        },
      });
      await prisma.providerDocument.upsert({
        where: { fileAssetId: file.id },
        update: {
          type: documentType,
          status: ProviderDocumentStatus.APPROVED,
          reviewedAt: new Date(),
          rejectionReason: null,
          deletedAt: null,
        },
        create: {
          providerProfileId: provider.providerProfile.id,
          fileAssetId: file.id,
          type: documentType,
          status: ProviderDocumentStatus.APPROVED,
          reviewedAt: new Date(),
        },
      });
    }

    const primaryBank = await prisma.providerBankAccount.findFirst({
      where: { providerProfileId: provider.providerProfile.id, isPrimary: true },
    });
    if (primaryBank) {
      await prisma.providerBankAccount.update({
        where: { id: primaryBank.id },
        data: {
          bankName: 'Vietcombank',
          accountNumberMasked: '****0002',
          accountNumberLast4: '0002',
          accountHolderName: 'Demo Provider',
          status: ProviderBankAccountStatus.APPROVED,
          reviewedAt: new Date(),
          rejectionReason: null,
          deletedAt: null,
        },
      });
    } else {
      await prisma.providerBankAccount.create({
        data: {
          providerProfileId: provider.providerProfile.id,
          bankName: 'Vietcombank',
          accountNumberMasked: '****0002',
          accountNumberLast4: '0002',
          accountHolderName: 'Demo Provider',
          status: ProviderBankAccountStatus.APPROVED,
          isPrimary: true,
          reviewedAt: new Date(),
        },
      });
    }
  }

  const admin = await prisma.user.upsert({
    where: { phone: '+84900000099' },
    update: {},
    create: {
      phone: '+84900000099',
      fullName: 'Demo Admin',
      roles: [Role.ADMIN],
    },
  });

  await prisma.platformFeePolicyVersion.upsert({
    where: { id: 'platform-fee-vn-mvp-2026' },
    update: {
      status: TaxPolicyStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      notes: 'Default MVP platform fee. Update via admin policy tooling before production.',
      rules: {
        upsert: {
          where: { id: 'platform-fee-rule-default-20pct' },
          update: {
            scope: TaxRuleScope.DEFAULT,
            rateBps: 2000,
            fixedAmount: 0,
            active: true,
          },
          create: {
            id: 'platform-fee-rule-default-20pct',
            scope: TaxRuleScope.DEFAULT,
            rateBps: 2000,
            fixedAmount: 0,
            active: true,
          },
        },
      },
    },
    create: {
      id: 'platform-fee-vn-mvp-2026',
      name: 'HANDS Vietnam MVP platform fee',
      status: TaxPolicyStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      notes: 'Default MVP platform fee. Update via admin policy tooling before production.',
      rules: {
        create: {
          id: 'platform-fee-rule-default-20pct',
          scope: TaxRuleScope.DEFAULT,
          rateBps: 2000,
          fixedAmount: 0,
          active: true,
        },
      },
    },
  });

  if (provider.providerProfile) {
    for (const service of services) {
      await prisma.providerService.upsert({
        where: {
          providerProfileId_serviceId: {
            providerProfileId: provider.providerProfile.id,
            serviceId: service.id,
          },
        },
        update: {},
        create: {
          providerProfileId: provider.providerProfile.id,
          serviceId: service.id,
          price: service.basePrice,
        },
      });
    }

    await prisma.providerDevice.upsert({
      where: {
        providerProfileId_deviceId: {
          providerProfileId: provider.providerProfile.id,
          deviceId: 'demo-provider-android-01',
        },
      },
      update: {
        platform: 'android',
        appVersion: '0.1.0-dev',
        enabled: true,
        lastSeenAt: new Date(),
        blockedAt: null,
        blockReason: null,
      },
      create: {
        providerProfileId: provider.providerProfile.id,
        deviceId: 'demo-provider-android-01',
        platform: 'android',
        appVersion: '0.1.0-dev',
        enabled: true,
        lastSeenAt: new Date(),
      },
    });

    await prisma.providerSession.deleteMany({
      where: {
        providerProfileId: provider.providerProfile.id,
        deviceId: 'demo-provider-android-01',
      },
    });
    await prisma.providerSession.create({
      data: {
        providerProfileId: provider.providerProfile.id,
        deviceId: 'demo-provider-android-01',
        ipAddress: '127.0.0.1',
        appVersion: '0.1.0-dev',
        lastSeenAt: new Date(),
      },
    });
  }

  console.log({
    services: services.map((service) => service.id),
    customerUserId: customer.id,
    providerUserId: provider.id,
    adminUserId: admin.id,
    providerProfileId: provider.providerProfile && provider.providerProfile.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
