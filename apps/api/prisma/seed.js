const {
  PrismaClient,
  Role,
  ProviderStatus,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const services = await Promise.all([
    prisma.massageService.upsert({
      where: { id: 'svc-swedish-60' },
      update: {},
      create: {
        id: 'svc-swedish-60',
        name: 'Swedish Massage',
        description: 'Relaxing full-body massage for first-time customers.',
        durationMin: 60,
        basePrice: 450000,
      },
    }),
    prisma.massageService.upsert({
      where: { id: 'svc-deep-tissue-90' },
      update: {},
      create: {
        id: 'svc-deep-tissue-90',
        name: 'Deep Tissue Massage',
        description: 'Focused pressure for muscle tension and recovery.',
        durationMin: 90,
        basePrice: 690000,
      },
    }),
    prisma.massageService.upsert({
      where: { id: 'svc-foot-45' },
      update: {},
      create: {
        id: 'svc-foot-45',
        name: 'Foot Massage',
        description: 'Foot and lower-leg massage for quick recovery.',
        durationMin: 45,
        basePrice: 300000,
      },
    }),
  ]);

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
