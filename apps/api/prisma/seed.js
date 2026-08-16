const {
  PrismaClient,
  Role,
  AdminUserProvenance,
  AdminOperatorPermissionCategory,
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  BookingPaymentClearingEntryType,
  BookingPaymentClearingStatus,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  BookingStatus,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
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
  PaymentMethod,
  PaymentStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();
const adminOperatorPermissionCategories = Object.values(AdminOperatorPermissionCategory);

function assertSeedAllowed() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRISMA_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing to run Prisma seed in production without ALLOW_PRISMA_SEED=true.',
    );
  }
}

function decodeJwtPayloadUnsafe(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [, encodedPayload] = token.split('.');
  if (!encodedPayload) {
    return null;
  }

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    return JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeSeedAdminRoles(payload) {
  const validRoles = new Set(Object.values(Role));
  const payloadRoles = Array.isArray(payload?.roles) ? payload.roles : [];
  const roles = new Set(
    [...payloadRoles, payload?.activeRole, payload?.role].filter((role) => validRoles.has(role)),
  );

  if (!roles.has(Role.ADMIN)) {
    return [];
  }

  roles.add(Role.FINANCE_APPROVER);
  roles.add(Role.MASTER_ADMIN);

  return [...roles];
}

async function seedAdminAccessTokenActor() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_LOCAL_ADMIN_TOKEN_SEED !== 'true'
  ) {
    return null;
  }

  const payload = decodeJwtPayloadUnsafe(process.env.ADMIN_ACCESS_TOKEN);
  const actorId = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  const roles = normalizeSeedAdminRoles(payload);
  if (!actorId || roles.length === 0) {
    return null;
  }

  const phone = process.env.ADMIN_ACCESS_TOKEN_SEED_PHONE?.trim() || '+84900000998';

  const user = await prisma.user.upsert({
    where: { id: actorId },
    update: {
      fullName: 'Local Admin Web Actor',
      roles: { set: roles },
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: 'PRISMA_SEED',
      fixtureRunId: 'prisma-seed',
    },
    create: {
      id: actorId,
      phone,
      email: process.env.ADMIN_WEB_LOGIN_EMAIL?.trim() || null,
      fullName: 'Local Admin Web Actor',
      roles,
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: 'PRISMA_SEED',
      fixtureRunId: 'prisma-seed',
    },
  });

  await prisma.adminOperatorPermission.upsert({
    where: { userId: user.id },
    update: {
      categories: { set: adminOperatorPermissionCategories },
    },
    create: {
      userId: user.id,
      categories: { set: adminOperatorPermissionCategories },
    },
  });

  return user;
}

async function main() {
  assertSeedAllowed();

  const appVersionPolicies = [
    { appType: 'CUSTOMER', platform: 'ANDROID' },
    { appType: 'CUSTOMER', platform: 'IOS' },
    { appType: 'PARTNER', platform: 'ANDROID' },
    { appType: 'PARTNER', platform: 'IOS' },
  ];

  await Promise.all(
    appVersionPolicies.map((policy) =>
      prisma.appVersionPolicy.upsert({
        where: {
          appType_platform: {
            appType: policy.appType,
            platform: policy.platform,
          },
        },
        update: {
          forceUpdate: false,
          isActive: true,
          releaseNotes:
            'Default HANDS mobile version policy. Update from operations tooling before production.',
        },
        create: {
          appType: policy.appType,
          platform: policy.platform,
          forceUpdate: false,
          isActive: true,
          releaseNotes:
            'Default HANDS mobile version policy. Update from operations tooling before production.',
        },
      }),
    ),
  );

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
    const existingPayoutRule = await prisma.servicePayoutRule.findFirst({
      where: { serviceId: service.id, customerPrice: service.basePrice, active: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const payoutRuleData = {
      providerPayoutAmount: Math.max(0, service.basePrice - Math.round(service.basePrice * 0.2)),
      vatBps: 0,
      otherCostAmount: 0,
      currency: 'VND',
      active: true,
      notes: 'Default MVP payout rule generated from the 20% platform fee baseline.',
    };
    if (existingPayoutRule) {
      await prisma.servicePayoutRule.update({
        where: { id: existingPayoutRule.id },
        data: payoutRuleData,
      });
    } else {
      await prisma.servicePayoutRule.create({
        data: {
          serviceId: service.id,
          customerPrice: service.basePrice,
          ...payoutRuleData,
        },
      });
    }
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
      fullName: 'Demo Partner',
      roles: [Role.PROVIDER],
      providerProfile: {
        create: {
          displayName: 'Linh Wellness',
          bio: 'Verified partner available for home massage in Ho Chi Minh City.',
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
        bio: 'Verified partner available for home massage in Ho Chi Minh City.',
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
          accountHolderName: 'Demo Partner',
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
          accountHolderName: 'Demo Partner',
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
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: 'PRISMA_SEED',
      fixtureRunId: 'prisma-seed',
    },
  });

  await seedAdminAccessTokenActor();

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

  if (customer.customerProfile && provider.providerProfile) {
    const financeSmokeNow = new Date();
    const financeSmokeScheduledEndAt = new Date(financeSmokeNow.getTime() + 60 * 60 * 1000);
    const financeSmokeMonthlyPeriod = financeSmokeNow.toISOString().slice(0, 7);

    const financeSmokeBooking = await prisma.booking.upsert({
      where: { id: 'seed-finance-smoke-booking' },
      update: {
        customerProfileId: customer.customerProfile.id,
        preferredProviderId: provider.providerProfile.id,
        selectedProviderId: provider.providerProfile.id,
        status: BookingStatus.COMPLETED,
        scheduledStartAt: financeSmokeNow,
        scheduledEndAt: financeSmokeScheduledEndAt,
        openedAt: financeSmokeNow,
        matchedAt: financeSmokeNow,
        closedAt: financeSmokeNow,
        closedByRole: Role.PROVIDER,
        closedReason: 'FINANCE_SMOKE_FIXTURE',
        address: {
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
          district: 'District 1',
          text: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
        },
        lat: 10.7757,
        lng: 106.7004,
        metadata: {
          smokeFixture: true,
          purpose: 'Admin Finance detail route smoke',
        },
      },
      create: {
        id: 'seed-finance-smoke-booking',
        customerProfileId: customer.customerProfile.id,
        preferredProviderId: provider.providerProfile.id,
        selectedProviderId: provider.providerProfile.id,
        status: BookingStatus.COMPLETED,
        scheduledStartAt: financeSmokeNow,
        scheduledEndAt: financeSmokeScheduledEndAt,
        openedAt: financeSmokeNow,
        matchedAt: financeSmokeNow,
        closedAt: financeSmokeNow,
        closedByRole: Role.PROVIDER,
        closedReason: 'FINANCE_SMOKE_FIXTURE',
        address: {
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
          district: 'District 1',
          text: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
        },
        lat: 10.7757,
        lng: 106.7004,
        metadata: {
          smokeFixture: true,
          purpose: 'Admin Finance detail route smoke',
        },
      },
    });

    const financeSmokePayment = await prisma.payment.upsert({
      where: { id: 'seed-finance-smoke-payment' },
      update: {
        bookingId: financeSmokeBooking.id,
        method: PaymentMethod.CARD,
        status: PaymentStatus.CAPTURED,
        amount: 500000,
        currency: 'VND',
        providerRef: 'seed-finance-smoke-payment-ref',
        rawMeta: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-payment',
        bookingId: financeSmokeBooking.id,
        method: PaymentMethod.CARD,
        status: PaymentStatus.CAPTURED,
        amount: 500000,
        currency: 'VND',
        providerRef: 'seed-finance-smoke-payment-ref',
        rawMeta: { smokeFixture: true },
      },
    });

    const financeSmokeSettlement = await prisma.bookingSettlementSnapshot.upsert({
      where: { sourceKey: 'seed-finance-smoke-settlement' },
      update: {
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        paymentMethod: PaymentMethod.CARD,
        currency: 'VND',
        customerPaymentAmount: 500000,
        partnerPayoutAmount: 390000,
        partnerTaxableRevenue: 400000,
        partnerVatAmount: 0,
        partnerPitAmount: 15000,
        partnerWithholdingTotal: 15000,
        platformFeeGross: 95000,
        platformFeeNetRevenue: 87963,
        companyOutputVat: 7037,
        paymentProcessingFee: 12000,
        settlementStatus: BookingSettlementStatus.POSTED,
        taxStatus: BookingSettlementTaxStatus.PAID,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        postedAt: financeSmokeNow,
        closedAt: financeSmokeNow,
        metadata: {
          smokeFixture: true,
          purpose: 'Admin Finance settlement and reversal smoke',
        },
      },
      create: {
        id: 'seed-finance-smoke-settlement',
        sourceKey: 'seed-finance-smoke-settlement',
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        paymentMethod: PaymentMethod.CARD,
        currency: 'VND',
        customerPaymentAmount: 500000,
        partnerPayoutAmount: 390000,
        partnerTaxableRevenue: 400000,
        partnerVatAmount: 0,
        partnerPitAmount: 15000,
        partnerWithholdingTotal: 15000,
        platformFeeGross: 95000,
        platformFeeNetRevenue: 87963,
        companyOutputVat: 7037,
        paymentProcessingFee: 12000,
        settlementStatus: BookingSettlementStatus.POSTED,
        taxStatus: BookingSettlementTaxStatus.PAID,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        postedAt: financeSmokeNow,
        closedAt: financeSmokeNow,
        metadata: {
          smokeFixture: true,
          purpose: 'Admin Finance settlement and reversal smoke',
        },
      },
    });

    const financeSmokeJournalBatch = await prisma.accountingJournalBatch.upsert({
      where: { sourceKey: 'seed-finance-smoke-journal-batch' },
      update: {
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        currency: 'VND',
        status: AccountingJournalBatchStatus.POSTED,
        totalDebit: 500000,
        totalCredit: 500000,
        postedAt: financeSmokeNow,
        reversedAt: null,
        settlementSnapshotId: financeSmokeSettlement.id,
        createdById: admin.id,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-journal-batch',
        sourceKey: 'seed-finance-smoke-journal-batch',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        currency: 'VND',
        status: AccountingJournalBatchStatus.POSTED,
        totalDebit: 500000,
        totalCredit: 500000,
        postedAt: financeSmokeNow,
        settlementSnapshotId: financeSmokeSettlement.id,
        createdById: admin.id,
        metadata: { smokeFixture: true },
      },
    });

    await prisma.accountingJournalEntry.upsert({
      where: { id: 'seed-finance-smoke-journal-entry-debit' },
      update: {
        batchId: financeSmokeJournalBatch.id,
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: '1100',
        accountName: 'Customer payment clearing asset',
        amount: 500000,
        currency: 'VND',
        memo: 'Finance smoke debit entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-journal-entry-debit',
        batchId: financeSmokeJournalBatch.id,
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: '1100',
        accountName: 'Customer payment clearing asset',
        amount: 500000,
        currency: 'VND',
        memo: 'Finance smoke debit entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        metadata: { smokeFixture: true },
      },
    });

    await prisma.accountingJournalEntry.upsert({
      where: { id: 'seed-finance-smoke-journal-entry-credit' },
      update: {
        batchId: financeSmokeJournalBatch.id,
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: '2100',
        accountName: 'Booking settlement payable clearing',
        amount: 500000,
        currency: 'VND',
        memo: 'Finance smoke credit entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-journal-entry-credit',
        batchId: financeSmokeJournalBatch.id,
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: '2100',
        accountName: 'Booking settlement payable clearing',
        amount: 500000,
        currency: 'VND',
        memo: 'Finance smoke credit entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
        sourceId: financeSmokeBooking.id,
        metadata: { smokeFixture: true },
      },
    });

    await prisma.bookingPaymentClearingEntry.upsert({
      where: { sourceKey: 'seed-finance-smoke-clearing' },
      update: {
        type: BookingPaymentClearingEntryType.CUSTOMER_PAYMENT_CAPTURED,
        status: BookingPaymentClearingStatus.OPEN,
        bookingId: financeSmokeBooking.id,
        paymentId: financeSmokePayment.id,
        amount: 500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        clearedAt: null,
        settlementSnapshotId: financeSmokeSettlement.id,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-clearing',
        sourceKey: 'seed-finance-smoke-clearing',
        type: BookingPaymentClearingEntryType.CUSTOMER_PAYMENT_CAPTURED,
        status: BookingPaymentClearingStatus.OPEN,
        bookingId: financeSmokeBooking.id,
        paymentId: financeSmokePayment.id,
        amount: 500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        settlementSnapshotId: financeSmokeSettlement.id,
        metadata: { smokeFixture: true },
      },
    });

    const financeSmokeReversal = await prisma.bookingSettlementReversalEntry.upsert({
      where: { sourceKey: 'seed-finance-smoke-reversal' },
      update: {
        originalSettlementSnapshotId: financeSmokeSettlement.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        paymentMethod: PaymentMethod.CARD,
        currency: 'VND',
        customerPaymentAmount: -500000,
        partnerPayoutAmount: -390000,
        partnerTaxableRevenue: -400000,
        partnerVatAmount: 0,
        partnerPitAmount: -15000,
        partnerWithholdingTotal: -15000,
        platformFeeGross: -95000,
        platformFeeNetRevenue: -87963,
        companyOutputVat: -7037,
        paymentProcessingFee: -12000,
        settlementStatus: BookingSettlementStatus.REVERSED,
        taxStatus: BookingSettlementTaxStatus.REVERSED,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        originalMonthlyPeriod: financeSmokeSettlement.monthlyPeriod,
        originalMonthlyClosingId: 'seed-finance-smoke-monthly-closing',
        occurredAt: financeSmokeNow,
        createdById: admin.id,
        reason: 'Refund after payout',
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          reversalEntryType: 'CLOSED_MONTHLY_PERIOD_REFUND',
          originalSettlementSnapshotId: financeSmokeSettlement.id,
        },
      },
      create: {
        id: 'seed-finance-smoke-reversal',
        sourceKey: 'seed-finance-smoke-reversal',
        originalSettlementSnapshotId: financeSmokeSettlement.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        paymentMethod: PaymentMethod.CARD,
        currency: 'VND',
        customerPaymentAmount: -500000,
        partnerPayoutAmount: -390000,
        partnerTaxableRevenue: -400000,
        partnerVatAmount: 0,
        partnerPitAmount: -15000,
        partnerWithholdingTotal: -15000,
        platformFeeGross: -95000,
        platformFeeNetRevenue: -87963,
        companyOutputVat: -7037,
        paymentProcessingFee: -12000,
        settlementStatus: BookingSettlementStatus.REVERSED,
        taxStatus: BookingSettlementTaxStatus.REVERSED,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        originalMonthlyPeriod: financeSmokeSettlement.monthlyPeriod,
        originalMonthlyClosingId: 'seed-finance-smoke-monthly-closing',
        occurredAt: financeSmokeNow,
        createdById: admin.id,
        reason: 'Refund after payout',
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          reversalEntryType: 'CLOSED_MONTHLY_PERIOD_REFUND',
          originalSettlementSnapshotId: financeSmokeSettlement.id,
        },
      },
    });

    const financeSmokeReversalJournalBatch = await prisma.accountingJournalBatch.upsert({
      where: { sourceKey: 'seed-finance-smoke-reversal-journal-batch' },
      update: {
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        settlementSnapshotId: financeSmokeSettlement.id,
        settlementReversalEntryId: financeSmokeReversal.id,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        currency: 'VND',
        status: AccountingJournalBatchStatus.POSTED,
        totalDebit: 500000,
        totalCredit: 500000,
        postedAt: financeSmokeNow,
        reversedAt: null,
        createdById: admin.id,
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          originalSettlementSnapshotId: financeSmokeSettlement.id,
        },
      },
      create: {
        id: 'seed-finance-smoke-reversal-journal-batch',
        sourceKey: 'seed-finance-smoke-reversal-journal-batch',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        bookingId: financeSmokeBooking.id,
        customerProfileId: customer.customerProfile.id,
        providerProfileId: provider.providerProfile.id,
        paymentId: financeSmokePayment.id,
        settlementSnapshotId: financeSmokeSettlement.id,
        settlementReversalEntryId: financeSmokeReversal.id,
        monthlyPeriod: financeSmokeMonthlyPeriod,
        currency: 'VND',
        status: AccountingJournalBatchStatus.POSTED,
        totalDebit: 500000,
        totalCredit: 500000,
        postedAt: financeSmokeNow,
        createdById: admin.id,
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          originalSettlementSnapshotId: financeSmokeSettlement.id,
        },
      },
    });

    await prisma.accountingJournalEntry.upsert({
      where: { id: 'seed-finance-smoke-reversal-journal-entry-debit' },
      update: {
        batchId: financeSmokeReversalJournalBatch.id,
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: 'partner_receivable_negative_wallet',
        accountName: 'Partner receivable / negative wallet',
        amount: 390000,
        currency: 'VND',
        memo: 'Finance smoke refund after payout receivable entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        metadata: {
          smokeFixture: true,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
      create: {
        id: 'seed-finance-smoke-reversal-journal-entry-debit',
        batchId: financeSmokeReversalJournalBatch.id,
        side: AccountingJournalEntrySide.DEBIT,
        accountCode: 'partner_receivable_negative_wallet',
        accountName: 'Partner receivable / negative wallet',
        amount: 390000,
        currency: 'VND',
        memo: 'Finance smoke refund after payout receivable entry.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        metadata: {
          smokeFixture: true,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
    });

    await prisma.accountingJournalEntry.upsert({
      where: { id: 'seed-finance-smoke-reversal-journal-entry-credit' },
      update: {
        batchId: financeSmokeReversalJournalBatch.id,
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: 'customer_payment_clearing_asset',
        accountName: 'Customer payment clearing asset',
        amount: 390000,
        currency: 'VND',
        memo: 'Finance smoke refund after payout clearing offset.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        metadata: {
          smokeFixture: true,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
      create: {
        id: 'seed-finance-smoke-reversal-journal-entry-credit',
        batchId: financeSmokeReversalJournalBatch.id,
        side: AccountingJournalEntrySide.CREDIT,
        accountCode: 'customer_payment_clearing_asset',
        accountName: 'Customer payment clearing asset',
        amount: 390000,
        currency: 'VND',
        memo: 'Finance smoke refund after payout clearing offset.',
        sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT_REVERSAL,
        sourceId: financeSmokeReversal.id,
        metadata: {
          smokeFixture: true,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
    });

    await prisma.bookingPaymentClearingEntry.upsert({
      where: { sourceKey: 'seed-finance-smoke-reversal-clearing' },
      update: {
        type: BookingPaymentClearingEntryType.REFUND_REVERSAL,
        status: BookingPaymentClearingStatus.OPEN,
        bookingId: financeSmokeBooking.id,
        paymentId: financeSmokePayment.id,
        settlementSnapshotId: financeSmokeSettlement.id,
        settlementReversalEntryId: financeSmokeReversal.id,
        amount: -500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        clearedAt: null,
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          journalBatchSourceKey: financeSmokeReversalJournalBatch.sourceKey,
          originalSettlementSnapshotId: financeSmokeSettlement.id,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
      create: {
        id: 'seed-finance-smoke-reversal-clearing',
        sourceKey: 'seed-finance-smoke-reversal-clearing',
        type: BookingPaymentClearingEntryType.REFUND_REVERSAL,
        status: BookingPaymentClearingStatus.OPEN,
        bookingId: financeSmokeBooking.id,
        paymentId: financeSmokePayment.id,
        settlementSnapshotId: financeSmokeSettlement.id,
        settlementReversalEntryId: financeSmokeReversal.id,
        amount: -500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        metadata: {
          smokeFixture: true,
          refundAfterPayout: true,
          journalBatchSourceKey: financeSmokeReversalJournalBatch.sourceKey,
          originalSettlementSnapshotId: financeSmokeSettlement.id,
          settlementReversalEntryId: financeSmokeReversal.id,
        },
      },
    });

    const financeSmokeBankAccount = await prisma.companyBankAccount.upsert({
      where: { id: 'seed-finance-smoke-bank-account' },
      update: {
        name: 'HANDS Finance Smoke Account',
        bankName: 'Vietcombank',
        accountNumberMasked: '****3101',
        accountNumberLast4: '3101',
        currency: 'VND',
        status: CompanyBankAccountStatus.ACTIVE,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-bank-account',
        name: 'HANDS Finance Smoke Account',
        bankName: 'Vietcombank',
        accountNumberMasked: '****3101',
        accountNumberLast4: '3101',
        currency: 'VND',
        status: CompanyBankAccountStatus.ACTIVE,
        metadata: { smokeFixture: true },
      },
    });

    await prisma.companyBankTransaction.upsert({
      where: { sourceKey: 'seed-finance-smoke-bank-transaction' },
      update: {
        bankAccountId: financeSmokeBankAccount.id,
        type: CompanyBankTransactionType.INFLOW,
        amount: 500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        valueDate: financeSmokeNow,
        transferRef: 'FIN-SMOKE-3101',
        counterpartyName: 'Demo customer card processor',
        description: 'Finance smoke bank transaction for Admin detail route checks.',
        status: BankReconciliationStatus.UNMATCHED,
        metadata: { smokeFixture: true },
      },
      create: {
        id: 'seed-finance-smoke-bank-transaction',
        sourceKey: 'seed-finance-smoke-bank-transaction',
        bankAccountId: financeSmokeBankAccount.id,
        type: CompanyBankTransactionType.INFLOW,
        amount: 500000,
        currency: 'VND',
        occurredAt: financeSmokeNow,
        valueDate: financeSmokeNow,
        transferRef: 'FIN-SMOKE-3101',
        counterpartyName: 'Demo customer card processor',
        description: 'Finance smoke bank transaction for Admin detail route checks.',
        status: BankReconciliationStatus.UNMATCHED,
        metadata: { smokeFixture: true },
      },
    });
  }

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
