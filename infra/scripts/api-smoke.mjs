import jwt from 'jsonwebtoken';
import { createHmac, randomUUID } from 'node:crypto';
import {
  AccountingJournalBatchStatus,
  AccountingJournalSourceType,
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  BookingStatus,
  CompanyBankAccountStatus,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  PrismaClient,
  ProviderBankAccountStatus,
  ProviderWalletLedgerType,
  Role,
  ServiceCatalogProvenance,
  ServicePublicationStatus,
  TaxPolicyStatus,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  createApiSmokeBookingTracker,
  installApiSmokeProcessFailureHandlers,
  isStaleApiSmokeAddress,
  summarizeStaleApiSmokeBookings,
} from './lib/stale-api-smoke-bookings.mjs';
import { assertTaxPolicyFixtureWriteTarget } from './lib/tax-policy-fixture-write-target.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const apiSmokeStartedAt = new Date();
const apiSmokeRunId = randomUUID();
const apiSmokeRunKey = apiSmokeRunId.replaceAll('-', '_');
const apiSmokeBookingTracker = createApiSmokeBookingTracker();
const apiSmokeServiceIds = new Set();
const apiSmokeCompanyBankAccountIds = new Set();
let apiSmokeCleanupPromise;
let apiSmokeCompanyBankAccountCleanupPromise;
let apiSmokeServiceCleanupPromise;
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
if (env.NODE_ENV === 'production') {
  throw new Error('API smoke cannot create or activate company bank account fixtures in production.');
}
assertTaxPolicyFixtureWriteTarget(
  env.DATABASE_URL,
  env.TAX_POLICY_FIXTURE_WRITE_ALLOWLIST,
);

const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000/api';
const defaultCustomerCurrentLocation = {
  currentLat: 10.7769,
  currentLng: 106.7009,
};

function jwtAccessSecretFromEnv(sourceEnv) {
  const trimmed = sourceEnv.JWT_ACCESS_SECRET?.trim();
  if (trimmed && !['change-me', 'changeme', 'secret', 'password'].includes(trimmed.toLowerCase())) {
    return trimmed;
  }
  if (sourceEnv.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET must be configured before running API smoke in production.');
  }
  return 'dev-access-secret';
}

async function createSmokeAdminAuth(
  phone = env.API_SMOKE_ADMIN_PHONE ?? env.ADMIN_DEMO_PHONE ?? '+84900000099',
) {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.adminUserProvenance !== AdminUserProvenance.FIXTURE) {
      throw new Error(`Refusing to add smoke roles to non-fixture admin ${existing.id}.`);
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: existing.fullName ?? 'HANDS Smoke Admin',
            roles: {
              set: Array.from(
                new Set([...existing.roles, Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN]),
              ),
            },
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: 'API_SMOKE',
            fixtureRunId: apiSmokeRunId,
          },
        })
      : await prisma.user.create({
          data: {
            phone,
            fullName: 'HANDS Smoke Admin',
            roles: [Role.ADMIN, Role.FINANCE_APPROVER, Role.MASTER_ADMIN],
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: 'API_SMOKE',
            fixtureRunId: apiSmokeRunId,
          },
        });

    return {
      user,
      accessToken: jwt.sign(
        { sub: user.id, activeRole: Role.ADMIN, roles: user.roles },
        jwtAccessSecretFromEnv(env),
        { expiresIn: '30m' },
      ),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function createSmokeAdminOnlyAuth(phone = env.API_SMOKE_ADMIN_ONLY_PHONE ?? '+84900000097') {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.adminUserProvenance !== AdminUserProvenance.FIXTURE) {
      throw new Error(`Refusing to replace non-fixture admin roles for ${existing.id}.`);
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName: existing.fullName ?? 'HANDS Smoke Admin Without Finance Approver',
            roles: { set: [Role.ADMIN] },
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: 'API_SMOKE',
            fixtureRunId: apiSmokeRunId,
          },
        })
      : await prisma.user.create({
          data: {
            phone,
            fullName: 'HANDS Smoke Admin Without Finance Approver',
            roles: [Role.ADMIN],
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: 'API_SMOKE',
            fixtureRunId: apiSmokeRunId,
          },
        });

    await prisma.adminOperatorPermission.upsert({
      where: { userId: user.id },
      create: { userId: user.id, categories: [AdminOperatorPermissionCategory.FINANCE] },
      update: { categories: { set: [AdminOperatorPermissionCategory.FINANCE] } },
    });

    return {
      user,
      accessToken: jwt.sign(
        { sub: user.id, activeRole: Role.ADMIN, roles: user.roles },
        jwtAccessSecretFromEnv(env),
        { expiresIn: '30m' },
      ),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function expireResidualActiveApiSmokeBookings({
  customerProfileId,
  closedNote = 'Expired after a successful API smoke run.',
  closedReason = 'api_smoke_fixture_complete',
} = {}) {
  if (apiSmokeCleanupPromise) return apiSmokeCleanupPromise;

  apiSmokeCleanupPromise = expireResidualActiveApiSmokeBookingsOnce({
    closedNote,
    closedReason,
    customerProfileId,
  });
  return apiSmokeCleanupPromise;
}

async function expireResidualActiveApiSmokeBookingsOnce({ closedNote, closedReason, customerProfileId }) {
  const prisma = new PrismaClient();
  const activeStatuses = [
    BookingStatus.OPEN_MATCHING,
    BookingStatus.MATCHED,
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.ARRIVED,
    BookingStatus.IN_SERVICE,
  ];
  const trackedBookingIds = apiSmokeBookingTracker.snapshot();
  const candidateClauses = trackedBookingIds.length > 0 ? [{ id: { in: trackedBookingIds } }] : [];
  if (customerProfileId) {
    candidateClauses.push(
      {
        customerProfileId,
        addressSnapshot: {
          addressText: { endsWith: ' smoke flow', mode: 'insensitive' },
        },
      },
      {
        customerProfileId,
        addressSnapshot: {
          addressText: { startsWith: 'Realtime smoke ', mode: 'insensitive' },
        },
      },
    );
  }

  if (candidateClauses.length === 0) {
    await prisma.$disconnect();
    return { addresses: [], affectedProviderCount: 0, expired: 0, sources: [], statuses: [], total: 0 };
  }

  try {
    const broadCandidates = await prisma.booking.findMany({
      where: {
        createdAt: { gte: apiSmokeStartedAt },
        status: { in: activeStatuses },
        OR: candidateClauses,
      },
      select: {
        id: true,
        selectedProviderId: true,
        status: true,
        addressSnapshot: { select: { addressText: true } },
      },
    });
    const candidates = broadCandidates.flatMap((booking) => {
      const tracked = apiSmokeBookingTracker.has(booking.id);
      const explicitSmokeAddress = isStaleApiSmokeAddress(booking.addressSnapshot?.addressText);
      if (!tracked && !explicitSmokeAddress) return [];
      return [
        {
          ...booking,
          cleanupSource: tracked ? 'tracked_booking_id' : 'explicit_smoke_address',
        },
      ];
    });
    const candidateIds = candidates.map((booking) => booking.id);
    const expired = candidateIds.length
      ? (
          await prisma.booking.updateMany({
            where: { id: { in: candidateIds }, status: { in: activeStatuses } },
            data: {
              closedAt: new Date(),
              closedByRole: Role.SYSTEM,
              closedNote,
              closedReason,
              status: BookingStatus.EXPIRED,
            },
          })
        ).count
      : 0;

    return {
      expired,
      ...summarizeStaleApiSmokeBookings(candidates),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function registerApiSmokeServices(services, { published = false } = {}) {
  const ids = services.map((service) => service?.id).filter(Boolean);
  ids.forEach((id) => apiSmokeServiceIds.add(id));
  if (ids.length === 0) return;

  const prisma = new PrismaClient();
  try {
    await prisma.massageService.updateMany({
      where: { id: { in: ids } },
      data: {
        provenance: ServiceCatalogProvenance.SMOKE_TEST,
        provenanceRunId: apiSmokeRunId,
        publicationStatus: published
          ? ServicePublicationStatus.PUBLISHED
          : ServicePublicationStatus.DRAFT,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupApiSmokeServices() {
  if (apiSmokeServiceCleanupPromise) return apiSmokeServiceCleanupPromise;
  apiSmokeServiceCleanupPromise = cleanupApiSmokeServicesOnce();
  return apiSmokeServiceCleanupPromise;
}

async function cleanupApiSmokeServicesOnce() {
  const ids = [...apiSmokeServiceIds];
  if (ids.length === 0) return { archived: [], deleted: [], remainingIds: [] };

  const prisma = new PrismaClient();
  const archived = [];
  const deleted = [];
  try {
    const services = await prisma.massageService.findMany({
      where: { id: { in: ids } },
      select: { id: true, serviceGroupKey: true },
    });
    for (const service of services) {
      const bookingReferenceCount = await prisma.bookingService.count({
        where: { serviceId: service.id },
      });
      await prisma.servicePayoutRule.updateMany({
        where: { serviceId: service.id },
        data: { active: false },
      });
      if (bookingReferenceCount > 0) {
        await prisma.massageService.update({
          where: { id: service.id },
          data: {
            active: false,
            publicationStatus: ServicePublicationStatus.ARCHIVED,
            provenance: ServiceCatalogProvenance.SMOKE_TEST,
            provenanceRunId: apiSmokeRunId,
          },
        });
        archived.push({ id: service.id, bookingReferenceCount });
        continue;
      }

      await prisma.providerService.deleteMany({ where: { serviceId: service.id } });
      await prisma.servicePayoutRule.deleteMany({ where: { serviceId: service.id } });
      await prisma.massageService.delete({ where: { id: service.id } });
      deleted.push(service.id);
    }
    const groupKeys = services.map((service) => service.serviceGroupKey).filter(Boolean);
    if (groupKeys.length > 0) {
      await prisma.serviceCatalogDraft.deleteMany({
        where: { serviceGroupKey: { in: groupKeys } },
      });
    }
    const remainingIds = (
      await prisma.massageService.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      })
    ).map((service) => service.id);
    if (remainingIds.some((id) => !archived.some((entry) => entry.id === id))) {
      throw new Error(`API smoke service cleanup left unexpected rows: ${remainingIds.join(', ')}`);
    }
    return { archived, deleted, remainingIds };
  } finally {
    await prisma.$disconnect();
  }
}

async function registerApiSmokeCompanyBankAccount(accountId, fixtureType) {
  apiSmokeCompanyBankAccountIds.add(accountId);
  const prisma = new PrismaClient();
  try {
    const account = await prisma.companyBankAccount.findUnique({
      where: { id: accountId },
      select: { metadata: true },
    });
    if (!account) throw new Error(`API smoke company bank account not found: ${accountId}`);
    const metadata = account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
      ? account.metadata
      : {};
    await prisma.companyBankAccount.update({
      where: { id: accountId },
      data: {
        dataScope: 'SYNTHETIC',
        metadata: {
          ...metadata,
          fixture: true,
          fixtureRunId: apiSmokeRunId,
          fixtureType,
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupApiSmokeCompanyBankAccounts() {
  if (apiSmokeCompanyBankAccountCleanupPromise) return apiSmokeCompanyBankAccountCleanupPromise;
  apiSmokeCompanyBankAccountCleanupPromise = cleanupApiSmokeCompanyBankAccountsOnce();
  return apiSmokeCompanyBankAccountCleanupPromise;
}

async function cleanupApiSmokeCompanyBankAccountsOnce() {
  const ids = [...apiSmokeCompanyBankAccountIds];
  if (ids.length === 0) return { deleted: [], retained: [] };
  const prisma = new PrismaClient();
  const deleted = [];
  const retained = [];
  try {
    for (const id of ids) {
      const account = await prisma.companyBankAccount.findUnique({
        where: { id },
        select: {
          id: true,
          metadata: true,
          _count: { select: { transactions: true } },
        },
      });
      if (!account) continue;
      const metadata = account.metadata && typeof account.metadata === 'object' && !Array.isArray(account.metadata)
        ? account.metadata
        : {};
      const ownedByRun = metadata.fixture === true && metadata.fixtureRunId === apiSmokeRunId;
      if (!ownedByRun || account._count.transactions > 0) {
        retained.push({ id, reason: ownedByRun ? 'referenced' : 'not-owned-by-run' });
        continue;
      }
      await prisma.$transaction([
        prisma.adminAuditLog.deleteMany({ where: { target: `company_bank_account:${id}` } }),
        prisma.companyBankAccount.delete({ where: { id } }),
      ]);
      deleted.push(id);
    }
    return { deleted, retained };
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupApiSmokeFixtures(options = {}) {
  const [bookings, companyBankAccounts, services] = await Promise.all([
    expireResidualActiveApiSmokeBookings(options),
    cleanupApiSmokeCompanyBankAccounts(),
    cleanupApiSmokeServices(),
  ]);
  return { bookings, companyBankAccounts, services };
}

function installApiSmokeFailureCleanup() {
  installApiSmokeProcessFailureHandlers({
    cleanup: (origin) =>
      cleanupApiSmokeFixtures({
        closedNote: `Expired after API smoke ${origin}.`,
        closedReason: 'api_smoke_fixture_interrupted',
      }),
    exit: (exitCode) => process.exit(exitCode),
    processTarget: process,
    report: (payload) => console.error(JSON.stringify(payload, null, 2)),
  });
}

async function ensureSmokeCompanyBankAccount() {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.companyBankAccount.findFirst({
      where: {
        currency: 'VND',
        name: 'HANDS Smoke VND Account',
        status: CompanyBankAccountStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      const metadata = existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? existing.metadata
        : {};
      await prisma.companyBankAccount.update({
        where: { id: existing.id },
        data: {
          metadata: {
            ...metadata,
            dataScope: 'synthetic',
            fixture: true,
            fixtureType: 'api-smoke-stable-reconciliation',
          },
        },
      });
      return existing;
    }

    return prisma.companyBankAccount.create({
      data: {
        accountNumberLast4: '0001',
        accountNumberMasked: '•••• 0001',
        bankName: 'Smoke Bank',
        currency: 'VND',
        metadata: {
          dataScope: 'synthetic',
          fixture: true,
          fixtureRunId: apiSmokeRunId,
          fixtureType: 'api-smoke-stable-reconciliation',
          smoke: true,
        },
        name: 'HANDS Smoke VND Account',
        status: CompanyBankAccountStatus.ACTIVE,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureSmokeProviderWalletWithdrawalPrerequisites(providerProfileId, walletCreditAmount) {
  const prisma = new PrismaClient();
  const sourceKey = `api-smoke:provider-wallet-withdrawal-credit:${providerProfileId}`;

  try {
    const bankAccount = await prisma.providerBankAccount.create({
      data: {
        accountHolderName: 'HANDS Smoke Provider',
        accountNumberLast4: '7711',
        accountNumberMasked: '****7711',
        bankName: 'Smoke Bank',
        isPrimary: true,
        providerProfileId,
        qrBankingInfo: { smoke: true, purpose: 'provider-wallet-withdrawal-paid-lifecycle' },
        reviewedAt: new Date(),
        status: ProviderBankAccountStatus.APPROVED,
      },
    });
    const walletLedger = await prisma.providerWalletLedgerEntry.upsert({
      where: { sourceKey },
      update: {
        amount: walletCreditAmount,
        currency: 'VND',
        metadata: { smoke: true, purpose: 'provider-wallet-withdrawal-paid-lifecycle' },
        notes: 'API smoke partner wallet withdrawal available balance.',
        reference: `SMOKE-WITHDRAWAL-SEED-${providerProfileId.slice(-6)}`,
        type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
      },
      create: {
        amount: walletCreditAmount,
        currency: 'VND',
        metadata: { smoke: true, purpose: 'provider-wallet-withdrawal-paid-lifecycle' },
        notes: 'API smoke partner wallet withdrawal available balance.',
        providerProfileId,
        reference: `SMOKE-WITHDRAWAL-SEED-${providerProfileId.slice(-6)}`,
        sourceKey,
        type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
      },
    });

    return { bankAccount, walletLedger };
  } finally {
    await prisma.$disconnect();
  }
}

async function findProviderWalletLedgerEntryBySourceKey(sourceKey) {
  const prisma = new PrismaClient();

  try {
    return prisma.providerWalletLedgerEntry.findUnique({ where: { sourceKey } });
  } finally {
    await prisma.$disconnect();
  }
}

async function assertMonthlyCloseBlocksOpenJournalDelta(adminAccessToken) {
  const prisma = new PrismaClient();
  const period = '2099-12';
  const sourceKey = 'api-smoke:monthly-close:blocking-journal-delta';

  try {
    await prisma.accountingJournalBatch.deleteMany({ where: { sourceKey } });
    await prisma.accountingJournalBatch.create({
      data: {
        currency: 'VND',
        entries: {
          create: [
            {
              accountCode: 'settlement_reconciliation_delta',
              accountName: 'Settlement reconciliation delta',
              amount: 42000,
              currency: 'VND',
              memo: 'API smoke journal delta that must block monthly close.',
              side: 'DEBIT',
              sourceId: sourceKey,
              sourceType: AccountingJournalSourceType.MANUAL_WALLET_ADJUSTMENT,
            },
          ],
        },
        metadata: { reconciliationDelta: 42000, smoke: true },
        monthlyPeriod: period,
        sourceId: sourceKey,
        sourceKey,
        sourceType: AccountingJournalSourceType.MANUAL_WALLET_ADJUSTMENT,
        status: AccountingJournalBatchStatus.POSTED,
        totalCredit: 0,
        totalDebit: 42000,
      },
    });

    const failureMessage = await expectRequestFailure(
      'Monthly close should reject posted journal reconciliation delta',
      () =>
        patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
          status: 'REVIEWED',
          notes: 'API smoke should be blocked while a posted journal delta remains open.',
        }),
      400,
    );
    if (
      !failureMessage.includes(
        'Monthly close requires posted journal reconciliation deltas to be cleared before status can advance.',
      )
    ) {
      throw new Error(`Monthly close journal delta failure used an unexpected message: ${failureMessage}`);
    }

    return true;
  } finally {
    await prisma.accountingJournalBatch.deleteMany({ where: { sourceKey } });
    await prisma.$disconnect();
  }
}

async function assertWithholdingRemittanceLifecycle({
  adminAccessToken,
  bookingId,
  customerProfileId,
  financeApproverId,
  nonFinanceApprovalAdminId,
  providerProfileId,
  remittedByAdminId,
}) {
  const prisma = new PrismaClient();
  const period = '2099-11';
  const currency = 'VND';
  const snapshotSourceKey = 'api-smoke:withholding-remittance:settlement-snapshot';
  const remittanceJournalSourceKey = `accounting-journal:withholding-remittance:${period}:${currency}`;
  const remittanceTransferRef = `SMOKE-WHT-${Date.now()}`;
  const remittanceEvidenceUrl = 'https://evidence.example.test/api-smoke/withholding-remittance.pdf';
  const partnerWithholdingTotal = 105000;
  let paymentFeePolicyVersionId = null;

  try {
    await prisma.accountingJournalBatch.deleteMany({
      where: { OR: [{ sourceKey: remittanceJournalSourceKey }, { monthlyPeriod: period }] },
    });
    await prisma.bookingSettlementSnapshot.deleteMany({ where: { sourceKey: snapshotSourceKey } });
    await prisma.monthlyTaxClosing.deleteMany({ where: { period, currency } });
    const paymentFeePolicy = await prisma.paymentFeePolicyVersion.create({
      data: {
        name: `API smoke CARD payment fee ${Date.now()}`,
        status: TaxPolicyStatus.ACTIVE,
        effectiveFrom: new Date('2099-11-01T00:00:00.000Z'),
        effectiveTo: new Date('2099-11-30T23:59:59.999Z'),
        notes: 'Temporary payment fee evidence for withholding remittance lifecycle smoke.',
        rules: {
          create: {
            method: PaymentMethod.CARD,
            feeType: PaymentFeeRuleType.RATE,
            rateBps: 0,
            fixedAmount: 0,
            payer: PaymentFeePayer.HANDS,
            treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
          },
        },
      },
      include: { rules: true },
    });
    paymentFeePolicyVersionId = paymentFeePolicy.id;
    const paymentFeeRule = paymentFeePolicy.rules[0];
    if (!paymentFeeRule) {
      throw new Error('Withholding remittance smoke payment fee policy did not create its CARD rule.');
    }
    await prisma.bookingSettlementSnapshot.create({
      data: {
        sourceKey: snapshotSourceKey,
        bookingId,
        customerProfileId,
        providerProfileId,
        paymentMethod: 'CARD',
        currency,
        customerPaymentAmount: 1000000,
        partnerPayoutAmount: 700000,
        partnerTaxableRevenue: 700000,
        partnerVatRateBps: 1000,
        partnerVatAmount: 70000,
        partnerPitRateBps: 500,
        partnerPitAmount: 35000,
        partnerWithholdingTotal,
        platformFeeGross: 195000,
        platformVatRateBps: 1000,
        platformFeeNetRevenue: 177273,
        companyOutputVat: 17727,
        paymentFeePolicyVersionId,
        paymentFeeRateBps: paymentFeeRule.rateBps,
        paymentFeeFixedAmount: paymentFeeRule.fixedAmount,
        paymentProcessingFee: 0,
        paymentFeePayer: paymentFeeRule.payer,
        paymentFeeTreatment: paymentFeeRule.treatment,
        paymentFeeRuleSnapshot: {
          policyName: paymentFeePolicy.name,
          ruleId: paymentFeeRule.id,
          method: paymentFeeRule.method,
          feeType: paymentFeeRule.feeType,
          rateBps: paymentFeeRule.rateBps,
          fixedAmount: paymentFeeRule.fixedAmount,
          payer: paymentFeeRule.payer,
          treatment: paymentFeeRule.treatment,
        },
        monthlyPeriod: period,
        metadata: {
          smoke: true,
          purpose: 'withholding-remittance-paid-lifecycle',
        },
      },
    });

    await patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
      status: 'REVIEWED',
      notes: 'API smoke withholding remittance reviewed lifecycle.',
    });
    await patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
      status: 'DECLARED',
      notes: 'API smoke withholding remittance declared lifecycle.',
    });
    const sameAdminFailure = await expectRequestFailure(
      'Withholding remittance paid closeout rejects same-admin approval',
      () =>
        patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
          status: 'PAID',
          approvalAdminId: remittedByAdminId,
          notes: 'API smoke same-admin withholding remittance guard.',
          paidAt: '2099-11-30T10:00:00.000Z',
          remittanceChannel: 'MANUAL_BANK_TRANSFER',
          remittanceEvidenceUrl,
          remittanceTransferRef,
        }),
      400,
    );
    if (
      !sameAdminFailure.includes(
        'Partner withholding remittance paid closeout requires approval from a different admin',
      )
    ) {
      throw new Error(
        `Withholding remittance same-admin guard returned unexpected message: ${sameAdminFailure}`,
      );
    }
    const nonFinanceFailure = await expectRequestFailure(
      'Withholding remittance paid closeout rejects non-finance approver',
      () =>
        patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
          status: 'PAID',
          approvalAdminId: nonFinanceApprovalAdminId,
          notes: 'API smoke non-finance withholding remittance guard.',
          paidAt: '2099-11-30T10:00:00.000Z',
          remittanceChannel: 'MANUAL_BANK_TRANSFER',
          remittanceEvidenceUrl,
          remittanceTransferRef,
        }),
      400,
    );
    if (
      !nonFinanceFailure.includes(
        'Partner withholding remittance paid closeout requires approval from a finance approver',
      )
    ) {
      throw new Error(
        `Withholding remittance non-finance guard returned unexpected message: ${nonFinanceFailure}`,
      );
    }
    const closing = await patchJson(`/admin/monthly-tax-closings/${period}/status`, adminAccessToken, {
      status: 'PAID',
      approvalAdminId: financeApproverId,
      notes: 'API smoke withholding remittance paid lifecycle.',
      paidAt: '2099-11-30T10:00:00.000Z',
      remittanceChannel: 'MANUAL_BANK_TRANSFER',
      remittanceEvidenceUrl,
      remittanceTransferRef,
    });

    if (
      closing.status !== 'PAID' ||
      closing.period !== period ||
      closing.partnerWithholdingTotal !== partnerWithholdingTotal ||
      closing.remittanceMetadata?.transferRef !== remittanceTransferRef ||
      closing.remittanceMetadata?.evidenceUrl !== remittanceEvidenceUrl ||
      closing.remittanceMetadata?.approvedByAdminId !== financeApproverId ||
      closing.remittanceMetadata?.remittedByAdminId !== remittedByAdminId
    ) {
      throw new Error(
        `Withholding remittance paid closeout response is incomplete: ${JSON.stringify(closing)}`,
      );
    }

    const remittanceJournalSummary = (
      await getJson('/admin/accounting-journal-batches?range=all&review=posted&take=100', adminAccessToken)
    ).find(
      (journal) =>
        journal.sourceKey === remittanceJournalSourceKey &&
        journal.sourceType === 'WITHHOLDING_REMITTANCE' &&
        journal.status === 'POSTED',
    );
    if (
      !remittanceJournalSummary ||
      remittanceJournalSummary.totalDebit !== partnerWithholdingTotal ||
      remittanceJournalSummary.totalCredit !== partnerWithholdingTotal
    ) {
      throw new Error(
        `Withholding remittance journal was not posted with balanced totals: ${JSON.stringify({
          remittanceJournalSummary,
          closing,
        })}`,
      );
    }

    const remittanceJournal = await getJson(
      `/admin/accounting-journal-batches/${remittanceJournalSummary.id}`,
      adminAccessToken,
    );
    assertBalancedAccountingJournal('Withholding remittance journal', remittanceJournal);
    assertJournalEntry('Withholding remittance journal', remittanceJournal, {
      accountCode: 'partner_vat_pit_payable',
      amount: partnerWithholdingTotal,
      side: 'DEBIT',
    });
    assertJournalEntry('Withholding remittance journal', remittanceJournal, {
      accountCode: 'company_bank_cash',
      amount: partnerWithholdingTotal,
      side: 'CREDIT',
    });

    return true;
  } finally {
    await prisma.accountingJournalBatch.deleteMany({
      where: { OR: [{ sourceKey: remittanceJournalSourceKey }, { monthlyPeriod: period }] },
    });
    await prisma.bookingSettlementSnapshot.deleteMany({ where: { sourceKey: snapshotSourceKey } });
    await prisma.monthlyTaxClosing.deleteMany({ where: { period, currency } });
    if (paymentFeePolicyVersionId) {
      await prisma.paymentFeeRule.deleteMany({ where: { policyVersionId: paymentFeePolicyVersionId } });
      await prisma.paymentFeePolicyVersion.deleteMany({ where: { id: paymentFeePolicyVersionId } });
    }
    await prisma.$disconnect();
  }
}

let smokePhoneSequence = 0;
function uniqueSmokePhone(prefix = '+849') {
  smokePhoneSequence += 1;
  const seed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000) + BigInt(smokePhoneSequence);
  return `${prefix}${String(seed).slice(-8)}`;
}

async function request(path, options = {}) {
  const { retryRateLimit = true, ...fetchOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...fetchOptions,
    headers: { 'content-type': 'application/json', ...(fetchOptions.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429 && retryRateLimit) {
      const retryAfterSeconds = Number(body.retryAfterSeconds ?? response.headers.get('retry-after') ?? 30);
      await sleep(Math.max(1, retryAfterSeconds) * 1000);
      return request(path, { ...options, retryRateLimit: false });
    }
    throw new Error(
      `${fetchOptions.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

const patchJson = (path, accessToken, body, extraHeaders = {}) =>
  request(path, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}`, ...extraHeaders },
    body: JSON.stringify(body),
  });

const postJson = async (path, accessToken, body = {}) => {
  const response = await request(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(applyBookingAttemptLocationDefaults(path, body)),
  });
  apiSmokeBookingTracker.record(path, response);
  return response;
};

function createSmokeUploadBody(contentType, sizeBytes) {
  const body = Buffer.alloc(sizeBytes);
  if (contentType === 'image/jpeg') {
    Buffer.from([0xff, 0xd8, 0xff]).copy(body);
  } else if (contentType === 'image/png') {
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(body);
  } else if (contentType === 'image/webp') {
    body.write('RIFF', 0, 'ascii');
    body.write('WEBP', 8, 'ascii');
  } else if (contentType === 'video/mp4') {
    body.write('ftyp', 4, 'ascii');
  }
  return body;
}

async function completeSmokeUpload(upload, accessToken, sizeBytes) {
  if (upload.storageMode !== 'placeholder') {
    const contentType = upload.upload?.headers?.['content-type'] ?? upload.file?.contentType;
    const uploadUrl = upload.upload?.url;
    if (!contentType || !uploadUrl) {
      throw new Error(`Presigned upload contract is incomplete: ${JSON.stringify(upload)}`);
    }
    const response = await fetch(new URL(uploadUrl, apiBaseUrl), {
      method: upload.upload.method ?? 'PUT',
      headers: upload.upload.headers,
      body: createSmokeUploadBody(contentType, sizeBytes),
    });
    if (!response.ok) {
      throw new Error(`Storage upload failed: ${response.status} ${await response.text()}`);
    }
  }

  return postJson(`/files/${upload.file.id}/complete`, accessToken, { sizeBytes });
}

async function completeBooking(bookingId, providerAccessToken) {
  return postJson(`/provider/bookings/${bookingId}/complete`, providerAccessToken, {
    lat: 10.7769,
    lng: 106.7009,
    addressText: 'District 1, Ho Chi Minh City',
  });
}

const getJson = (path, accessToken) =>
  request(path, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

const operationalPolicyPath = (key) => `/admin/operational-policy/${encodeURIComponent(key)}`;

async function getOperationalPolicyValue(accessToken, key) {
  const settings = await getJson('/admin/operational-policy', accessToken);
  return settings.find((setting) => setting.key === key)?.value;
}

async function assertOperationalPolicyMetadata(accessToken) {
  const settings = await getJson('/admin/operational-policy', accessToken);
  const requiredLivePolicyKeys = [
    'matching.provider_response_window_minutes',
    'matching.marketplace_partner_radius_meters',
    'matching.marketplace_partner_location_max_age_minutes',
    'matching.marketplace_partner_invitation_limit',
    'matching.travel_buffer_minutes',
    'matching.preferred_accept_mode',
    'matching.marketplace_open_mode',
    'booking.max_customer_current_to_booking_address_km',
    'booking.max_preferred_partner_distance_km',
    'booking.current_location_freshness_minutes',
    'booking.distance_gate_enabled',
    'booking.service_area_required',
    'wallet.negative_balance_gate',
    'decision.action_evidence_gate_mode',
    'cash.settlement_clearance_policy',
    'payout.batch_cycle_policy',
    'matching.first_pick_expiry_action_policy',
    'cancellation.after_match_policy',
    'no_show.evidence_requirement_policy',
    'no_show.partner_report_policy',
    'notification.partner_alert_channel',
  ];
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const missingLivePolicies = requiredLivePolicyKeys.filter((key) => !settingsByKey.has(key));
  const unenforcedLivePolicies = requiredLivePolicyKeys.filter(
    (key) => settingsByKey.get(key)?.enforced !== true,
  );
  const optionPolicyKeys = [
    'matching.marketplace_open_mode',
    'wallet.negative_balance_gate',
    'decision.action_evidence_gate_mode',
    'cash.settlement_clearance_policy',
    'payout.batch_cycle_policy',
    'matching.first_pick_expiry_action_policy',
    'cancellation.after_match_policy',
    'no_show.evidence_requirement_policy',
    'no_show.partner_report_policy',
    'notification.partner_alert_channel',
  ];
  const missingPolicyOptions = optionPolicyKeys.filter((key) => {
    const options = settingsByKey.get(key)?.options;
    return !Array.isArray(options) || options.length < 2;
  });

  if (missingLivePolicies.length || unenforcedLivePolicies.length || missingPolicyOptions.length) {
    throw new Error(
      `Operational policy metadata is incomplete: ${JSON.stringify({
        missingLivePolicies,
        unenforcedLivePolicies,
        missingPolicyOptions,
      })}`,
    );
  }
}

const patchOperationalPolicyValue = async (
  accessToken,
  key,
  value,
  { restoration = false } = {},
) => {
  const expectedValue = await getOperationalPolicyValue(accessToken, key);
  if (expectedValue === value) return;

  const smokeEnvironment = env.NODE_ENV?.trim() || 'development';
  const smokeSecret =
    env.API_SMOKE_AUDIT_SECRET?.trim() ||
    (env.NODE_ENV === 'production' ? '' : jwtAccessSecretFromEnv(env));
  if (!smokeSecret) {
    throw new Error('API_SMOKE_AUDIT_SECRET is required for production operational policy smoke.');
  }
  const signature = createHmac('sha256', smokeSecret)
    .update(`${apiSmokeRunId}\n${smokeEnvironment}\n${restoration ? 'restore' : 'change'}`)
    .digest('hex');

  await patchJson(
    operationalPolicyPath(key),
    accessToken,
    {
      expectedValue,
      value,
      reason: `Automated smoke coverage for ${key}`,
    },
    {
      'x-hands-smoke-environment': smokeEnvironment,
      'x-hands-smoke-restoration': restoration ? 'true' : 'false',
      'x-hands-smoke-run-id': apiSmokeRunId,
      'x-hands-smoke-signature': signature,
    },
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function applyBookingAttemptLocationDefaults(path, body) {
  if (path !== '/customer/bookings' || !body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  if ('currentLat' in body || 'currentLng' in body || 'currentLocationUpdatedAt' in body) {
    return body;
  }
  return {
    ...body,
    ...defaultCustomerCurrentLocation,
    currentLocationUpdatedAt: new Date().toISOString(),
  };
}

async function expectRequestFailure(label, fn, expectedStatus) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(`failed: ${expectedStatus}`)) {
      throw new Error(`${label} failed with an unexpected error: ${message}`);
    }
    return message;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

function assertNegativeWalletBlockResponse(label, message) {
  const requiredMarkers = [
    '"code":"PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT"',
    '"walletBlocked":true',
    '"marketplaceVisibilityBlocked":false',
    '"marketplaceJoinBlocked":false',
    '"directFirstPickBlocked":true',
    '"alreadyMatchedServiceBlocked":true',
    '"payoutReleaseBlocked":true',
    '"walletDebtAmount":',
    '"walletSettlementRequired":true',
    '"walletSettlementMethod":"PROVIDER_DEPOSIT_OR_ADMIN_OFFSET"',
    '"walletSettlementReference":"HANDS-WALLET-',
    '"displayMessage":"Phí HANDS chưa được thanh toán nên bạn chưa thể xác nhận nhận lịch này."',
    'Bạn vẫn có thể xem và tham gia yêu cầu đặt lịch',
    'Quyền tham gia đặt lịch và nhận tiền chi trả',
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !message.includes(marker));
  if (missingMarkers.length) {
    throw new Error(
      `Negative wallet ${label} response is missing settlement guidance markers: ${JSON.stringify({
        missingMarkers,
        message,
      })}`,
    );
  }
}

async function approvePartnerBookingReadiness(providerAuth, adminAccessToken, label) {
  const providerProfileId = providerAuth.user.providerProfile.id;
  await postJson(`/admin/partners/${providerProfileId}/approve`, adminAccessToken);

  const onboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
  if (onboarding.kyc?.status !== 'APPROVED') {
    const requiredDocumentTypes = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
    const documentPayload = [];
    for (const type of requiredDocumentTypes) {
      const existing = onboarding.documents?.find(
        (document) => document.type === type && document.status !== 'REJECTED',
      );
      if (!existing) {
        const upload = await postJson('/files/presign', providerAuth.accessToken, {
          contentType: 'image/jpeg',
          visibility: 'PRIVATE',
          purpose: 'provider-verification',
        });
        await completeSmokeUpload(upload, providerAuth.accessToken, 1024);
        documentPayload.push({ fileId: upload.file.id, type });
      }
    }

    await postJson('/provider/onboarding/kyc/submit', providerAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: documentPayload,
    });
    await postJson(`/admin/partners/${providerProfileId}/kyc/approve`, adminAccessToken);
  }

  const ready = await getJson('/provider/onboarding', providerAuth.accessToken);
  if (ready.kyc?.status !== 'APPROVED') {
    throw new Error(`${label} partner booking readiness setup failed: ${JSON.stringify(ready)}`);
  }
  assertRequiredKycDocumentsApproved(label, ready);
  return ready;
}

function assertRequiredKycDocumentsApproved(label, onboarding) {
  const requiredDocumentTypes = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
  const unapprovedTypes = requiredDocumentTypes.filter(
    (type) =>
      !onboarding.documents?.some((document) => document.type === type && document.status === 'APPROVED'),
  );
  if (unapprovedTypes.length > 0) {
    throw new Error(
      `${label} overall KYC approval did not approve every required document: ${JSON.stringify({
        unapprovedTypes,
      })}`,
    );
  }
}

function firstBookingServiceLine(booking) {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return services.length > 0 && services[0] && typeof services[0] === 'object' ? services[0] : null;
}

function assertBookingPricing(label, booking, expected) {
  const serviceLine = firstBookingServiceLine(booking);
  const payment = booking?.payment;
  if (!serviceLine || serviceLine.price !== expected.customerPrice) {
    throw new Error(
      `${label} booking service price mismatch: ${JSON.stringify({
        expected,
        serviceLine,
        bookingId: booking?.id,
      })}`,
    );
  }
  if (payment?.amount !== expected.paymentAmount) {
    throw new Error(
      `${label} payment amount mismatch: ${JSON.stringify({
        expected,
        payment,
        bookingId: booking?.id,
      })}`,
    );
  }
}

function assertBookingMatchingWindow(label, booking, expectedMinutes) {
  const expiresAtMs = Date.parse(booking?.expiresAt ?? '');
  const openedAtMs = Date.parse(booking?.openedAt ?? booking?.createdAt ?? '');
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(openedAtMs)) {
    throw new Error(`${label} matching window is missing timestamps: ${JSON.stringify(booking)}`);
  }
  const windowMinutes = Math.round((expiresAtMs - openedAtMs) / 60_000);
  if (windowMinutes !== expectedMinutes) {
    throw new Error(
      `${label} matching window mismatch: ${JSON.stringify({
        expectedMinutes,
        windowMinutes,
        openedAt: booking.openedAt,
        expiresAt: booking.expiresAt,
      })}`,
    );
  }
  if (booking.earlyAcceptMin !== expectedMinutes) {
    throw new Error(
      `${label} earlyAcceptMin should match the provider response window: ${JSON.stringify(booking)}`,
    );
  }
}

installApiSmokeFailureCleanup();

const health = await request('/health');
const readiness = await request('/health/ready');
if (!health.ok || !readiness.ok) {
  throw new Error(`API is not ready: ${JSON.stringify({ health, readiness })}`);
}
const customerAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: '+84900000001', otp: '123456', role: 'CUSTOMER' }),
});

const providerAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: uniqueSmokePhone('+849'), otp: '123456', role: 'PROVIDER' }),
});

const backupProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: uniqueSmokePhone('+849'), otp: '123456', role: 'PROVIDER' }),
});

const kycNegativeProviderPhone = uniqueSmokePhone('+849');
const kycNegativeProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: kycNegativeProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const walletDebtProviderPhone = uniqueSmokePhone('+848');
const walletDebtProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: walletDebtProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const distanceGateProviderPhone = uniqueSmokePhone('+847');
const distanceGateProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: distanceGateProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const narrowRadiusProviderPhone = uniqueSmokePhone('+846');
const narrowRadiusProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: narrowRadiusProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const legacyPolicyProviderPhone = uniqueSmokePhone('+845');
const legacyPolicyProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: legacyPolicyProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const fcmPolicyProviderPhone = uniqueSmokePhone('+844');
const fcmPolicyProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: fcmPolicyProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const preferredAcceptProviderPhone = uniqueSmokePhone('+843');
const preferredAcceptProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: preferredAcceptProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const afterMatchCancellationProviderPhone = uniqueSmokePhone('+842');
const afterMatchCancellationProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: afterMatchCancellationProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const walletDebtServiceGateProviderPhone = uniqueSmokePhone('+841');
const walletDebtServiceGateProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: walletDebtServiceGateProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const withdrawalProviderPhone = uniqueSmokePhone('+840');
const withdrawalProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: withdrawalProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const adminAuth = await createSmokeAdminAuth();
const externalReadiness = await request('/health/external', {
  headers: { authorization: `Bearer ${adminAuth.accessToken}` },
});
const expectedExternalCategories = ['mobile', 'supabase', 'maps', 'payments', 'storage', 'sms', 'push'];
const externalCategories = new Set((externalReadiness.checks ?? []).map((check) => check.category));
const missingExternalCategories = expectedExternalCategories.filter(
  (category) => !externalCategories.has(category),
);
if (missingExternalCategories.length > 0) {
  throw new Error(
    `External readiness is missing categories: ${JSON.stringify({
      missingExternalCategories,
      externalReadiness,
    })}`,
  );
}
const financeApproverAuth = await createSmokeAdminAuth(
  env.API_SMOKE_FINANCE_APPROVER_PHONE ?? '+84900000098',
);
const nonFinanceAdminAuth = await createSmokeAdminOnlyAuth();

const monthlyCloseOpenJournalDeltaBlocked = await assertMonthlyCloseBlocksOpenJournalDelta(
  adminAuth.accessToken,
);

await assertOperationalPolicyMetadata(adminAuth.accessToken);

const providerWalletWithdrawalAmount = 120000;
const adminProviderWalletWithdrawalRequestsPath = '/admin/provider-wallet/withdrawal-requests';
const providerWalletWithdrawalSeed = await ensureSmokeProviderWalletWithdrawalPrerequisites(
  withdrawalProviderAuth.user.providerProfile.id,
  providerWalletWithdrawalAmount * 2,
);
const providerWalletWithdrawalRequest = await postJson(
  '/partner/earnings/wallet-withdrawal-requests',
  withdrawalProviderAuth.accessToken,
  {
    amount: providerWalletWithdrawalAmount,
    bankAccountId: providerWalletWithdrawalSeed.bankAccount.id,
    requestNote: 'API smoke partner wallet withdrawal paid lifecycle.',
  },
);
if (
  providerWalletWithdrawalRequest.status !== 'REQUESTED' ||
  providerWalletWithdrawalRequest.amount !== providerWalletWithdrawalAmount ||
  providerWalletWithdrawalRequest.bankAccountId !== providerWalletWithdrawalSeed.bankAccount.id
) {
  throw new Error(
    `Provider wallet withdrawal request was not created from partner API: ${JSON.stringify({
      providerWalletWithdrawalRequest,
      providerWalletWithdrawalSeed,
    })}`,
  );
}
let providerWalletWithdrawalDualApprovalGuardsReady = false;
const providerWalletWithdrawalApproved = await patchJson(
  `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
  adminAuth.accessToken,
  {
    adminNote: 'API smoke approved partner wallet withdrawal.',
    status: 'APPROVED',
  },
);
if (providerWalletWithdrawalApproved.status !== 'APPROVED') {
  throw new Error(
    `Provider wallet withdrawal request was not approved: ${JSON.stringify(providerWalletWithdrawalApproved)}`,
  );
}
const providerWalletWithdrawalTransferRef = `SMOKE-WITHDRAWAL-${Date.now()}`;
const providerWalletWithdrawalBankTransferDate = new Date().toISOString();
const providerWalletWithdrawalEvidenceUrl =
  'https://evidence.example.test/api-smoke/provider-wallet-withdrawal.pdf';
const providerWalletWithdrawalMissingTransferFailure = await expectRequestFailure(
  'Provider wallet withdrawal transfer submission requires transfer ref',
  () =>
    patchJson(
      `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
      adminAuth.accessToken,
      {
        attachmentUrl: providerWalletWithdrawalEvidenceUrl,
        bankTransferDate: providerWalletWithdrawalBankTransferDate,
        status: 'BANK_TRANSFER_PENDING',
      },
    ),
  400,
);
if (
  !providerWalletWithdrawalMissingTransferFailure.includes(
    'Provider wallet withdrawal bank transfer request requires a transfer reference',
  )
) {
  throw new Error(
    `Provider wallet withdrawal missing transfer guard returned unexpected message: ${providerWalletWithdrawalMissingTransferFailure}`,
  );
}
const providerWalletWithdrawalMissingEvidenceFailure = await expectRequestFailure(
  'Provider wallet withdrawal transfer submission requires bank evidence',
  () =>
    patchJson(
      `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
      adminAuth.accessToken,
      {
        bankTransferDate: providerWalletWithdrawalBankTransferDate,
        status: 'BANK_TRANSFER_PENDING',
        transferRef: providerWalletWithdrawalTransferRef,
      },
    ),
  400,
);
if (
  !providerWalletWithdrawalMissingEvidenceFailure.includes(
    'Provider wallet withdrawal bank transfer request requires attached bank evidence',
  )
) {
  throw new Error(
    `Provider wallet withdrawal missing evidence guard returned unexpected message: ${providerWalletWithdrawalMissingEvidenceFailure}`,
  );
}
const providerWalletWithdrawalPending = await patchJson(
  `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
  adminAuth.accessToken,
  {
    attachmentUrl: providerWalletWithdrawalEvidenceUrl,
    bankTransferDate: providerWalletWithdrawalBankTransferDate,
    adminNote: 'API smoke withdrawal bank transfer pending.',
    status: 'BANK_TRANSFER_PENDING',
    transferRef: providerWalletWithdrawalTransferRef,
  },
);
if (providerWalletWithdrawalPending.status !== 'BANK_TRANSFER_PENDING') {
  throw new Error(
    `Provider wallet withdrawal request was not moved to bank-transfer pending: ${JSON.stringify(
      providerWalletWithdrawalPending,
    )}`,
  );
}
const providerWalletWithdrawalSameAdminFailure = await expectRequestFailure(
  'Provider wallet withdrawal paid closeout rejects its maker',
  () =>
    patchJson(
      `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
      adminAuth.accessToken,
      { status: 'PAID' },
    ),
  400,
);
if (
  !providerWalletWithdrawalSameAdminFailure.includes(
    'Provider wallet withdrawal paid closeout requires approval from a different admin',
  )
) {
  throw new Error(
    `Provider wallet withdrawal same-admin guard returned unexpected message: ${providerWalletWithdrawalSameAdminFailure}`,
  );
}
const providerWalletWithdrawalNonFinanceFailure = await expectRequestFailure(
  'Provider wallet withdrawal paid closeout rejects a non-finance operator',
  () =>
    patchJson(
      `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
      nonFinanceAdminAuth.accessToken,
      { status: 'PAID' },
    ),
  400,
);
if (
  !providerWalletWithdrawalNonFinanceFailure.includes(
    'Provider wallet withdrawal paid closeout requires approval from a finance approver',
  )
) {
  throw new Error(
    `Provider wallet withdrawal non-finance guard returned unexpected message: ${providerWalletWithdrawalNonFinanceFailure}`,
  );
}
providerWalletWithdrawalDualApprovalGuardsReady = true;
const providerWalletWithdrawalPaid = await patchJson(
  `${adminProviderWalletWithdrawalRequestsPath}/${providerWalletWithdrawalRequest.id}`,
  financeApproverAuth.accessToken,
  { status: 'PAID' },
);
if (
  providerWalletWithdrawalPaid.status !== 'PAID' ||
  providerWalletWithdrawalPaid.transferRef !== providerWalletWithdrawalTransferRef ||
  providerWalletWithdrawalPaid.metadata?.bankPayout?.attachmentUrl !== providerWalletWithdrawalEvidenceUrl ||
  providerWalletWithdrawalPaid.metadata?.bankPayout?.preparedByAdminId !== adminAuth.user.id ||
  providerWalletWithdrawalPaid.metadata?.bankPayout?.completedByAdminId !== financeApproverAuth.user.id
) {
  throw new Error(
    `Provider wallet withdrawal paid closeout response is incomplete: ${JSON.stringify(
      providerWalletWithdrawalPaid,
    )}`,
  );
}
const providerWalletWithdrawalProviderList = await getJson(
  '/partner/earnings/wallet-withdrawal-requests',
  withdrawalProviderAuth.accessToken,
);
const providerWalletWithdrawalAdminList = await getJson(
  `${adminProviderWalletWithdrawalRequestsPath}?providerProfileId=${withdrawalProviderAuth.user.providerProfile.id}&status=PAID&take=20`,
  adminAuth.accessToken,
);
if (
  !providerWalletWithdrawalProviderList.some(
    (request) => request.id === providerWalletWithdrawalRequest.id && request.status === 'PAID',
  ) ||
  !providerWalletWithdrawalAdminList.some(
    (request) => request.id === providerWalletWithdrawalRequest.id && request.status === 'PAID',
  )
) {
  throw new Error(
    `Provider wallet withdrawal paid request is missing from provider/admin lists: ${JSON.stringify({
      providerWalletWithdrawalAdminList,
      providerWalletWithdrawalProviderList,
      providerWalletWithdrawalRequest,
    })}`,
  );
}
const providerWalletWithdrawalLedgerSourceKey = `partner-wallet-withdrawal:${providerWalletWithdrawalRequest.id}:paid`;
const providerWalletWithdrawalLedger = await findProviderWalletLedgerEntryBySourceKey(
  providerWalletWithdrawalLedgerSourceKey,
);
if (
  providerWalletWithdrawalLedger?.type !== 'PARTNER_WALLET_WITHDRAWAL_PAID' ||
  providerWalletWithdrawalLedger.amount !== -providerWalletWithdrawalAmount ||
  providerWalletWithdrawalLedger.reference !== providerWalletWithdrawalTransferRef ||
  providerWalletWithdrawalLedger.metadata?.withdrawalRequestId !== providerWalletWithdrawalRequest.id ||
  providerWalletWithdrawalLedger.metadata?.bankPayout?.attachmentUrl !== providerWalletWithdrawalEvidenceUrl
) {
  throw new Error(
    `Provider wallet withdrawal paid ledger is incomplete: ${JSON.stringify({
      providerWalletWithdrawalLedger,
      providerWalletWithdrawalLedgerSourceKey,
      providerWalletWithdrawalPaid,
    })}`,
  );
}
const providerWalletWithdrawalPaidLifecycleReady =
  providerWalletWithdrawalDualApprovalGuardsReady &&
  providerWalletWithdrawalPaid.status === 'PAID' &&
  providerWalletWithdrawalLedger.type === 'PARTNER_WALLET_WITHDRAWAL_PAID';
if (!providerWalletWithdrawalPaidLifecycleReady) {
  throw new Error(
    `Provider wallet withdrawal paid lifecycle smoke did not complete: ${JSON.stringify({
      providerWalletWithdrawalDualApprovalGuardsReady,
      providerWalletWithdrawalLedger,
      providerWalletWithdrawalPaid,
    })}`,
  );
}

const customerAppSession = await postJson('/app/session', customerAuth.accessToken, {
  role: 'CUSTOMER',
  deviceId: `smoke-customer-app-${Date.now()}`,
  platform: 'android',
  appVersion: 'smoke-test',
});
const providerAppSession = await postJson('/app/session', providerAuth.accessToken, {
  role: 'PROVIDER',
  deviceId: `smoke-provider-app-${Date.now()}`,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (customerAppSession.role !== 'CUSTOMER' || providerAppSession.role !== 'PROVIDER') {
  throw new Error(
    `App session heartbeat did not persist roles correctly: ${JSON.stringify({
      customerAppSession,
      providerAppSession,
    })}`,
  );
}

const pushRegistrationStartedAt = Date.now() - 5_000;

await patchJson('/notifications/device-token/register', customerAuth.accessToken, {
  token: 'demo-customer-device-token',
  platform: 'android',
});

await patchJson('/notifications/device-token/register', providerAuth.accessToken, {
  token: 'demo-provider-device-token',
  platform: 'android',
});

await patchJson('/notifications/device-token/register', backupProviderAuth.accessToken, {
  token: 'demo-backup-provider-device-token',
  platform: 'android',
});

const providerSmokeDeviceId = `smoke-provider-device-${Date.now()}`;
const providerDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (
  providerDeviceSession.blocked !== false ||
  providerDeviceSession.device?.deviceId !== providerSmokeDeviceId ||
  providerDeviceSession.session?.deviceId !== providerSmokeDeviceId
) {
  throw new Error(
    `Provider device session was not recorded correctly: ${JSON.stringify(providerDeviceSession)}`,
  );
}
await postJson(`/admin/partner-devices/${providerDeviceSession.device.id}/block`, adminAuth.accessToken, {
  reason: 'Smoke test duplicate-device block',
});
const blockedProviderDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (blockedProviderDeviceSession.blocked !== true || blockedProviderDeviceSession.ok !== false) {
  throw new Error(
    `Blocked provider device was not rejected by device-session: ${JSON.stringify(blockedProviderDeviceSession)}`,
  );
}
await postJson(`/admin/partner-devices/${providerDeviceSession.device.id}/unblock`, adminAuth.accessToken);
const unblockedProviderDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (unblockedProviderDeviceSession.blocked !== false || unblockedProviderDeviceSession.ok !== true) {
  throw new Error(
    `Unblocked provider device still appears blocked: ${JSON.stringify(unblockedProviderDeviceSession)}`,
  );
}
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/block`, adminAuth.accessToken, {
  reason: 'Smoke test account-level provider block',
});
const accountBlockedProviderDeviceSession = await postJson(
  '/provider/device-session',
  providerAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  accountBlockedProviderDeviceSession.providerBlocked !== true ||
  accountBlockedProviderDeviceSession.blockedScope !== 'provider' ||
  accountBlockedProviderDeviceSession.ok !== false
) {
  throw new Error(
    `Blocked provider account was not rejected by device-session: ${JSON.stringify(
      accountBlockedProviderDeviceSession,
    )}`,
  );
}
await expectRequestFailure(
  'Blocked provider account cannot go online',
  () => postJson('/provider/online', providerAuth.accessToken),
  400,
);
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/unblock`, adminAuth.accessToken);
const accountUnblockedProviderDeviceSession = await postJson(
  '/provider/device-session',
  providerAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  accountUnblockedProviderDeviceSession.providerBlocked !== false ||
  accountUnblockedProviderDeviceSession.blocked !== false ||
  accountUnblockedProviderDeviceSession.ok !== true
) {
  throw new Error(
    `Unblocked provider account still appears blocked: ${JSON.stringify(
      accountUnblockedProviderDeviceSession,
    )}`,
  );
}
const sharedProviderDeviceSession = await postJson(
  '/provider/device-session',
  backupProviderAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  sharedProviderDeviceSession.blocked !== false ||
  sharedProviderDeviceSession.ok !== true ||
  sharedProviderDeviceSession.sharedDeviceProfileCount < 1 ||
  sharedProviderDeviceSession.session?.suspicious !== true ||
  !String(sharedProviderDeviceSession.session?.suspiciousReason ?? '').includes('already linked')
) {
  throw new Error(
    `Shared partner device should create a session check without blocking app access: ${JSON.stringify(
      sharedProviderDeviceSession,
    )}`,
  );
}

const partnerControlReport = await postJson('/admin/partner-reports', adminAuth.accessToken, {
  providerProfileId: providerAuth.user.providerProfile.id,
  category: 'smoke-partner-report',
  summary: 'Smoke partner control report',
  details: 'Created by the smoke test to verify partner report operations.',
  severity: 'HIGH',
  source: 'ADMIN',
});
if (partnerControlReport.status !== 'OPEN' || partnerControlReport.severity !== 'HIGH') {
  throw new Error(`Partner report was not created correctly: ${JSON.stringify(partnerControlReport)}`);
}
const partnerControlSanction = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sanctions`,
  adminAuth.accessToken,
  {
    reportId: partnerControlReport.id,
    type: 'WARNING',
    reason: 'Smoke warning sanction for partner control flow',
  },
);
if (partnerControlSanction.status !== 'ACTIVE' || partnerControlSanction.type !== 'WARNING') {
  throw new Error(`Partner sanction was not created correctly: ${JSON.stringify(partnerControlSanction)}`);
}
const liftedPartnerControlSanction = await postJson(
  `/admin/partner-sanctions/${partnerControlSanction.id}/lift`,
  adminAuth.accessToken,
);
if (liftedPartnerControlSanction.status !== 'LIFTED') {
  throw new Error(
    `Partner sanction was not lifted correctly: ${JSON.stringify(liftedPartnerControlSanction)}`,
  );
}
const resolvedPartnerControlReport = await patchJson(
  `/admin/partner-reports/${partnerControlReport.id}`,
  adminAuth.accessToken,
  {
    status: 'RESOLVED',
    severity: 'MEDIUM',
    resolutionNote: 'Smoke partner report resolved',
  },
);
if (
  resolvedPartnerControlReport.status !== 'RESOLVED' ||
  resolvedPartnerControlReport.severity !== 'MEDIUM'
) {
  throw new Error(
    `Partner report was not updated correctly: ${JSON.stringify(resolvedPartnerControlReport)}`,
  );
}
const partnerControlReports = await getJson('/admin/partner-reports', adminAuth.accessToken);
if (!partnerControlReports.some((report) => report.id === resolvedPartnerControlReport.id)) {
  throw new Error(
    `Partner report endpoint did not expose the resolved report: ${JSON.stringify({
      resolvedPartnerControlReport,
      partnerControlReports: partnerControlReports.slice(0, 5),
    })}`,
  );
}
const partnerControlSanctions = await getJson('/admin/partner-sanctions', adminAuth.accessToken);
if (!partnerControlSanctions.some((sanction) => sanction.id === liftedPartnerControlSanction.id)) {
  throw new Error(
    `Partner sanction endpoint did not expose the lifted sanction: ${JSON.stringify({
      liftedPartnerControlSanction,
      partnerControlSanctions: partnerControlSanctions.slice(0, 5),
    })}`,
  );
}

const services = await request('/services');
const service = services[0];
if (!service?.id || service.priceStep !== 100000 || 'payoutRules' in service) {
  throw new Error(`Public services should expose only customer catalog metadata: ${JSON.stringify(service)}`);
}
const serviceGroups = await request('/services/groups');
const publicCatalogBefore = {
  groupCount: serviceGroups.length,
  optionCount: serviceGroups.reduce((total, group) => total + (group.options?.length ?? 0), 0),
};
const serviceGroup = serviceGroups.find((group) => group.options?.some((option) => option.id === service.id));
if (
  !serviceGroup ||
  !serviceGroup.key ||
  !serviceGroup.options?.some((option) => option.durationMin === service.durationMin)
) {
  throw new Error(`Public grouped service catalog is incomplete: ${JSON.stringify(serviceGroup)}`);
}
const adminServices = await getJson('/admin/services', adminAuth.accessToken);
const adminService = adminServices.find((item) => item.id === service.id);
if (
  !adminService ||
  !adminService.payoutRules?.some((rule) => rule.customerPrice === service.basePrice && rule.active)
) {
  throw new Error(`Admin service matrix is missing the base payout rule: ${JSON.stringify(adminService)}`);
}
const basePayoutRule = adminService.payoutRules.find(
  (rule) => rule.customerPrice === service.basePrice && rule.active,
);
if (!basePayoutRule) {
  throw new Error(`Base payout rule could not be selected: ${JSON.stringify(adminService)}`);
}
const adminServiceGroups = await getJson('/admin/services/groups', adminAuth.accessToken);
const adminServiceGroup = adminServiceGroups.find((group) =>
  group.options?.some((option) => option.id === service.id),
);
if (!adminServiceGroup || typeof adminServiceGroup.activeOptionCount !== 'number') {
  throw new Error(`Admin grouped service catalog is incomplete: ${JSON.stringify(adminServiceGroup)}`);
}
// Catalog mutation atomicity and payout versioning are covered by focused tests.
// The broad smoke flow reuses the published base rule so it cannot pollute the operational catalog.
const higherCustomerPrice = service.basePrice;
const higherPricePayoutRule = basePayoutRule;
const smokeDurationSetKey = `smoke_duration_set_${apiSmokeRunKey}`;
const smokeDurationSet = await postJson('/admin/services/duration-sets', adminAuth.accessToken, {
  serviceGroupKey: smokeDurationSetKey,
  name: `Smoke Duration Set ${apiSmokeRunId.slice(0, 8)}`,
  description: `Atomic smoke-created 60/90/120 service set for run ${apiSmokeRunId}.`,
  priceStep: 100000,
  displayOrder: 999,
  vatBps: 0,
  otherCostAmount: 0,
  active: true,
  durations: [
    { durationMin: 60, basePrice: 500000, providerPayoutAmount: 380000 },
    { durationMin: 90, basePrice: 700000, providerPayoutAmount: 540000 },
    { durationMin: 120, basePrice: 900000, providerPayoutAmount: 700000 },
  ],
});
if (
  !Array.isArray(smokeDurationSet) ||
  smokeDurationSet.length !== 3 ||
  !smokeDurationSet.every((item) => item.serviceGroupKey === smokeDurationSetKey) ||
  !smokeDurationSet.every((item) => item.payoutRules?.some((rule) => rule.customerPrice === item.basePrice))
) {
  throw new Error(
    `Atomic service duration set was not created correctly: ${JSON.stringify(smokeDurationSet)}`,
  );
}
await registerApiSmokeServices(smokeDurationSet);
const vietnameseServiceSuffix = Date.now();
const vietnameseServiceName = `Mát xa đá chân ${vietnameseServiceSuffix}`;
const vietnameseServiceKey = `mat_xa_da_chan_${vietnameseServiceSuffix}`;
const vietnameseDurationSet = await postJson('/admin/services/duration-sets', adminAuth.accessToken, {
  name: vietnameseServiceName,
  description: 'Smoke test Vietnamese service-name slug generation.',
  priceStep: 100000,
  displayOrder: 999,
  vatBps: 0,
  otherCostAmount: 0,
  active: true,
  durations: [{ durationMin: 60, basePrice: 600000, providerPayoutAmount: 460000 }],
});
if (
  !Array.isArray(vietnameseDurationSet) ||
  vietnameseDurationSet.length !== 1 ||
  vietnameseDurationSet[0].serviceGroupKey !== vietnameseServiceKey
) {
  throw new Error(
    `Vietnamese service names should generate stable group keys: ${JSON.stringify(vietnameseDurationSet)}`,
  );
}
await registerApiSmokeServices(vietnameseDurationSet);
await expectRequestFailure(
  'Admin duplicate service duration set is rejected atomically',
  () =>
    postJson('/admin/services/duration-sets', adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: `Smoke Duration Set ${apiSmokeRunId.slice(0, 8)}`,
      priceStep: 100000,
      durations: [{ durationMin: 60, basePrice: 500000, providerPayoutAmount: 380000 }],
    }),
  400,
);
await expectRequestFailure(
  'Admin duplicate single service duration option is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: `Smoke Duration Set ${apiSmokeRunId.slice(0, 8)}`,
      description: 'Duplicate 60 minute option should be rejected.',
      durationMin: 60,
      basePrice: 500000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin service update cannot collide with another duration option',
  () =>
    patchJson(`/admin/services/${smokeDurationSet[1].id}`, adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: `Smoke Duration Set ${apiSmokeRunId.slice(0, 8)}`,
      description: 'Updating 90 min into the existing 60 min slot should be rejected.',
      durationMin: 60,
      basePrice: 700000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin service price step below HANDS VND unit is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: `smoke_invalid_price_step_${Date.now()}`,
      name: 'Smoke Invalid Price Step',
      description: 'Service intentionally using a disallowed 50,000 VND price step.',
      durationMin: 60,
      basePrice: 100000,
      priceStep: 50000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin service base price outside configured step is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: `smoke_invalid_base_price_${Date.now()}`,
      name: 'Smoke Invalid Base Price',
      description: 'Service intentionally using a base price outside the 100,000 VND step.',
      durationMin: 60,
      basePrice: 150000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin payout rule outside service price step is rejected',
  () =>
    postJson(`/admin/services/${service.id}/payout-rules`, adminAuth.accessToken, {
      customerPrice: service.basePrice + Math.round(service.priceStep / 2),
      providerPayoutAmount: service.basePrice,
      vatBps: 0,
      otherCostAmount: 0,
      active: true,
      notes: 'Smoke test invalid payout price step',
    }),
  400,
);
await expectRequestFailure(
  'Admin payout above customer price is rejected',
  () =>
    postJson(`/admin/services/${service.id}/payout-rules`, adminAuth.accessToken, {
      customerPrice: higherCustomerPrice,
      providerPayoutAmount: higherCustomerPrice + service.priceStep,
      vatBps: 0,
      otherCostAmount: 0,
      active: true,
      notes: 'Smoke test invalid provider payout',
    }),
  400,
);
const serviceWithoutPayoutRule = await postJson('/admin/services', adminAuth.accessToken, {
  serviceGroupKey: `smoke_missing_payout_${apiSmokeRunKey}`,
  name: `Smoke Missing Payout Rule ${apiSmokeRunId.slice(0, 8)}`,
  description: `Service intentionally missing a payout rule for booking guard coverage in run ${apiSmokeRunId}.`,
  durationMin: 60,
  basePrice: 100000,
  priceStep: 100000,
  displayOrder: 999,
  active: true,
});
await registerApiSmokeServices([serviceWithoutPayoutRule], { published: true });
await expectRequestFailure(
  'Booking without a service payout rule is rejected',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: serviceWithoutPayoutRule.id,
      address: { line1: 'Missing payout rule smoke flow' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
const providerServicesBeforeUpdate = await getJson('/provider/services', providerAuth.accessToken);
const providerService = providerServicesBeforeUpdate.find((item) => item.id === service.id);
if (
  !providerService ||
  providerService.basePrice !== service.basePrice ||
  providerService.effectivePrice < service.basePrice ||
  !providerService.payoutOptions?.some((option) => option.customerPrice === service.basePrice)
) {
  throw new Error(`Provider service pricing list is incomplete: ${JSON.stringify(providerService)}`);
}
const providerServiceGroups = await getJson('/provider/services/groups', providerAuth.accessToken);
const providerServiceGroup = providerServiceGroups.find((group) =>
  group.options?.some((option) => option.id === service.id),
);
if (
  !providerServiceGroup ||
  !providerServiceGroup.options?.some((option) => option.effectivePrice >= service.basePrice)
) {
  throw new Error(
    `Provider grouped service pricing list is incomplete: ${JSON.stringify(providerServiceGroup)}`,
  );
}
const partnerAliasServiceGroups = await getJson('/partner/services/groups', providerAuth.accessToken);
if (!partnerAliasServiceGroups.some((group) => group.options?.some((option) => option.id === service.id))) {
  throw new Error(`Partner alias service groups did not return the expected service.`);
}
await expectRequestFailure(
  'Provider price below admin minimum is rejected',
  () =>
    patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
      price: service.basePrice - service.priceStep,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Provider price outside the admin price step is rejected',
  () =>
    patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
      price: service.basePrice + Math.round(service.priceStep / 2),
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Provider cannot activate a service price without an exact admin payout rule',
  () =>
    patchJson(`/provider/services/${serviceWithoutPayoutRule.id}`, providerAuth.accessToken, {
      price: serviceWithoutPayoutRule.basePrice,
      active: true,
    }),
  400,
);
const updatedProviderService = await patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
  price: higherCustomerPrice,
  active: true,
});
if (updatedProviderService.price !== higherCustomerPrice || updatedProviderService.active !== true) {
  throw new Error(`Provider service price was not updated: ${JSON.stringify(updatedProviderService)}`);
}
for (const [label, auth] of [
  ['backup', backupProviderAuth],
  ['wallet-debt', walletDebtProviderAuth],
  ['distance-gate', distanceGateProviderAuth],
  ['narrow-radius', narrowRadiusProviderAuth],
  ['legacy-policy', legacyPolicyProviderAuth],
  ['fcm-policy', fcmPolicyProviderAuth],
  ['preferred-accept', preferredAcceptProviderAuth],
  ['after-match-cancellation', afterMatchCancellationProviderAuth],
  ['wallet-debt-service-gate', walletDebtServiceGateProviderAuth],
]) {
  const updatedService = await patchJson(`/provider/services/${service.id}`, auth.accessToken, {
    price: higherCustomerPrice,
    active: true,
  });
  if (updatedService.price !== higherCustomerPrice || updatedService.active !== true) {
    throw new Error(`${label} provider service price was not updated: ${JSON.stringify(updatedService)}`);
  }
}

function accountingJournalEntryTotal(entries, side) {
  return entries
    .filter((entry) => entry.side === side)
    .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);
}

function assertBalancedAccountingJournal(label, journal) {
  if (!journal?.entries?.length) {
    throw new Error(`${label} did not include journal entries: ${JSON.stringify(journal)}`);
  }
  const totalDebitFromEntries = accountingJournalEntryTotal(journal.entries, 'DEBIT');
  const totalCreditFromEntries = accountingJournalEntryTotal(journal.entries, 'CREDIT');
  if (
    journal.totalDebit !== journal.totalCredit ||
    journal.totalDebit !== totalDebitFromEntries ||
    journal.totalCredit !== totalCreditFromEntries
  ) {
    throw new Error(
      `${label} is not balanced: ${JSON.stringify({
        batchDebit: journal.totalDebit,
        batchCredit: journal.totalCredit,
        entryDebit: totalDebitFromEntries,
        entryCredit: totalCreditFromEntries,
        entries: journal.entries,
      })}`,
    );
  }
}

function assertJournalEntry(label, journal, expected) {
  const found = journal.entries?.some(
    (entry) =>
      entry.accountCode === expected.accountCode &&
      entry.side === expected.side &&
      Number(entry.amount ?? 0) === expected.amount,
  );
  if (!found) {
    throw new Error(
      `${label} is missing expected journal entry: ${JSON.stringify({
        expected,
        entries: journal.entries,
      })}`,
    );
  }
}
const adminServiceCatalogAfterProviderPriceUpdate = (
  await getJson('/admin/services', adminAuth.accessToken)
).find((item) => item.id === service.id);
if (
  !adminServiceCatalogAfterProviderPriceUpdate?.payoutRules?.some(
    (rule) => rule.customerPrice === higherCustomerPrice && rule.active,
  )
) {
  throw new Error(
    `Admin service catalog is missing the active payout rule for the updated provider price: ${JSON.stringify(
      adminServiceCatalogAfterProviderPriceUpdate,
    )}`,
  );
}
if ('providers' in (adminServiceCatalogAfterProviderPriceUpdate ?? {})) {
  throw new Error(
    `Admin service catalog should stay lightweight and avoid provider row hydration: ${JSON.stringify(
      adminServiceCatalogAfterProviderPriceUpdate,
    )}`,
  );
}
const couponCode = `smoke${Date.now()}`;
const couponSmokeStartedAt = new Date(Date.now() - 60_000).toISOString();
const couponSmokeEndsAt = new Date(Date.now() + 15 * 60_000).toISOString();
const coupon = await postJson('/admin/coupons', adminAuth.accessToken, {
  code: couponCode,
  description: 'Smoke test checkout discount',
  discount: { type: 'percent', value: 10 },
  active: false,
  startsAt: couponSmokeStartedAt,
  endsAt: couponSmokeEndsAt,
});
await patchJson(`/admin/coupons/${coupon.id}`, adminAuth.accessToken, { active: true });
const couponPreview = await postJson('/customer/coupons/preview', customerAuth.accessToken, {
  code: couponCode.toLowerCase(),
  serviceId: service.id,
  subtotal: service.basePrice,
});
const expectedCouponDiscount = Math.min(service.basePrice, Math.round((service.basePrice * 10) / 100));
if (coupon.code !== couponCode.toUpperCase()) {
  throw new Error(`Coupon code was not normalized by admin create: ${JSON.stringify(coupon)}`);
}
if (couponPreview.discountAmount !== expectedCouponDiscount) {
  throw new Error(
    `Coupon preview discount mismatch: ${JSON.stringify({ couponPreview, expectedCouponDiscount })}`,
  );
}

const verificationUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PRIVATE',
  purpose: 'provider-verification',
});
const completedVerificationUpload = await completeSmokeUpload(
  verificationUpload,
  providerAuth.accessToken,
  2048,
);
if (
  completedVerificationUpload.uploadStatus !== 'UPLOADED' ||
  completedVerificationUpload.sizeBytes !== 2048
) {
  throw new Error(
    `Verification upload was not marked complete: ${JSON.stringify(completedVerificationUpload)}`,
  );
}
await postJson('/provider/verification/submit', providerAuth.accessToken, {
  fileIds: [verificationUpload.file.id],
});
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/approve`, adminAuth.accessToken);
const providerSupabaseRoleSync = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sync-supabase-role`,
  adminAuth.accessToken,
);
if (!['SKIPPED', 'SYNCED'].includes(providerSupabaseRoleSync.status)) {
  throw new Error(
    `Unexpected provider Supabase role sync result: ${JSON.stringify(providerSupabaseRoleSync)}`,
  );
}
await postJson(
  `/admin/partners/${backupProviderAuth.user.providerProfile.id}/approve`,
  adminAuth.accessToken,
);
const verificationReadUrl = await getJson(
  `/files/${verificationUpload.file.id}/read-url`,
  adminAuth.accessToken,
);
const providerOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  providerOnboarding.providerProfileId !== providerAuth.user.providerProfile.id ||
  !providerOnboarding.payoutGate ||
  !Array.isArray(providerOnboarding.nextRequiredActions)
) {
  throw new Error(`Provider onboarding snapshot is incomplete: ${JSON.stringify(providerOnboarding)}`);
}
if (
  providerOnboarding.completedBookingCount === 0 &&
  (providerOnboarding.payoutGate.missing?.taxProfileApproved ||
    providerOnboarding.payoutGate.missing?.residentialAddress ||
    (providerOnboarding.payoutGate.missing?.agreements ?? []).length > 0)
) {
  throw new Error(
    `Provider payout gate should defer tax/address/agreements until first completed service: ${JSON.stringify(
      providerOnboarding.payoutGate,
    )}`,
  );
}
await patchJson('/provider/onboarding/basic-profile', providerAuth.accessToken, {
  legalName: 'Smoke Partner',
  dateOfBirth: '1995-01-01',
  displayName: 'Smoke Partner',
  bio: 'Partner onboarding smoke profile.',
  experienceYears: 5,
  specialties: ['Foot massage', 'Swedish massage'],
  languages: ['vi', 'en'],
  serviceStyle: 'Calm, professional hotel and home service.',
  residentialAddress: 'District 1, Ho Chi Minh City, Vietnam',
  city: 'Ho Chi Minh City',
  serviceArea: { country: 'VN', cities: ['Ho Chi Minh City'] },
});
const providerOnboardingAfterBasicProfile = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  providerOnboardingAfterBasicProfile.basicProfile?.experienceYears !== 5 ||
  !providerOnboardingAfterBasicProfile.basicProfile?.specialties?.includes('Foot massage') ||
  !providerOnboardingAfterBasicProfile.basicProfile?.languages?.includes('vi')
) {
  throw new Error(
    `Provider profile quality fields were not saved: ${JSON.stringify(
      providerOnboardingAfterBasicProfile.basicProfile,
    )}`,
  );
}
const publicProfileImageUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PUBLIC',
  purpose: 'profile-image',
});
await completeSmokeUpload(publicProfileImageUpload, providerAuth.accessToken, 4096);
await postJson(
  `/admin/files/${publicProfileImageUpload.file.id}/approve-public-media`,
  adminAuth.accessToken,
);
const publicGalleryImageUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PUBLIC',
  purpose: 'provider-gallery',
});
await completeSmokeUpload(publicGalleryImageUpload, providerAuth.accessToken, 8192);
await postJson(
  `/admin/files/${publicGalleryImageUpload.file.id}/approve-public-media`,
  adminAuth.accessToken,
);
await expectRequestFailure(
  'KYC submit without required documents',
  () =>
    postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: [],
    }),
  400,
);
const duplicateKycFileUpload = await postJson('/files/presign', kycNegativeProviderAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PRIVATE',
  purpose: 'provider-verification',
});
await completeSmokeUpload(duplicateKycFileUpload, kycNegativeProviderAuth.accessToken, 1024);
await expectRequestFailure(
  'KYC submit rejects duplicate file ids across document types',
  () =>
    postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: [
        { fileId: duplicateKycFileUpload.file.id, type: 'CCCD_FRONT' },
        { fileId: duplicateKycFileUpload.file.id, type: 'CCCD_BACK' },
        { fileId: duplicateKycFileUpload.file.id, type: 'SELFIE' },
      ],
    }),
  400,
);
const pendingKycDocumentUploads = [];
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const upload = await postJson('/files/presign', kycNegativeProviderAuth.accessToken, {
    contentType: 'image/jpeg',
    visibility: 'PRIVATE',
    purpose: 'provider-verification',
  });
  await completeSmokeUpload(upload, kycNegativeProviderAuth.accessToken, 1024);
  pendingKycDocumentUploads.push({ fileId: upload.file.id, type });
}
await postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
  cccdNumber: '000000000000',
  documents: pendingKycDocumentUploads,
});
await postJson(
  `/admin/partners/${kycNegativeProviderAuth.user.providerProfile.id}/approve`,
  adminAuth.accessToken,
);
await postJson('/provider/online', kycNegativeProviderAuth.accessToken);
await postJson('/provider/location', kycNegativeProviderAuth.accessToken, {
  lat: 10.7772,
  lng: 106.7011,
});
const unapprovedKycBookingGateError = await expectRequestFailure(
  'Partner without approved KYC cannot receive direct booking',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      providerId: kycNegativeProviderAuth.user.providerProfile.id,
      address: { line1: 'KYC booking gate smoke flow' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
if (!unapprovedKycBookingGateError.includes('Partner KYC must be approved')) {
  throw new Error(`KYC booking gate returned the wrong message: ${unapprovedKycBookingGateError}`);
}
await postJson(
  `/admin/partners/${kycNegativeProviderAuth.user.providerProfile.id}/kyc/approve`,
  adminAuth.accessToken,
);
const approvedKycOnboarding = await getJson('/provider/onboarding', kycNegativeProviderAuth.accessToken);
assertRequiredKycDocumentsApproved('KYC booking gate Partner', approvedKycOnboarding);
const bankDeferredBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: kycNegativeProviderAuth.user.providerProfile.id,
  address: { line1: 'Bank deferred booking smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'CASH',
});
if (!bankDeferredBooking?.id) {
  throw new Error(
    `Partner with approved KYC should receive direct booking before withdrawal bank review: ${JSON.stringify(
      bankDeferredBooking,
    )}`,
  );
}
const kycDocumentUploads = [];
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const upload = await postJson('/files/presign', providerAuth.accessToken, {
    contentType: 'image/jpeg',
    visibility: 'PRIVATE',
    purpose: 'provider-verification',
  });
  await completeSmokeUpload(upload, providerAuth.accessToken, 1024);
  kycDocumentUploads.push({ fileId: upload.file.id, type });
}
await postJson('/provider/onboarding/kyc/submit', providerAuth.accessToken, {
  cccdNumber: '000000000000',
  documents: kycDocumentUploads,
});
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/kyc/approve`, adminAuth.accessToken);
const kycApprovedProviderOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
assertRequiredKycDocumentsApproved('Primary smoke Partner', kycApprovedProviderOnboarding);
const onboardingBankAccount = await postJson('/provider/onboarding/bank-accounts', providerAuth.accessToken, {
  bankName: 'Vietcombank',
  accountNumber: '000012345678',
  accountHolderName: 'Smoke Partner',
});
await postJson(
  `/admin/partner-bank-accounts/${onboardingBankAccount.bankAccount.id}/approve`,
  adminAuth.accessToken,
);
await postJson('/provider/onboarding/tax-profile', providerAuth.accessToken, {
  taxCode: '0000000000',
  legalName: 'Smoke Partner',
  registeredAddress: 'District 1, Ho Chi Minh City, Vietnam',
});
await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/tax-profile/approve`,
  adminAuth.accessToken,
);
for (const type of ['TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX']) {
  await postJson('/provider/onboarding/agreements', providerAuth.accessToken, {
    type,
    version: '2026-05',
    deviceId: 'smoke-device',
  });
}
const approvedProviderOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  approvedProviderOnboarding.kyc?.status !== 'APPROVED' ||
  !approvedProviderOnboarding.bankAccounts?.some((account) => account.status === 'APPROVED') ||
  approvedProviderOnboarding.taxProfile?.status !== 'APPROVED'
) {
  throw new Error(`Provider onboarding review flow failed: ${JSON.stringify(approvedProviderOnboarding)}`);
}
await approvePartnerBookingReadiness(backupProviderAuth, adminAuth.accessToken, 'backup');
await approvePartnerBookingReadiness(walletDebtProviderAuth, adminAuth.accessToken, 'wallet-debt');
await approvePartnerBookingReadiness(distanceGateProviderAuth, adminAuth.accessToken, 'distance-gate');
await approvePartnerBookingReadiness(narrowRadiusProviderAuth, adminAuth.accessToken, 'narrow-radius');
await approvePartnerBookingReadiness(legacyPolicyProviderAuth, adminAuth.accessToken, 'legacy-policy');
await approvePartnerBookingReadiness(fcmPolicyProviderAuth, adminAuth.accessToken, 'fcm-policy');
await approvePartnerBookingReadiness(preferredAcceptProviderAuth, adminAuth.accessToken, 'preferred-accept');
await approvePartnerBookingReadiness(
  afterMatchCancellationProviderAuth,
  adminAuth.accessToken,
  'after-match-cancellation',
);
await approvePartnerBookingReadiness(
  walletDebtServiceGateProviderAuth,
  adminAuth.accessToken,
  'wallet-debt-service-gate',
);
const taxPolicyVersions = await getJson('/admin/tax-policy-versions', adminAuth.accessToken);
if (!Array.isArray(taxPolicyVersions)) {
  throw new Error(`Tax policy version list did not return an array: ${JSON.stringify(taxPolicyVersions)}`);
}
const taxPolicyDraftEvidence = {
  operatorReason: 'API smoke verified isolated tax policy draft evidence.',
};
const taxPolicyLegalEvidence = {
  changeSummary: 'API smoke fixture for draft validation only.',
  legalSourceTitle: 'API smoke synthetic withholding source',
  legalSourceUrl: 'https://example.test/api-smoke/tax-policy',
  promulgatedDate: new Date(Date.now() - 86_400_000).toISOString(),
  taxSubject: 'Synthetic API smoke Partner income',
};
await expectRequestFailure(
  'Direct ACTIVE tax policy creation is rejected',
  () =>
    postJson('/admin/tax-policy-versions', adminAuth.accessToken, {
      ...taxPolicyDraftEvidence,
      ...taxPolicyLegalEvidence,
      name: `Forbidden active smoke withholding ${Date.now()}`,
      status: 'ACTIVE',
      effectiveFrom: new Date(Date.now() + 60_000).toISOString(),
    }),
  409,
);
const smokeTaxPolicy = await postJson('/admin/tax-policy-versions', adminAuth.accessToken, {
  ...taxPolicyDraftEvidence,
  ...taxPolicyLegalEvidence,
  name: `Smoke withholding ${Date.now()}`,
  effectiveFrom: new Date(Date.now() + 60_000).toISOString(),
  notes: 'Smoke test isolated withholding draft',
});
const smokeTaxRule = await postJson(
  `/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`,
  adminAuth.accessToken,
  {
    ...taxPolicyDraftEvidence,
    scope: 'DEFAULT',
    rateBps: 500,
    fixedAmount: 0,
    active: true,
  },
);
await expectRequestFailure(
  'Duplicate active default tax rule is rejected',
  () =>
    postJson(`/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`, adminAuth.accessToken, {
      ...taxPolicyDraftEvidence,
      scope: 'DEFAULT',
      rateBps: 600,
      fixedAmount: 0,
      active: true,
    }),
  400,
);
const smokeAmountBandTaxRule = await postJson(
  `/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`,
  adminAuth.accessToken,
  {
    ...taxPolicyDraftEvidence,
    scope: 'AMOUNT_BAND',
    minGrossAmount: 0,
    maxGrossAmount: 500000,
    rateBps: 500,
    fixedAmount: 0,
    active: true,
  },
);
if (smokeAmountBandTaxRule.scope !== 'AMOUNT_BAND') {
  throw new Error(`Amount-band tax rule was not created: ${JSON.stringify(smokeAmountBandTaxRule)}`);
}
await expectRequestFailure(
  'Overlapping amount-band tax rule is rejected',
  () =>
    postJson(`/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`, adminAuth.accessToken, {
      ...taxPolicyDraftEvidence,
      scope: 'AMOUNT_BAND',
      minGrossAmount: 400000,
      maxGrossAmount: 600000,
      rateBps: 500,
      fixedAmount: 0,
      active: true,
    }),
  400,
);
const updatedSmokeTaxRule = await patchJson(`/admin/tax-rules/${smokeTaxRule.id}`, adminAuth.accessToken, {
  ...taxPolicyDraftEvidence,
  scope: 'DEFAULT',
  rateBps: 500,
  fixedAmount: 0,
  active: false,
});
if (updatedSmokeTaxRule.active !== false || updatedSmokeTaxRule.rateBps !== 500) {
  throw new Error(`Tax rule update failed: ${JSON.stringify(updatedSmokeTaxRule)}`);
}
await patchJson(`/admin/tax-rules/${smokeTaxRule.id}`, adminAuth.accessToken, {
  ...taxPolicyDraftEvidence,
  active: true,
});

await postJson('/provider/online', providerAuth.accessToken);
await postJson('/provider/online', backupProviderAuth.accessToken);
await postJson('/provider/online', walletDebtProviderAuth.accessToken);
await postJson('/provider/online', distanceGateProviderAuth.accessToken);

await postJson('/provider/location', providerAuth.accessToken, {
  lat: 10.7769,
  lng: 106.7009,
});

await postJson('/provider/location', backupProviderAuth.accessToken, {
  lat: 10.7783,
  lng: 106.6994,
});

await postJson('/provider/location', walletDebtProviderAuth.accessToken, {
  lat: 10.7801,
  lng: 106.6992,
});

const partnerAliasInitialMe = await getJson('/partner/me', backupProviderAuth.accessToken);
if (partnerAliasInitialMe.providerProfile?.id !== backupProviderAuth.user.providerProfile.id) {
  throw new Error(
    `Partner alias /partner/me did not return the expected profile: ${JSON.stringify(partnerAliasInitialMe)}`,
  );
}
const partnerAliasInitialServices = await getJson('/partner/services/groups', backupProviderAuth.accessToken);
if (!Array.isArray(partnerAliasInitialServices) || partnerAliasInitialServices.length === 0) {
  throw new Error(`Partner alias /partner/services/groups did not return service groups.`);
}
const partnerAliasLocation = await postJson('/partner/location', backupProviderAuth.accessToken, {
  lat: 10.7825,
  lng: 106.6951,
});
if (partnerAliasLocation.currentLat === null || partnerAliasLocation.currentLng === null) {
  throw new Error(
    `Partner alias /partner/location did not persist location: ${JSON.stringify(partnerAliasLocation)}`,
  );
}

const savedSelectedLocation = await postJson('/customer/locations/selected', customerAuth.accessToken, {
  lat: 10.7769,
  lng: 106.7009,
  addressText: 'District 1, Ho Chi Minh City, Vietnam',
});
if (
  !savedSelectedLocation.id ||
  savedSelectedLocation.addressText !== 'District 1, Ho Chi Minh City, Vietnam'
) {
  throw new Error(`Customer selected location was not saved: ${JSON.stringify(savedSelectedLocation)}`);
}

await expectRequestFailure(
  'Out-of-country customer selected location',
  () =>
    postJson('/customer/locations/selected', customerAuth.accessToken, {
      lat: 0,
      lng: 0,
      addressText: 'Invalid location',
    }),
  400,
);

const nearbyProviders = await getJson(
  '/customer/providers/nearby?lat=10.7769&lng=106.7009',
  customerAuth.accessToken,
);
const nearbyPartners = await getJson(
  '/customer/partners/nearby?lat=10.7769&lng=106.7009',
  customerAuth.accessToken,
);
const noCoordinateBrowseProviders = await getJson('/customer/partners/nearby', customerAuth.accessToken);
const nearbyProvider = nearbyProviders.find((item) => item.id === providerAuth.user.providerProfile.id);
if (!nearbyProvider?.currentLocationUpdatedAt || nearbyProvider.isRecentLocation !== true) {
  throw new Error(`Nearby provider payload is missing freshness metadata: ${JSON.stringify(nearbyProvider)}`);
}
if (!nearbyPartners.some((item) => item.id === providerAuth.user.providerProfile.id)) {
  throw new Error(`Customer partner alias nearby search did not include the expected partner.`);
}
if (!noCoordinateBrowseProviders.some((item) => item.id === providerAuth.user.providerProfile.id)) {
  throw new Error(`Customer partner browse without GPS coordinates should use the default browse origin.`);
}
if (
  !nearbyProvider.profileImageUrl ||
  !Array.isArray(nearbyProvider.galleryImageUrls) ||
  nearbyProvider.galleryImageUrls.length < 2
) {
  throw new Error(`Nearby provider payload is missing public media: ${JSON.stringify(nearbyProvider)}`);
}
const customerProviderDetail = await getJson(
  `/customer/providers/${providerAuth.user.providerProfile.id}`,
  customerAuth.accessToken,
);
const customerPartnerDetail = await getJson(
  `/customer/partners/${providerAuth.user.providerProfile.id}`,
  customerAuth.accessToken,
);
if (
  !customerProviderDetail.profileImageUrl ||
  !Array.isArray(customerProviderDetail.galleryImageUrls) ||
  customerProviderDetail.galleryImageUrls.length < 2
) {
  throw new Error(
    `Customer provider detail payload is missing public media: ${JSON.stringify(customerProviderDetail)}`,
  );
}
if (customerPartnerDetail.id !== customerProviderDetail.id) {
  throw new Error(`Customer partner alias detail returned a different partner.`);
}

const globalBrowseProviders = await getJson(
  '/customer/providers/nearby?lat=37.5665&lng=126.9780',
  customerAuth.accessToken,
);
const globalBrowseProvider = globalBrowseProviders.find(
  (item) => item.id === providerAuth.user.providerProfile.id,
);
if (
  !globalBrowseProvider ||
  typeof globalBrowseProvider.distanceMeters !== 'number' ||
  globalBrowseProvider.distanceMeters < 1_000_000
) {
  throw new Error(
    `Customer should be able to browse partners globally with long distance metadata: ${JSON.stringify(
      globalBrowseProvider,
    )}`,
  );
}

await expectRequestFailure(
  'Booking address text is required for immutable dispatch snapshot',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      address: {},
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
await expectRequestFailure(
  'Booking dispatch pin must be inside Vietnam',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      address: { line1: 'Out of country smoke flow' },
      lat: 40.7128,
      lng: -74.006,
      paymentMethod: 'CASH',
    }),
  400,
);
const serviceAreaGateAuditLogs = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !serviceAreaGateAuditLogs.some(
    (log) =>
      log.action === 'booking.create.rejected' &&
      log.metadata?.reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
  )
) {
  throw new Error(
    `Service area gate rejection should create an operations audit log: ${JSON.stringify(
      serviceAreaGateAuditLogs.slice(0, 5),
    )}`,
  );
}
const noCurrentLocationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'CASH',
});
const noCurrentLocationBookingDetail = await getJson(
  `/customer/bookings/${noCurrentLocationBooking.id}`,
  customerAuth.accessToken,
);
if (
  noCurrentLocationBookingDetail.status !== 'OPEN_MATCHING' ||
  noCurrentLocationBookingDetail.addressSnapshot?.addressText !== 'District 1, Ho Chi Minh City'
) {
  throw new Error(
    `Booking should open from the confirmed service address without requiring customer GPS: ${JSON.stringify(
      noCurrentLocationBookingDetail,
    )}`,
  );
}
const staleCurrentLocationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'District 1, Ho Chi Minh City stale optional GPS' },
  lat: 10.7769,
  lng: 106.7009,
  currentLat: 10.7769,
  currentLng: 106.7009,
  currentLocationUpdatedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  paymentMethod: 'CASH',
});
const staleCurrentLocationBookingDetail = await getJson(
  `/customer/bookings/${staleCurrentLocationBooking.id}`,
  customerAuth.accessToken,
);
if (
  staleCurrentLocationBookingDetail.status !== 'OPEN_MATCHING' ||
  staleCurrentLocationBookingDetail.metadata?.customerCurrentLocation != null
) {
  throw new Error(
    `Stale customer GPS should be ignored as optional evidence, not block address-based booking: ${JSON.stringify(
      staleCurrentLocationBookingDetail,
    )}`,
  );
}
const farCurrentLocationBookingError = await expectRequestFailure(
  'Fresh customer GPS too far from booking address blocks booking creation',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      address: { line1: 'Da Nang city center' },
      lat: 16.0471,
      lng: 108.2068,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      paymentMethod: 'CASH',
    }),
  400,
);
if (
  !farCurrentLocationBookingError.includes(
    "Booking address must be within 50km of the customer's current location",
  )
) {
  throw new Error(
    `Far customer GPS booking gate returned the wrong message: ${farCurrentLocationBookingError}`,
  );
}
await postJson('/provider/location', distanceGateProviderAuth.accessToken, {
  lat: 16.0471,
  lng: 108.2068,
});
const preferredPartnerDistanceGateError = await expectRequestFailure(
  'Booking rejects preferred partners too far from the booking address',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      providerId: distanceGateProviderAuth.user.providerProfile.id,
      address: { line1: 'District 1, Ho Chi Minh City' },
      lat: 10.7769,
      lng: 106.7009,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      paymentMethod: 'CASH',
    }),
  400,
);
if (
  !preferredPartnerDistanceGateError.includes('Preferred partner must be within 50km of the booking address')
) {
  throw new Error(
    `Preferred partner distance gate returned the wrong message: ${preferredPartnerDistanceGateError}`,
  );
}
await postJson('/provider/location', distanceGateProviderAuth.accessToken, {
  lat: 10.7801,
  lng: 106.6992,
});

await postJson('/provider/location', distanceGateProviderAuth.accessToken, {
  lat: 10.7801,
  lng: 106.6992,
});
const preferredPartnerDistanceGateAuditLogs = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !preferredPartnerDistanceGateAuditLogs.some(
    (log) =>
      log.action === 'booking.create.rejected' && log.metadata?.reasonCode === 'PREFERRED_PARTNER_TOO_FAR',
  )
) {
  throw new Error(
    `Preferred partner distance gate rejection should create an operations audit log: ${JSON.stringify(
      preferredPartnerDistanceGateAuditLogs.slice(0, 5),
    )}`,
  );
}

const selectedLocationOnlyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  selectedLocationId: savedSelectedLocation.id,
  currentLat: Number(savedSelectedLocation.latitude),
  currentLng: Number(savedSelectedLocation.longitude),
  currentLocationUpdatedAt: new Date().toISOString(),
  paymentMethod: 'CASH',
});
const selectedLocationOnlyBookingDetail = await getJson(
  `/customer/bookings/${selectedLocationOnlyBooking.id}`,
  customerAuth.accessToken,
);
if (
  selectedLocationOnlyBookingDetail.addressSnapshot?.selectedLocationId !== savedSelectedLocation.id ||
  selectedLocationOnlyBookingDetail.addressSnapshot?.addressText !== savedSelectedLocation.addressText ||
  Number(selectedLocationOnlyBookingDetail.addressSnapshot?.latitude) !==
    Number(savedSelectedLocation.latitude) ||
  Number(selectedLocationOnlyBookingDetail.addressSnapshot?.longitude) !==
    Number(savedSelectedLocation.longitude)
) {
  throw new Error(
    `Selected-location-only booking should create an immutable dispatch snapshot: ${JSON.stringify(
      selectedLocationOnlyBookingDetail.addressSnapshot,
    )}`,
  );
}

const ignoredFutureScheduledStartAt = new Date(Date.now() + 60 * 60_000).toISOString();
const booking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: ignoredFutureScheduledStartAt,
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const bookingDetail = await getJson(`/customer/bookings/${booking.id}`, customerAuth.accessToken);
if (
  bookingDetail.scheduledStartAt === ignoredFutureScheduledStartAt ||
  Date.parse(bookingDetail.scheduledStartAt) > Date.now() + 5 * 60_000
) {
  throw new Error(
    `Customer-supplied scheduledStartAt should not create scheduled booking: ${JSON.stringify({
      input: ignoredFutureScheduledStartAt,
      persisted: bookingDetail.scheduledStartAt,
    })}`,
  );
}
assertBookingPricing('Open matching base-price', bookingDetail, {
  customerPrice: service.basePrice,
  paymentAmount: service.basePrice,
});
assertBookingMatchingWindow('Open matching base-price', bookingDetail, 10);
if (
  bookingDetail.addressSnapshot?.addressText !== 'District 1, Ho Chi Minh City' ||
  Number(bookingDetail.addressSnapshot?.latitude) !== 10.7769 ||
  Number(bookingDetail.addressSnapshot?.longitude) !== 106.7009
) {
  throw new Error(
    `Customer booking detail should expose immutable address snapshot: ${JSON.stringify(
      bookingDetail.addressSnapshot,
    )}`,
  );
}
if ('metadata' in bookingDetail) {
  throw new Error(
    `Customer booking detail must not expose internal metadata: ${JSON.stringify(bookingDetail.metadata)}`,
  );
}
const adminBookingGateDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (
  adminBookingGateDetail.metadata?.bookingGate?.gatePassed !== true ||
  adminBookingGateDetail.metadata?.bookingGate?.customerToBookingAddressDistanceMeters !== 0 ||
  adminBookingGateDetail.metadata?.bookingGate?.customerDistanceLimitMeters !== 50000
) {
  throw new Error(
    `Admin booking detail should expose the booking distance gate snapshot: ${JSON.stringify(
      adminBookingGateDetail.metadata?.bookingGate,
    )}`,
  );
}
const partnerAliasOpenBookings = await getJson('/partner/bookings/open', providerAuth.accessToken);
if (!partnerAliasOpenBookings.some((item) => item.id === booking.id)) {
  throw new Error(`Partner alias /partner/bookings/open did not include an open booking.`);
}
const preMatchChatRepairError = await expectRequestFailure(
  'Admin chat repair requires final partner selection',
  () => postJson(`/admin/bookings/${booking.id}/repair-chat-room`, adminAuth.accessToken),
  400,
);
if (!preMatchChatRepairError.includes('Final partner selection is required before repairing chat room')) {
  throw new Error(
    `Admin chat repair before matching returned an unexpected error: ${preMatchChatRepairError}`,
  );
}

const hybridBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  address: { line1: 'Hybrid fallback smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const withholdingRemittancePaidLifecycleReady = await assertWithholdingRemittanceLifecycle({
  adminAccessToken: adminAuth.accessToken,
  bookingId: hybridBooking.id,
  customerProfileId: customerAuth.user.customerProfile.id,
  financeApproverId: financeApproverAuth.user.id,
  nonFinanceApprovalAdminId: nonFinanceAdminAuth.user.id,
  providerProfileId: providerAuth.user.providerProfile.id,
  remittedByAdminId: adminAuth.user.id,
});
const hybridBookingDetail = await getJson(`/customer/bookings/${hybridBooking.id}`, customerAuth.accessToken);
assertBookingPricing('Direct provider custom-price', hybridBookingDetail, {
  customerPrice: higherCustomerPrice,
  paymentAmount: higherCustomerPrice,
});
assertBookingMatchingWindow('Direct provider custom-price', hybridBookingDetail, 10);
let hybridBackupNotifications = [];
let hybridBackupNotification = null;
for (let attempt = 0; attempt < 20; attempt++) {
  hybridBackupNotifications = await getJson('/notifications', backupProviderAuth.accessToken);
  hybridBackupNotification = hybridBackupNotifications.find(
    (notification) =>
      notification.type === 'booking.backup_available' &&
      notification.data?.bookingId === hybridBooking.id &&
      notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
  );
  if (hybridBackupNotification) {
    break;
  }
  await sleep(500);
}
if (
  !hybridBackupNotification ||
  hybridBackupNotification.data?.backupProviderRadiusMeters !== 10000 ||
  typeof hybridBackupNotification.data?.distanceMeters !== 'number' ||
  hybridBackupNotification.data.distanceMeters > 10000
) {
  throw new Error(
    `Direct booking should notify eligible marketplace partners: ${JSON.stringify({
      hybridBackupNotification,
      hybridBackupNotifications,
    })}`,
  );
}
const marketplaceAcceptWithoutJoinError = await expectRequestFailure(
  'Marketplace partner accept requires participation',
  () => postJson(`/provider/bookings/${hybridBooking.id}/accept`, backupProviderAuth.accessToken),
  400,
);
if (
  !marketplaceAcceptWithoutJoinError.includes(
    'Partner must participate in this marketplace booking before responding',
  )
) {
  throw new Error(
    `Marketplace accept-before-participation returned an unexpected error: ${marketplaceAcceptWithoutJoinError}`,
  );
}
const hybridAdminBooking = await getJson(`/admin/bookings/${hybridBooking.id}`, adminAuth.accessToken);
if (
  hybridAdminBooking.addressSnapshot?.addressText !== 'Hybrid fallback smoke flow' ||
  Number(hybridAdminBooking.addressSnapshot?.latitude) !== 10.7783 ||
  Number(hybridAdminBooking.addressSnapshot?.longitude) !== 106.6994
) {
  throw new Error(
    `Admin booking detail should expose immutable address snapshot: ${JSON.stringify(
      hybridAdminBooking.addressSnapshot,
    )}`,
  );
}
const hybridBackupNotificationTraces = Array.isArray(hybridAdminBooking.metadata?.backupNotificationTraces)
  ? hybridAdminBooking.metadata.backupNotificationTraces
  : [];
const hybridInitialBackupTrace = hybridBackupNotificationTraces.find(
  (trace) =>
    trace.stage === 'initial_open' &&
    trace.backupProviderRadiusMeters === 10000 &&
    trace.providers?.some(
      (provider) => provider.providerProfileId === backupProviderAuth.user.providerProfile.id,
    ),
);
if (!hybridInitialBackupTrace || hybridInitialBackupTrace.notifiedCount < 1) {
  throw new Error(
    `Direct booking should persist backup notification trace metadata: ${JSON.stringify(
      hybridBackupNotificationTraces,
    )}`,
  );
}

let preferredAcceptPolicyBooking;
let preferredAcceptPolicyMatched;
let firstPickMatchAuditSourceObserved = false;
const preferredAcceptModeBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.preferred_accept_mode',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.preferred_accept_mode',
  'FIRST_PICK_MATCHES_ON_ACCEPT',
);
try {
  await postJson('/provider/online', preferredAcceptProviderAuth.accessToken);
  await postJson('/provider/location', preferredAcceptProviderAuth.accessToken, {
    lat: 10.7783,
    lng: 106.6994,
  });
  preferredAcceptPolicyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: preferredAcceptProviderAuth.user.providerProfile.id,
    address: { line1: 'Preferred accept policy smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  const unsupportedPreferredAcceptModeError = await expectRequestFailure(
    'Unsupported first-pick auto-match policy option',
    () =>
      patchOperationalPolicyValue(
        adminAuth.accessToken,
        'matching.preferred_accept_mode',
        'AUTO_MATCH_ON_ACCEPT',
      ),
    400,
  );
  if (!unsupportedPreferredAcceptModeError.includes('unsupported option')) {
    throw new Error(
      `Unsupported first-pick policy returned an unexpected error: ${unsupportedPreferredAcceptModeError}`,
    );
  }
  const preferredBeforeAcceptSelectionError = await expectRequestFailure(
    'Customer final selection rejects preferred partner before acceptance',
    () =>
      postJson(
        `/customer/bookings/${preferredAcceptPolicyBooking.id}/select-provider`,
        customerAuth.accessToken,
        { providerId: preferredAcceptProviderAuth.user.providerProfile.id },
      ),
    400,
  );
  if (
    !preferredBeforeAcceptSelectionError.includes(
      'Partner must participate or accept before customer selection',
    )
  ) {
    throw new Error(
      `Preferred partner selection before acceptance returned an unexpected error: ${preferredBeforeAcceptSelectionError}`,
    );
  }
  preferredAcceptPolicyMatched = await postJson(
    `/provider/bookings/${preferredAcceptPolicyBooking.id}/accept`,
    preferredAcceptProviderAuth.accessToken,
  );
  const preferredAcceptPolicyMatchedBooking =
    preferredAcceptPolicyMatched.booking ?? preferredAcceptPolicyMatched;
  if (
    preferredAcceptPolicyMatched.status !== 'IN_SERVICE' ||
    preferredAcceptPolicyMatched.matchSource !== 'FIRST_PICK_ACCEPTED_FIRST' ||
    preferredAcceptPolicyMatchedBooking.selectedProviderId !==
      preferredAcceptProviderAuth.user.providerProfile.id
  ) {
    throw new Error(
      `First-pick valid acceptance should enter service with the preferred partner: ${JSON.stringify(
        preferredAcceptPolicyMatched,
      )}`,
    );
  }
  const firstPickDidNotSelectOtherProvider =
    preferredAcceptPolicyMatchedBooking.selectedProviderId !== providerAuth.user.providerProfile.id;
  if (!firstPickDidNotSelectOtherProvider) {
    throw new Error(
      `First-pick valid acceptance should not select a different partner: ${JSON.stringify(
        preferredAcceptPolicyMatched,
      )}`,
    );
  }
  const preferredAcceptedParticipant = preferredAcceptPolicyMatchedBooking.participants?.find(
    (participant) => participant.providerProfileId === preferredAcceptProviderAuth.user.providerProfile.id,
  );
  if (preferredAcceptedParticipant?.status !== 'SELECTED') {
    throw new Error(
      `First-pick valid acceptance should mark participant selected: ${JSON.stringify(
        preferredAcceptPolicyMatched,
      )}`,
    );
  }
  const preferredAcceptAdminBooking = await getJson(
    `/admin/bookings/${preferredAcceptPolicyBooking.id}`,
    adminAuth.accessToken,
  );
  firstPickMatchAuditSourceObserved = Boolean(
    preferredAcceptAdminBooking.auditLogs?.some(
      (log) =>
        log.action === 'booking.matched.first_pick_accepted' &&
        log.metadata?.matchSource === 'FIRST_PICK_ACCEPTED_FIRST' &&
        log.metadata?.providerProfileId === preferredAcceptProviderAuth.user.providerProfile.id,
    ),
  );
  if (!firstPickMatchAuditSourceObserved) {
    throw new Error(
      `First-pick accepted smoke should persist matchSource audit evidence: ${JSON.stringify(
        preferredAcceptAdminBooking.auditLogs?.slice(0, 5),
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.preferred_accept_mode',
    preferredAcceptModeBeforeSmoke ?? 'FIRST_PICK_MATCHES_ON_ACCEPT',
    { restoration: true },
  );
}

const backupRadiusBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_partner_radius_meters',
);
await patchOperationalPolicyValue(adminAuth.accessToken, 'matching.marketplace_partner_radius_meters', 1000);
try {
  await postJson('/provider/online', narrowRadiusProviderAuth.accessToken);
  await postJson('/provider/location', narrowRadiusProviderAuth.accessToken, {
    lat: 10.7769,
    lng: 106.7009,
  });
  await postJson('/provider/location', backupProviderAuth.accessToken, {
    lat: 10.83,
    lng: 106.7009,
  });
  const narrowRadiusBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: narrowRadiusProviderAuth.user.providerProfile.id,
    address: { line1: 'Narrow marketplace radius smoke flow' },
    lat: 10.7769,
    lng: 106.7009,
    paymentMethod: 'CASH',
  });
  const narrowRadiusOpenBookings = await getJson('/provider/bookings/open', backupProviderAuth.accessToken);
  const narrowRadiusOpenBooking = narrowRadiusOpenBookings.find((item) => item.id === narrowRadiusBooking.id);
  if (!narrowRadiusOpenBooking || narrowRadiusOpenBooking.distanceMeters <= 1000) {
    throw new Error(
      `Public booking list should show the distant request and its distance before participation: ${JSON.stringify(
        narrowRadiusOpenBookings,
      )}`,
    );
  }
  const narrowRadiusJoinError = await expectRequestFailure(
    'Narrow marketplace radius partner participation',
    () => postJson(`/provider/bookings/${narrowRadiusBooking.id}/join`, backupProviderAuth.accessToken),
    400,
  );
  if (!narrowRadiusJoinError.includes('Only partners within 1km can participate in this booking')) {
    throw new Error(`Narrow marketplace radius returned an unexpected error: ${narrowRadiusJoinError}`);
  }
} finally {
  await postJson('/provider/location', backupProviderAuth.accessToken, {
    lat: 10.7825,
    lng: 106.6951,
  });
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_partner_radius_meters',
    backupRadiusBeforeSmoke ?? 10000,
    { restoration: true },
  );
}

let legacyDelayedMarketplaceBooking;
let backupDeclineNotificationObserved = false;
const backupOpenModeBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_open_mode',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_open_mode',
  'AFTER_FIRST_PICK_DELAY',
);
try {
  await postJson('/provider/online', legacyPolicyProviderAuth.accessToken);
  await postJson('/provider/location', legacyPolicyProviderAuth.accessToken, {
    lat: 10.7783,
    lng: 106.6994,
  });
  legacyDelayedMarketplaceBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: legacyPolicyProviderAuth.user.providerProfile.id,
    address: { line1: 'Legacy delayed marketplace compatibility smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_open_mode',
    'IMMEDIATE_WITHIN_WINDOW',
  );
  const legacyDelayedOpenBookings = await getJson('/provider/bookings/open', backupProviderAuth.accessToken);
  const legacyDelayedRequest = legacyDelayedOpenBookings.find(
    (item) => item.id === legacyDelayedMarketplaceBooking.id,
  );
  if (!legacyDelayedRequest) {
    throw new Error(
      `Legacy delayed marketplace policy should still expose request to non-preferred partner: ${JSON.stringify(
        legacyDelayedOpenBookings,
      )}`,
    );
  }
  if (
    typeof legacyDelayedRequest.distanceMeters !== 'number' ||
    legacyDelayedRequest.distanceMeters > 10000
  ) {
    throw new Error(
      `Legacy delayed marketplace request should keep 10km distance metadata: ${JSON.stringify(
        legacyDelayedRequest,
      )}`,
    );
  }
  await postJson(
    `/provider/bookings/${legacyDelayedMarketplaceBooking.id}/join`,
    backupProviderAuth.accessToken,
  );
  await postJson(
    `/provider/bookings/${legacyDelayedMarketplaceBooking.id}/reject`,
    backupProviderAuth.accessToken,
  );
  const rejectedMarketplaceSelectionError = await expectRequestFailure(
    'Customer final selection rejects inactive marketplace participant',
    () =>
      postJson(
        `/customer/bookings/${legacyDelayedMarketplaceBooking.id}/select-provider`,
        customerAuth.accessToken,
        { providerId: backupProviderAuth.user.providerProfile.id },
      ),
    400,
  );
  if (
    !rejectedMarketplaceSelectionError.includes(
      'Partner must participate or accept before customer selection',
    )
  ) {
    throw new Error(
      `Rejected marketplace participant should not be selectable by customer: ${rejectedMarketplaceSelectionError}`,
    );
  }
  const delayedBackupCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
  backupDeclineNotificationObserved = delayedBackupCustomerNotifications.some(
    (notification) =>
      notification.type === 'provider.rejected' &&
      notification.data?.bookingId === legacyDelayedMarketplaceBooking.id &&
      notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
  );
  if (!backupDeclineNotificationObserved) {
    throw new Error(
      `Marketplace partner decline should create a customer notification: ${JSON.stringify(
        delayedBackupCustomerNotifications,
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_open_mode',
    backupOpenModeBeforeSmoke ?? 'IMMEDIATE_WITHIN_WINDOW',
    { restoration: true },
  );
}

let fcmPolicyNotification = null;
let fcmPolicyNotificationCandidate = null;
const partnerAlertChannelBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'notification.partner_alert_channel',
);
const marketplaceInvitationLimitBeforeFcmSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_partner_invitation_limit',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'notification.partner_alert_channel',
  'FCM_FOR_ALL_BOOKINGS',
);
await patchOperationalPolicyValue(adminAuth.accessToken, 'matching.marketplace_partner_invitation_limit', 1);
try {
  await patchJson('/notifications/device-token/register', fcmPolicyProviderAuth.accessToken, {
    token: `demo-fcm-policy-provider-device-token-${Date.now()}`,
    platform: 'android',
  });
  await postJson('/provider/online', fcmPolicyProviderAuth.accessToken);
  await postJson('/provider/location', fcmPolicyProviderAuth.accessToken, {
    lat: 10.7783,
    lng: 106.6994,
  });
  const fcmPolicyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: fcmPolicyProviderAuth.user.providerProfile.id,
    address: { line1: 'Partner alert channel policy smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(500);
    const adminNotifications = await getJson(
      `/admin/bookings/${fcmPolicyBooking.id}/notifications?take=50`,
      adminAuth.accessToken,
    );
    fcmPolicyNotificationCandidate = adminNotifications.find(
      (item) => item.type === 'booking.requested' && item.data?.bookingId === fcmPolicyBooking.id,
    );
    fcmPolicyNotification =
      (fcmPolicyNotificationCandidate?.deliveries?.length ?? 0) > 0 ? fcmPolicyNotificationCandidate : null;
    if (fcmPolicyNotification?.deliveries?.some((delivery) => delivery.provider === 'FCM')) {
      break;
    }
  }
  const hasFcmDelivery = fcmPolicyNotification?.deliveries?.some((delivery) => delivery.provider === 'FCM');
  if (!hasFcmDelivery) {
    throw new Error(
      `Partner alert channel policy did not route direct booking push through FCM: ${JSON.stringify(
        fcmPolicyNotificationCandidate,
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'notification.partner_alert_channel',
    partnerAlertChannelBeforeSmoke ?? 'IN_APP_WITH_PUSH_LATER',
    { restoration: true },
  );
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_partner_invitation_limit',
    marketplaceInvitationLimitBeforeFcmSmoke ?? 50,
    { restoration: true },
  );
}

const momoBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});

const couponBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  couponCode: couponCode.toLowerCase(),
  address: { line1: 'Coupon checkout smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'CASH',
});
const expectedCouponTotal = Math.max(0, service.basePrice - expectedCouponDiscount);
const couponPayment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === couponBooking.id),
);
if (couponPayment?.amount !== expectedCouponTotal) {
  throw new Error(
    `Coupon booking payment total mismatch: ${JSON.stringify({
      amount: couponPayment?.amount,
      expectedCouponTotal,
      couponPayment,
    })}`,
  );
}
await patchJson(`/admin/coupons/${coupon.id}`, adminAuth.accessToken, { active: false });

const cancellableMomoBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'Cancellation release smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const cancelledMomoBooking = await postJson(
  `/customer/bookings/${cancellableMomoBooking.id}/cancel`,
  customerAuth.accessToken,
);
if (cancelledMomoBooking.status !== 'CANCELLED' || cancelledMomoBooking.payment?.status !== 'RELEASED') {
  throw new Error(`Cancelled booking did not release payment hold: ${JSON.stringify(cancelledMomoBooking)}`);
}
if (
  cancelledMomoBooking.cancellation?.reasonCode !== 'CUSTOMER_CANCELLED_BEFORE_MATCH' ||
  cancelledMomoBooking.cancellation?.paymentOutcome !== 'RELEASED' ||
  !cancelledMomoBooking.closedAt
) {
  throw new Error(
    `Cancelled booking did not expose the customer-safe cancellation result: ${JSON.stringify(cancelledMomoBooking)}`,
  );
}
const cancelledMomoAdminBooking = await getJson(
  `/admin/bookings/${cancellableMomoBooking.id}`,
  adminAuth.accessToken,
);
if (
  cancelledMomoAdminBooking.closedByRole !== 'CUSTOMER' ||
  cancelledMomoAdminBooking.closedReason !== 'customer_cancelled' ||
  !cancelledMomoAdminBooking.closedAt
) {
  throw new Error(
    `Cancelled booking did not retain admin closure evidence: ${JSON.stringify(cancelledMomoAdminBooking)}`,
  );
}
const cancelledPaymentBeforeSync = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === cancellableMomoBooking.id),
);
if (!cancelledPaymentBeforeSync?.id) {
  throw new Error(
    `Admin payment list did not expose cancelled booking payment id: ${JSON.stringify({
      cancelledMomoBooking,
      cancelledPaymentBeforeSync,
    })}`,
  );
}
const cancelledPaymentSync = await postJson(
  `/admin/payments/${cancelledPaymentBeforeSync.id}/sync`,
  adminAuth.accessToken,
);
const cancelledPaymentAfterSync = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === cancellableMomoBooking.id),
);
if (cancelledPaymentAfterSync?.status !== 'RELEASED') {
  throw new Error(
    `Released payment was overwritten by sync: ${JSON.stringify({ cancelledPaymentSync, cancelledPaymentAfterSync })}`,
  );
}

let afterMatchCancellationBooking;
const cancellationAfterMatchBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'cancellation.after_match_policy',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'cancellation.after_match_policy',
  'ADMIN_FEE_REVIEW_AFTER_MATCH',
);
try {
  await postJson('/provider/online', afterMatchCancellationProviderAuth.accessToken);
  await postJson('/provider/location', afterMatchCancellationProviderAuth.accessToken, {
    lat: 10.7769,
    lng: 106.7009,
  });
  afterMatchCancellationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: afterMatchCancellationProviderAuth.user.providerProfile.id,
    address: { line1: 'After match cancellation policy smoke flow' },
    lat: 10.7769,
    lng: 106.7009,
    paymentMethod: 'MOMO',
  });
  const acceptedAfterMatchCancellation = await postJson(
    `/provider/bookings/${afterMatchCancellationBooking.id}/accept`,
    afterMatchCancellationProviderAuth.accessToken,
  );
  if (acceptedAfterMatchCancellation.status !== 'IN_SERVICE') {
    throw new Error(
      `After-match cancellation smoke booking did not enter service before cancel: ${JSON.stringify(
        acceptedAfterMatchCancellation,
      )}`,
    );
  }
  const afterMatchCancellationError = await expectRequestFailure(
    'Matched booking customer direct cancel is blocked',
    () => postJson(`/customer/bookings/${afterMatchCancellationBooking.id}/cancel`, customerAuth.accessToken),
    409,
  );
  if (!afterMatchCancellationError.includes('Matched bookings cannot be cancelled directly')) {
    throw new Error(
      `Matched booking direct cancel should route to chat evidence and admin review: ${afterMatchCancellationError}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'cancellation.after_match_policy',
    cancellationAfterMatchBeforeSmoke ?? 'ADMIN_REVIEW_FOR_MVP',
    { restoration: true },
  );
}

const noShowBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  address: { line1: 'No-show operations smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const markedNoShowBooking = await postJson(
  `/admin/bookings/${noShowBooking.id}/no-show`,
  adminAuth.accessToken,
  {
    reason: 'Smoke test no-show',
  },
);
if (markedNoShowBooking.status !== 'NO_SHOW') {
  throw new Error(`Admin no-show action did not update status: ${JSON.stringify(markedNoShowBooking)}`);
}
if (
  markedNoShowBooking.closedByRole !== 'ADMIN' ||
  markedNoShowBooking.closedReason !== 'admin_no_show' ||
  !markedNoShowBooking.closedAt
) {
  throw new Error(
    `Admin no-show action did not record closure metadata: ${JSON.stringify(markedNoShowBooking)}`,
  );
}
const noShowCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
if (
  !noShowCustomerNotifications.some(
    (notification) =>
      notification.type === 'booking.no_show' && notification.data?.bookingId === noShowBooking.id,
  )
) {
  throw new Error(`No-show should notify the customer: ${JSON.stringify(noShowCustomerNotifications)}`);
}
const noShowPartnerNotifications = await getJson('/notifications', providerAuth.accessToken);
if (
  !noShowPartnerNotifications.some(
    (notification) =>
      notification.type === 'booking.no_show' && notification.data?.bookingId === noShowBooking.id,
  )
) {
  throw new Error(
    `No-show should notify the preferred partner: ${JSON.stringify(noShowPartnerNotifications)}`,
  );
}
const noShowCustomerCancelError = await expectRequestFailure(
  'No-show booking customer direct cancel is blocked',
  () => postJson(`/customer/bookings/${noShowBooking.id}/cancel`, customerAuth.accessToken),
  400,
);
if (!noShowCustomerCancelError.includes('Booking cannot be cancelled in its current state')) {
  throw new Error(`No-show booking direct cancel returned an unexpected error: ${noShowCustomerCancelError}`);
}

const manuallyExpiredBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'Manual expiry operations smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const expiredByAdminBooking = await postJson(
  `/admin/bookings/${manuallyExpiredBooking.id}/expire`,
  adminAuth.accessToken,
  {
    reason: 'Smoke test manual expiry',
  },
);
if (expiredByAdminBooking.status !== 'EXPIRED' || expiredByAdminBooking.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin expiry action did not expire booking and release payment: ${JSON.stringify(expiredByAdminBooking)}`,
  );
}
if (
  expiredByAdminBooking.closedByRole !== 'ADMIN' ||
  expiredByAdminBooking.closedReason !== 'admin_expired' ||
  !expiredByAdminBooking.closedNote?.includes('Smoke test manual expiry')
) {
  throw new Error(
    `Admin expiry action did not record closure metadata: ${JSON.stringify(expiredByAdminBooking)}`,
  );
}
const expiredCustomerCancelError = await expectRequestFailure(
  'Expired booking customer direct cancel is blocked',
  () => postJson(`/customer/bookings/${manuallyExpiredBooking.id}/cancel`, customerAuth.accessToken),
  400,
);
if (!expiredCustomerCancelError.includes('Booking cannot be cancelled in its current state')) {
  throw new Error(
    `Expired booking direct cancel returned an unexpected error: ${expiredCustomerCancelError}`,
  );
}

await postJson(`/provider/bookings/${booking.id}/join`, providerAuth.accessToken);
await postJson(`/provider/bookings/${hybridBooking.id}/join`, backupProviderAuth.accessToken);
await postJson(`/provider/bookings/${hybridBooking.id}/accept`, backupProviderAuth.accessToken);
const hybridCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
const backupAcceptNotificationObserved = hybridCustomerNotifications.some(
  (notification) =>
    notification.type === 'provider.accepted' &&
    notification.data?.bookingId === hybridBooking.id &&
    notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
);
if (!backupAcceptNotificationObserved) {
  throw new Error(
    `Marketplace partner acceptance should create a customer notification: ${JSON.stringify(
      hybridCustomerNotifications,
    )}`,
  );
}

const hybridMatched = await postJson(
  `/customer/bookings/${hybridBooking.id}/select-provider`,
  customerAuth.accessToken,
  {
    providerId: backupProviderAuth.user.providerProfile.id,
  },
);
if (hybridMatched.status !== 'IN_SERVICE') {
  throw new Error(
    `Marketplace customer selection should enter service immediately: ${JSON.stringify(hybridMatched)}`,
  );
}

const walletDebtJoinedBeforeDebtBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'Negative wallet final selection smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'MOMO',
});
await postJson(
  `/provider/bookings/${walletDebtJoinedBeforeDebtBooking.id}/join`,
  walletDebtProviderAuth.accessToken,
);

const walletDebtBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtProviderAuth.user.providerProfile.id,
  address: { line1: 'Negative wallet source smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const blockedDirectBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtProviderAuth.user.providerProfile.id,
  address: { line1: 'Negative wallet marketplace smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const walletDebtProviderOpenBookings = await getJson(
  '/provider/bookings/open',
  walletDebtProviderAuth.accessToken,
);
const cashOpenBooking = walletDebtProviderOpenBookings.find(
  (item) => item.id === walletDebtBooking.id || item.id === blockedDirectBooking.id,
);
if (cashOpenBooking?.payment?.method !== 'CASH') {
  throw new Error(
    `Provider open bookings must include cash payment metadata: ${JSON.stringify(cashOpenBooking)}`,
  );
}
if (typeof cashOpenBooking.distanceMeters !== 'number' || cashOpenBooking.distanceMeters > 10000) {
  throw new Error(
    `Provider open bookings must expose only eligible 10km marketplace requests with distance metadata: ${JSON.stringify(
      cashOpenBooking,
    )}`,
  );
}
const acceptedWalletDebtBooking = await postJson(
  `/provider/bookings/${walletDebtBooking.id}/accept`,
  walletDebtProviderAuth.accessToken,
);
if (acceptedWalletDebtBooking.status !== 'IN_SERVICE') {
  throw new Error(
    `Direct acceptance should enter service immediately: ${JSON.stringify(acceptedWalletDebtBooking)}`,
  );
}
await completeBooking(walletDebtBooking.id, walletDebtProviderAuth.accessToken);
await postJson('/provider/online', walletDebtServiceGateProviderAuth.accessToken);
await postJson('/provider/location', walletDebtServiceGateProviderAuth.accessToken, {
  lat: 10.7783,
  lng: 106.6994,
});
const walletDebtServiceGateDebtBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtServiceGateProviderAuth.user.providerProfile.id,
  address: { line1: 'Negative wallet service gate debt source smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const acceptedWalletDebtServiceGateDebtBooking = await postJson(
  `/provider/bookings/${walletDebtServiceGateDebtBooking.id}/accept`,
  walletDebtServiceGateProviderAuth.accessToken,
);
if (acceptedWalletDebtServiceGateDebtBooking.status !== 'IN_SERVICE') {
  throw new Error(
    `Direct acceptance should enter service immediately: ${JSON.stringify(acceptedWalletDebtServiceGateDebtBooking)}`,
  );
}
await completeBooking(walletDebtServiceGateDebtBooking.id, walletDebtServiceGateProviderAuth.accessToken);
const walletDebtProviderNotifications = await getJson('/notifications', walletDebtProviderAuth.accessToken);
if (
  !walletDebtProviderNotifications.some(
    (notification) =>
      notification.type === 'provider.payout_setup_required' &&
      notification.data?.missing?.residentialAddress === true &&
      notification.data?.missing?.agreements?.includes('PAYOUT') &&
      notification.data?.missing?.taxProfileApproved !== true,
  )
) {
  throw new Error(
    `First provider earning should notify payout tax setup requirements: ${JSON.stringify(
      walletDebtProviderNotifications,
    )}`,
  );
}
const walletDebtProviderEarningsSummary = await getJson(
  '/provider/earnings/summary',
  walletDebtProviderAuth.accessToken,
);
if (
  walletDebtProviderEarningsSummary.walletBalance >= 0 ||
  walletDebtProviderEarningsSummary.walletBlocked !== true ||
  walletDebtProviderEarningsSummary.marketplaceVisibilityBlocked !== false ||
  walletDebtProviderEarningsSummary.marketplaceJoinBlocked !== false ||
  walletDebtProviderEarningsSummary.directFirstPickBlocked !== true ||
  walletDebtProviderEarningsSummary.alreadyMatchedServiceBlocked !== true ||
  walletDebtProviderEarningsSummary.payoutReleaseBlocked !== true ||
  walletDebtProviderEarningsSummary.walletDebtAmount <= 0 ||
  walletDebtProviderEarningsSummary.walletBlockCode !== 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT' ||
  walletDebtProviderEarningsSummary.walletSettlementRequired !== true ||
  walletDebtProviderEarningsSummary.walletSettlementMethod !== 'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET' ||
  !walletDebtProviderEarningsSummary.walletSettlementInstruction ||
  !walletDebtProviderEarningsSummary.walletBlockReason
) {
  throw new Error(
    `Cash booking did not create a negative provider wallet: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (!walletDebtProviderEarningsSummary.walletSettlementInstruction.includes('HANDS')) {
  throw new Error(
    `Negative wallet settlement instruction should explain HANDS repayment: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (
  !walletDebtProviderEarningsSummary.walletSettlementReference?.startsWith('HANDS-WALLET-') ||
  !Array.isArray(walletDebtProviderEarningsSummary.walletSettlementSteps) ||
  walletDebtProviderEarningsSummary.walletSettlementSteps.length < 3 ||
  !walletDebtProviderEarningsSummary.walletSettlementSteps.some((step) =>
    step.includes(walletDebtProviderEarningsSummary.walletSettlementReference),
  )
) {
  throw new Error(
    `Negative wallet summary should include deposit reference and operator steps: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
const expectedProviderWalletBlockReason =
  'Outstanding HANDS fee settlement must be completed before final booking acceptance, service start, or payout release.';
if (walletDebtProviderEarningsSummary.walletBlockReason !== expectedProviderWalletBlockReason) {
  throw new Error(
    `Negative wallet block reason should be readable and operator-approved: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (
  walletDebtProviderEarningsSummary.walletBlockDisplayMessage !==
  'Phí HANDS chưa được thanh toán nên bạn chưa thể xác nhận nhận lịch này.'
) {
  throw new Error(
    `Negative wallet summary should include the wallet block display message: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
const negativeWalletMarketplaceAccepted = await postJson(
  `/provider/bookings/${walletDebtJoinedBeforeDebtBooking.id}/accept`,
  walletDebtProviderAuth.accessToken,
);
if (negativeWalletMarketplaceAccepted.status !== 'ACCEPTED') {
  throw new Error(
    `Negative wallet should not block marketplace participation before customer selection: ${JSON.stringify(
      negativeWalletMarketplaceAccepted,
    )}`,
  );
}
const negativeWalletMarketplaceSelectionError = await expectRequestFailure(
  'Negative provider wallet blocks customer final selection of marketplace participant',
  () =>
    postJson(
      `/customer/bookings/${walletDebtJoinedBeforeDebtBooking.id}/select-provider`,
      customerAuth.accessToken,
      {
        providerId: walletDebtProviderAuth.user.providerProfile.id,
      },
    ),
  400,
);
assertNegativeWalletBlockResponse(
  'marketplace final selection after debt appears',
  negativeWalletMarketplaceSelectionError,
);
const blockedOpenMatchingBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'Negative wallet open matching smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'MOMO',
});
const negativeWalletVisibleMarketplaceBookings = await getJson(
  '/provider/bookings/open',
  walletDebtProviderAuth.accessToken,
);
const negativeWalletVisibleMarketplaceBooking = negativeWalletVisibleMarketplaceBookings.find(
  (item) => item.id === blockedOpenMatchingBooking.id,
);
if (
  !negativeWalletVisibleMarketplaceBooking ||
  typeof negativeWalletVisibleMarketplaceBooking.distanceMeters !== 'number' ||
  negativeWalletVisibleMarketplaceBooking.distanceMeters > 10000
) {
  throw new Error(
    `Negative wallet partner should still see marketplace request before settlement: ${JSON.stringify({
      expectedBookingId: blockedOpenMatchingBooking.id,
      visibleBooking: negativeWalletVisibleMarketplaceBooking,
      sample: negativeWalletVisibleMarketplaceBookings[0],
    })}`,
  );
}
const negativeWalletMarketplaceJoin = await postJson(
  `/provider/bookings/${blockedOpenMatchingBooking.id}/join`,
  walletDebtProviderAuth.accessToken,
);
if (negativeWalletMarketplaceJoin.event !== 'provider.joined') {
  throw new Error(
    `Negative wallet should allow marketplace participation before final selection: ${JSON.stringify(
      negativeWalletMarketplaceJoin,
    )}`,
  );
}
const directAcceptanceWalletBlockError = await expectRequestFailure(
  'Negative wallet blocks preferred Partner final acceptance',
  () =>
    postJson(
      `/provider/bookings/${blockedDirectBooking.id}/accept`,
      walletDebtProviderAuth.accessToken,
    ),
  400,
);
assertNegativeWalletBlockResponse('preferred Partner final acceptance', directAcceptanceWalletBlockError);
const payoutWalletBlockError = await expectRequestFailure(
  'Negative provider wallet holds payout batch creation',
  () =>
    postJson('/admin/payout-batches', adminAuth.accessToken, {
      providerProfileId: walletDebtProviderAuth.user.providerProfile.id,
      transferRef: `SMOKE-DEBT-HOLD-${Date.now()}`,
      notes: 'This should be blocked by cash fee debt',
    }),
  400,
);
for (const [label, message] of [['payout batch creation', payoutWalletBlockError]]) {
  assertNegativeWalletBlockResponse(label, message);
}
const adminEarningsAfterCashDebt = await getJson('/admin/earnings', adminAuth.accessToken);
const cashDebtEarning = adminEarningsAfterCashDebt.find(
  (earning) => earning.bookingId === walletDebtBooking.id && earning.netAmount < 0,
);
if (!cashDebtEarning) {
  throw new Error(
    `Cash debt earning was not visible to admin: ${JSON.stringify(adminEarningsAfterCashDebt[0])}`,
  );
}
const cashDebtSplitLedgerTypes = [
  'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
  'CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED',
  'CASH_BOOKING_PARTNER_TAX_DEDUCTED',
];
const cashDebtSplitLedgers = cashDebtSplitLedgerTypes.map((type) =>
  cashDebtEarning.walletLedgerEntries?.find((entry) => entry.type === type),
);
const cashDebtPlatformFeeLedger = cashDebtSplitLedgers[0];
const cashDebtCompanyVatLedger = cashDebtSplitLedgers[1];
const cashDebtPartnerTaxLedger = cashDebtSplitLedgers[2];
const cashDebtSplitLedgerTotal = cashDebtSplitLedgers.reduce(
  (total, entry) => total + Number(entry?.amount ?? 0),
  0,
);
if (
  cashDebtSplitLedgers.some((entry) => !entry) ||
  cashDebtSplitLedgerTotal !== cashDebtEarning.netAmount ||
  cashDebtPlatformFeeLedger?.metadata?.accountingComponent !== 'PLATFORM_FEE_NET_REVENUE' ||
  cashDebtCompanyVatLedger?.metadata?.accountingComponent !== 'COMPANY_OUTPUT_VAT_PAYABLE' ||
  cashDebtPartnerTaxLedger?.metadata?.accountingComponent !== 'PARTNER_VAT_PIT_PAYABLE' ||
  cashDebtPlatformFeeLedger.amount !==
    -Number(cashDebtPlatformFeeLedger.metadata?.walletDeductionPlatformFeeNetRevenue ?? NaN) ||
  cashDebtCompanyVatLedger.amount !==
    -Number(cashDebtCompanyVatLedger.metadata?.walletDeductionCompanyOutputVat ?? NaN) ||
  cashDebtPartnerTaxLedger.amount !==
    -Number(cashDebtPartnerTaxLedger.metadata?.walletDeductionPartnerTaxPayable ?? NaN)
) {
  throw new Error(`Cash debt split booking ledgers were not recorded: ${JSON.stringify(cashDebtEarning)}`);
}
const cashSettlementBookingQuery = encodeURIComponent(walletDebtBooking.id);
const adminCashSettlementEarnings = await getJson(
  `/admin/cash-settlement-earnings?q=${cashSettlementBookingQuery}`,
  adminAuth.accessToken,
);
const cashSettlementDebtRow = adminCashSettlementEarnings.find(
  (earning) => earning.bookingId === walletDebtBooking.id && earning.netAmount < 0,
);
if (!cashSettlementDebtRow || cashSettlementDebtRow.payoutBatchId) {
  throw new Error(
    `Cash settlement queue did not expose the open wallet debt row: ${JSON.stringify(
      adminCashSettlementEarnings[0],
    )}`,
  );
}
const adminCashSettlementSummary = await getJson(
  `/admin/cash-settlement-summary?q=${cashSettlementBookingQuery}`,
  adminAuth.accessToken,
);
if (
  adminCashSettlementSummary.rowCount < 1 ||
  adminCashSettlementSummary.providerCount < 1 ||
  adminCashSettlementSummary.totalDebtAmount < Math.abs(cashSettlementDebtRow.netAmount) ||
  adminCashSettlementSummary.cashPaymentRowCount < 1 ||
  !adminCashSettlementSummary.topProviderGroups?.some((group) => group.debtAmount > 0)
) {
  throw new Error(
    `Cash settlement summary did not expose open wallet debt totals: ${JSON.stringify(
      adminCashSettlementSummary,
    )}`,
  );
}
const adminPaymentsAfterCashDebt = await getJson('/admin/payments', adminAuth.accessToken);
const cashDebtPayment = adminPaymentsAfterCashDebt.find(
  (payment) => payment.bookingId === walletDebtBooking.id,
);
if (
  cashDebtPayment?.method !== 'CASH' ||
  cashDebtPayment?.booking?.earning?.id !== cashDebtEarning.id ||
  cashDebtPayment.booking.earning.netAmount >= 0 ||
  !cashDebtSplitLedgerTypes.every((type) =>
    cashDebtPayment.booking.earning.walletLedgerEntries?.some((entry) => entry.type === type),
  )
) {
  throw new Error(`Cash debt payment trace was not visible to admin: ${JSON.stringify(cashDebtPayment)}`);
}
const adminBookingsAfterCashDebt = await getJson('/admin/bookings', adminAuth.accessToken);
const cashDebtBookingInMonitor = adminBookingsAfterCashDebt.find(
  (booking) => booking.id === walletDebtBooking.id,
);
if (
  cashDebtBookingInMonitor?.earning?.id !== cashDebtEarning.id ||
  cashDebtBookingInMonitor.earning.netAmount >= 0
) {
  throw new Error(
    `Cash debt booking trace was not visible to booking monitor: ${JSON.stringify(cashDebtBookingInMonitor)}`,
  );
}
await expectRequestFailure(
  'Negative cash fee settlement requires a reference',
  () => postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {}),
  400,
);
await expectRequestFailure(
  'Negative cash fee settlement requires a method',
  () =>
    postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {
      settlementRef: `SMOKE-MISSING-METHOD-${Date.now()}`,
    }),
  400,
);
const cashDebtSettlementRef = `SMOKE-CASH-FEE-${Date.now()}`;
const cashDebtDepositRequest = await postJson(
  '/admin/provider-wallet/deposit-requests',
  adminAuth.accessToken,
  {
    providerProfileId: walletDebtProviderAuth.user.providerProfile.id,
    amount: Math.abs(cashDebtEarning.netAmount),
    bankTransactionId: cashDebtSettlementRef,
    depositDate: new Date().toISOString(),
    attachmentUrl: `http://localhost:9000/api-smoke-evidence/${cashDebtSettlementRef}.pdf`,
    notes: 'Smoke test cash fee deposit evidence',
  },
);
if (
  cashDebtDepositRequest.status !== 'REQUESTED' ||
  cashDebtDepositRequest.requestedByAdminId !== adminAuth.user.id
) {
  throw new Error(
    `Cash fee deposit request was not persisted for separate approval: ${JSON.stringify(cashDebtDepositRequest)}`,
  );
}
await expectRequestFailure(
  'Partner bank deposit rejects same-admin approval',
  () =>
    postJson(
      `/admin/provider-wallet/deposit-requests/${cashDebtDepositRequest.id}/approve`,
      adminAuth.accessToken,
    ),
  400,
);
const cashDebtDepositApproval = await postJson(
  `/admin/provider-wallet/deposit-requests/${cashDebtDepositRequest.id}/approve`,
  financeApproverAuth.accessToken,
);
if (
  cashDebtDepositApproval.request?.status !== 'EXECUTED' ||
  cashDebtDepositApproval.request?.approvedByAdminId !== financeApproverAuth.user.id ||
  cashDebtDepositApproval.ledger?.amount !== Math.abs(cashDebtEarning.netAmount)
) {
  throw new Error(
    `Cash fee deposit approval did not create the expected Wallet evidence: ${JSON.stringify(
      cashDebtDepositApproval,
    )}`,
  );
}
const cashDebtDepositAllocation = await postJson(
  `/admin/provider-wallet/deposit-requests/${cashDebtDepositRequest.id}/cash-debt-allocations`,
  adminAuth.accessToken,
  {
    earningId: cashDebtEarning.id,
    amount: Math.abs(cashDebtEarning.netAmount),
    notes: 'Smoke test approved deposit allocation to cash debt',
  },
);
if (
  cashDebtDepositAllocation.cashDebtFullyAllocated !== true ||
  cashDebtDepositAllocation.remainingReceivableRecovery !== 0 ||
  cashDebtDepositAllocation.remainingDebtAmount !== 0
) {
  throw new Error(
    `Cash fee deposit was not fully allocated to the selected debt: ${JSON.stringify(
      cashDebtDepositAllocation,
    )}`,
  );
}
const cashDebtDepositDetail = await getJson(
  `/admin/provider-wallet/deposit-requests/${cashDebtDepositRequest.id}`,
  adminAuth.accessToken,
);
if (
  cashDebtDepositDetail.remainingReceivableRecovery !== 0 ||
  cashDebtDepositDetail.request?.cashDebtAllocations?.length !== 1 ||
  cashDebtDepositDetail.ledger?.reference !== cashDebtSettlementRef ||
  cashDebtDepositDetail.journal?.totalDebit !== cashDebtDepositDetail.journal?.totalCredit
) {
  throw new Error(
    `Cash fee deposit detail did not preserve Wallet, GL, and allocation evidence: ${JSON.stringify(
      cashDebtDepositDetail,
    )}`,
  );
}
if (
  cashDebtDepositDetail.auditLogs?.filter((log) => log.action === 'partner_bank_deposit.cash_debt_allocate')
    .length !== 1
) {
  throw new Error(
    `Cash fee deposit allocation audit evidence was not visible: ${JSON.stringify(
      cashDebtDepositDetail.auditLogs,
    )}`,
  );
}
const adminEarningsAfterCashSettlement = await getJson('/admin/earnings', adminAuth.accessToken);
const settledCashDebtEarning = adminEarningsAfterCashSettlement.find(
  (earning) => earning.id === cashDebtEarning.id,
);
if (settledCashDebtEarning?.settlementRef !== cashDebtSettlementRef) {
  throw new Error(
    `Cash fee settlement reference was not persisted: ${JSON.stringify(settledCashDebtEarning)}`,
  );
}
if (settledCashDebtEarning?.settlementMethod !== 'PARTNER_DEPOSIT') {
  throw new Error(`Cash fee settlement method was not persisted: ${JSON.stringify(settledCashDebtEarning)}`);
}
const cashDebtSettlementLedger = settledCashDebtEarning.walletLedgerEntries?.find(
  (entry) => entry.type === 'CASH_FEE_DEBT_SETTLED',
);
if (
  cashDebtSettlementLedger ||
  cashDebtDepositDetail.ledger?.type !== 'PARTNER_BANK_DEPOSIT_RECEIVED' ||
  cashDebtDepositDetail.ledger?.amount !== Math.abs(cashDebtEarning.netAmount)
) {
  throw new Error(
    `Approved deposit allocation should reuse deposit Wallet evidence without a duplicate debt-settled entry: ${JSON.stringify(
      { cashDebtDepositDetail, settledCashDebtEarning },
    )}`,
  );
}
const walletDebtProviderSummaryAfterSettlement = await getJson(
  '/provider/earnings/summary',
  walletDebtProviderAuth.accessToken,
);
if (
  walletDebtProviderSummaryAfterSettlement.walletBalance < 0 ||
  walletDebtProviderSummaryAfterSettlement.walletBlocked === true
) {
  throw new Error(
    `Cash fee settlement did not unblock provider wallet: ${JSON.stringify(
      walletDebtProviderSummaryAfterSettlement,
    )}`,
  );
}
const matched = await postJson(`/customer/bookings/${booking.id}/select-provider`, customerAuth.accessToken, {
  providerId: providerAuth.user.providerProfile.id,
});
if (matched.status !== 'IN_SERVICE') {
  throw new Error(
    `Marketplace customer selection should enter service immediately: ${JSON.stringify(matched)}`,
  );
}

const customerBookings = await getJson('/customer/bookings', customerAuth.accessToken);
const providerBookings = await getJson('/provider/bookings', providerAuth.accessToken);
const partnerAliasMe = await getJson('/partner/me', providerAuth.accessToken);
const partnerAliasBookings = await getJson('/partner/bookings', providerAuth.accessToken);
const partnerAliasOnboarding = await getJson('/partner/onboarding', providerAuth.accessToken);
const chatRoomId = matched.booking.chatRoom.id;
const repairedMatchedChat = await postJson(
  `/admin/bookings/${booking.id}/repair-chat-room`,
  adminAuth.accessToken,
);
if (
  repairedMatchedChat?.id !== booking.id ||
  repairedMatchedChat?.chatRoom?.id !== chatRoomId ||
  repairedMatchedChat?.selectedProvider?.id !== providerAuth.user.providerProfile.id
) {
  throw new Error(
    `Admin chat repair should retain the matched chat room: ${JSON.stringify(repairedMatchedChat)}`,
  );
}
const repairedMatchedChatDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (!repairedMatchedChatDetail.auditLogs?.some((log) => log.action === 'booking.chat_room.repair')) {
  throw new Error(
    `Admin chat repair should leave an audit trail on booking detail: ${JSON.stringify(
      repairedMatchedChatDetail.auditLogs?.slice(0, 5),
    )}`,
  );
}

const partnerResponseAfterMatchError = await expectRequestFailure(
  'Partner response after matching is blocked',
  () => postJson(`/provider/bookings/${booking.id}/reject`, providerAuth.accessToken),
  409,
);
if (
  !partnerResponseAfterMatchError.includes(
    'Booking is already matched or no longer open for partner response',
  )
) {
  throw new Error(
    `Partner response after matching returned an unexpected error: ${partnerResponseAfterMatchError}`,
  );
}

if (partnerAliasMe.id !== providerAuth.user.id) {
  throw new Error(`Partner alias /partner/me returned the wrong user: ${JSON.stringify(partnerAliasMe)}`);
}
if (!partnerAliasBookings.some((item) => item.id === booking.id)) {
  throw new Error(`Partner alias bookings did not include the matched booking.`);
}
if (partnerAliasOnboarding.providerProfileId !== providerAuth.user.providerProfile.id) {
  throw new Error(`Partner alias onboarding snapshot is incomplete.`);
}

const chatMessage = await postJson(`/chat/rooms/${chatRoomId}/messages`, customerAuth.accessToken, {
  body: 'Hello, see you soon.',
});

await completeBooking(booking.id, providerAuth.accessToken);

const completedAdminChatDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (
  completedAdminChatDetail?.status !== 'COMPLETED' ||
  completedAdminChatDetail?.chatRoom?.id !== chatRoomId ||
  !completedAdminChatDetail?.chatRoom?.messages?.some((message) => message.id === chatMessage.id)
) {
  throw new Error(
    `Completed booking did not retain admin chat archive: ${JSON.stringify(completedAdminChatDetail)}`,
  );
}
const reviewedProviderProfileId =
  completedAdminChatDetail?.selectedProvider?.id ?? providerAuth.user.providerProfile.id;

const completedChatArchive = await getJson('/admin/chat-archive', adminAuth.accessToken);
if (
  !completedChatArchive.some(
    (item) =>
      item.id === booking.id &&
      item.chatRoom?.id === chatRoomId &&
      item.chatRoom?.messages?.some((message) => message.id === chatMessage.id),
  )
) {
  throw new Error(
    `Admin chat archive did not retain completed booking messages: ${JSON.stringify(
      completedChatArchive.slice(0, 5),
    )}`,
  );
}

const review = await postJson('/customer/reviews', customerAuth.accessToken, {
  bookingId: booking.id,
  rating: 5,
  comment: 'Great service.',
});
const duplicateReviewError = await expectRequestFailure(
  'Duplicate completed-booking review should be blocked',
  () =>
    postJson('/customer/reviews', customerAuth.accessToken, {
      bookingId: booking.id,
      rating: 4,
      comment: 'Second review attempt',
    }),
  400,
);
if (!duplicateReviewError.includes('Review already exists for this booking')) {
  throw new Error(`Duplicate review guard returned an unexpected error: ${duplicateReviewError}`);
}

const publicProviderDetailAfterReview = await request(`/customer/partners/${reviewedProviderProfileId}`);
const publicReviewCountAfterCreate = Array.isArray(publicProviderDetailAfterReview?.reviews)
  ? publicProviderDetailAfterReview.reviews.length
  : 0;
if (
  !publicProviderDetailAfterReview?.reviews?.some(
    (item) => item?.comment === 'Great service.' && item?.rating === 5,
  ) ||
  (publicProviderDetailAfterReview?.reviewCount ?? 0) < 1
) {
  throw new Error(
    `Public provider detail did not expose the newly published review: ${JSON.stringify(
      publicProviderDetailAfterReview,
    )}`,
  );
}

await patchJson(`/admin/reviews/${review.id}/moderate`, adminAuth.accessToken, {
  status: 'HIDDEN',
  reportReason: 'Held by admin',
});
const publicProviderDetailAfterHold = await request(`/customer/partners/${reviewedProviderProfileId}`);
if (
  publicProviderDetailAfterHold?.reviews?.some((item) => item?.comment === 'Great service.') ||
  (publicProviderDetailAfterHold?.reviewCount ?? 0) >= publicReviewCountAfterCreate
) {
  throw new Error(
    `Held review still appears in public provider detail: ${JSON.stringify(publicProviderDetailAfterHold)}`,
  );
}

await patchJson(`/admin/reviews/${review.id}/moderate`, adminAuth.accessToken, {
  status: 'PUBLISHED',
});
const publicProviderDetailAfterRepublish = await request(`/customer/partners/${reviewedProviderProfileId}`);
if (
  !publicProviderDetailAfterRepublish?.reviews?.some(
    (item) => item?.comment === 'Great service.' && item?.rating === 5,
  ) ||
  (publicProviderDetailAfterRepublish?.reviewCount ?? 0) < publicReviewCountAfterCreate
) {
  throw new Error(
    `Republished review did not return to public provider detail: ${JSON.stringify(
      publicProviderDetailAfterRepublish,
    )}`,
  );
}

const completedCloseout = await postJson(`/admin/bookings/${booking.id}/closeout`, adminAuth.accessToken, {
  note: 'Smoke test completed booking closeout',
});
if (
  completedCloseout.status !== 'COMPLETED' ||
  completedCloseout.payment?.status !== 'CAPTURED' ||
  !completedCloseout.earning?.id ||
  !completedCloseout.earning?.taxLogs?.length ||
  !completedCloseout.earning?.platformFeeLogs?.length ||
  !completedCloseout.earning?.walletLedgerEntries?.length
) {
  throw new Error(
    `Completed closeout did not reconcile finance records: ${JSON.stringify(completedCloseout)}`,
  );
}

const providerEarnings = await getJson('/provider/earnings', providerAuth.accessToken);
const providerEarningsSummary = await getJson('/provider/earnings/summary', providerAuth.accessToken);
const partnerAliasEarningsSummary = await getJson('/partner/earnings/summary', providerAuth.accessToken);
const completedEarning = providerEarnings.find((earning) => earning.bookingId === booking.id);
if (
  !completedEarning ||
  completedEarning.withholdingAmount <= 0 ||
  completedEarning.netAmount !==
    completedEarning.grossAmount - completedEarning.platformFee - completedEarning.withholdingAmount
) {
  throw new Error(`Completed earning did not apply withholding policy: ${JSON.stringify(completedEarning)}`);
}
if (providerEarningsSummary.withholdingAmount <= 0) {
  throw new Error(`Earnings summary did not include withholding: ${JSON.stringify(providerEarningsSummary)}`);
}
if (partnerAliasEarningsSummary.providerProfileId !== providerEarningsSummary.providerProfileId) {
  throw new Error(`Partner alias earnings summary returned a different profile.`);
}
const adminCompletedEarning = (await getJson('/admin/earnings', adminAuth.accessToken)).find(
  (earning) => earning.bookingId === booking.id,
);
const completedPaymentClearingEntry = (
  await getJson('/admin/booking-payment-clearing?review=open&take=50', adminAuth.accessToken)
).find((entry) => entry.bookingId === booking.id);
if (
  !completedPaymentClearingEntry ||
  completedPaymentClearingEntry.status !== 'OPEN' ||
  completedPaymentClearingEntry.amount !== completedCloseout.payment.amount
) {
  throw new Error(
    `Completed booking did not create an open payment clearing entry: ${JSON.stringify({
      completedPaymentClearingEntry,
      payment: completedCloseout.payment,
    })}`,
  );
}
const completedSettlementSnapshot = (
  await getJson('/admin/booking-settlement-snapshots?range=all&review=posted&take=100', adminAuth.accessToken)
).find((snapshot) => snapshot.bookingId === booking.id);
if (
  !completedSettlementSnapshot ||
  completedSettlementSnapshot.customerPaymentAmount !== completedCloseout.payment.amount ||
  completedSettlementSnapshot.partnerPayoutAmount !== completedEarning.netAmount ||
  completedSettlementSnapshot.partnerWithholdingTotal !== completedEarning.withholdingAmount ||
  completedSettlementSnapshot.paymentProcessingFee < 0 ||
  completedSettlementSnapshot.platformFeeNetRevenue <= 0 ||
  completedSettlementSnapshot.companyOutputVat < 0 ||
  completedSettlementSnapshot.platformFeeGross !==
    completedSettlementSnapshot.platformFeeNetRevenue + completedSettlementSnapshot.companyOutputVat
) {
  throw new Error(
    `Completed booking settlement snapshot did not preserve finance split: ${JSON.stringify({
      completedSettlementSnapshot,
      completedEarning,
      payment: completedCloseout.payment,
    })}`,
  );
}
const completedSettlementSnapshotDetail = await getJson(
  `/admin/booking-settlement-snapshots/${completedSettlementSnapshot.id}`,
  adminAuth.accessToken,
);
const completedSettlementJournalSummary = completedSettlementSnapshotDetail.accountingJournalBatches?.find(
  (journal) => journal.sourceType === 'BOOKING_SETTLEMENT' && journal.status === 'POSTED',
);
if (
  !completedSettlementJournalSummary ||
  completedSettlementJournalSummary.totalDebit !== completedSettlementJournalSummary.totalCredit
) {
  throw new Error(
    `Completed settlement snapshot detail did not expose a balanced booking journal: ${JSON.stringify(
      completedSettlementSnapshotDetail,
    )}`,
  );
}
const completedSettlementJournal = await getJson(
  `/admin/accounting-journal-batches/${completedSettlementJournalSummary.id}`,
  adminAuth.accessToken,
);
assertBalancedAccountingJournal('Completed booking settlement journal', completedSettlementJournal);
assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
  accountCode: 'booking_payment_clearing',
  amount: completedCloseout.payment.amount,
  side: 'DEBIT',
});
assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
  accountCode: 'partner_wallet_liability',
  amount: completedEarning.netAmount,
  side: 'CREDIT',
});
assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
  accountCode: 'partner_vat_pit_payable',
  amount: completedEarning.withholdingAmount,
  side: 'CREDIT',
});
assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
  accountCode: 'platform_fee_net_revenue',
  amount: completedSettlementSnapshot.platformFeeNetRevenue,
  side: 'CREDIT',
});
if (completedSettlementSnapshot.companyOutputVat > 0) {
  assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
    accountCode: 'company_output_vat_payable',
    amount: completedSettlementSnapshot.companyOutputVat,
    side: 'CREDIT',
  });
}
if (completedSettlementSnapshot.paymentProcessingFee > 0) {
  assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
    accountCode: 'payment_processing_fee_expense',
    amount: completedSettlementSnapshot.paymentProcessingFee,
    side: 'DEBIT',
  });
  assertJournalEntry('Completed booking settlement journal', completedSettlementJournal, {
    accountCode: 'payment_processing_fee_clearing',
    amount: completedSettlementSnapshot.paymentProcessingFee,
    side: 'CREDIT',
  });
}
const manualWalletAdjustmentAmount = 10000;
const manualWalletAdjustmentPayload = {
  ownerType: 'CUSTOMER',
  ownerId: customerAuth.user.customerProfile.id,
  direction: 'CREDIT',
  adjustmentType: 'CUSTOMER_COMPENSATION',
  amount: manualWalletAdjustmentAmount,
  reason: 'API smoke customer compensation credit without bank cash, revenue, or output VAT.',
};
let manualWalletDualApprovalGuardsReady = false;
const manualWalletLegacyBypassId = `SMOKE-LEGACY-BYPASS-${Date.now()}`;
// Intentional legacy caller: this proves the compatibility route cannot execute an arbitrary approval id.
const manualWalletLegacyBypassFailure = await expectRequestFailure(
  'Legacy manual wallet adjustment rejects arbitrary approval ids',
  () =>
    postJson('/admin/wallet-adjustments', adminAuth.accessToken, {
      ...manualWalletAdjustmentPayload,
      approvalId: manualWalletLegacyBypassId,
      approvalAdminId: adminAuth.user.id,
    }),
  404,
);
if (!manualWalletLegacyBypassFailure.includes(`request ${manualWalletLegacyBypassId} was not found`)) {
  throw new Error(
    `Legacy manual wallet adjustment bypass guard returned unexpected message: ${manualWalletLegacyBypassFailure}`,
  );
}
const manualWalletAdjustmentRequest = await postJson(
  '/admin/wallet-adjustment-requests',
  adminAuth.accessToken,
  { ...manualWalletAdjustmentPayload, idempotencyKey: randomUUID() },
);
if (
  manualWalletAdjustmentRequest.status !== 'REQUESTED' ||
  manualWalletAdjustmentRequest.requestedByAdminId !== adminAuth.user.id ||
  manualWalletAdjustmentRequest.ledgerEntryId
) {
  throw new Error(
    `Manual wallet adjustment request was not persisted safely: ${JSON.stringify(
      manualWalletAdjustmentRequest,
    )}`,
  );
}
const manualWalletAdjustmentApprovalId = manualWalletAdjustmentRequest.id;
const manualWalletSameAdminFailure = await expectRequestFailure(
  'Manual wallet adjustment rejects same-admin approval',
  () =>
    postJson(
      `/admin/wallet-adjustment-requests/${encodeURIComponent(manualWalletAdjustmentApprovalId)}/approve`,
      adminAuth.accessToken,
      {},
    ),
  400,
);
if (
  !manualWalletSameAdminFailure.includes('Manual wallet adjustment requires approval from a different admin')
) {
  throw new Error(
    `Manual wallet adjustment same-admin guard returned unexpected message: ${manualWalletSameAdminFailure}`,
  );
}
const manualWalletNonFinanceFailure = await expectRequestFailure(
  'Manual wallet adjustment rejects non-finance approver',
  () =>
    postJson(
      `/admin/wallet-adjustment-requests/${encodeURIComponent(manualWalletAdjustmentApprovalId)}/approve`,
      nonFinanceAdminAuth.accessToken,
      {},
    ),
  400,
);
if (
  !manualWalletNonFinanceFailure.includes(
    'Manual wallet adjustment requires approval from a finance approver',
  )
) {
  throw new Error(
    `Manual wallet adjustment non-finance guard returned unexpected message: ${manualWalletNonFinanceFailure}`,
  );
}
manualWalletDualApprovalGuardsReady = true;
const manualWalletAdjustmentPreview = await postJson(
  '/admin/wallet-adjustments/preview',
  adminAuth.accessToken,
  manualWalletAdjustmentPayload,
);
if (
  manualWalletAdjustmentPreview.walletDelta !== manualWalletAdjustmentAmount ||
  manualWalletAdjustmentPreview.bankCashAmount !== 0 ||
  manualWalletAdjustmentPreview.companyOutputVat !== 0 ||
  manualWalletAdjustmentPreview.platformRevenueAmount !== 0 ||
  manualWalletAdjustmentPreview.affects?.bankCash !== false ||
  manualWalletAdjustmentPreview.affects?.revenue !== false ||
  manualWalletAdjustmentPreview.affects?.taxPayable !== false
) {
  throw new Error(
    `Manual wallet adjustment preview should affect wallet/expense only: ${JSON.stringify(
      manualWalletAdjustmentPreview,
    )}`,
  );
}
const manualWalletAdjustmentResult = await postJson(
  `/admin/wallet-adjustment-requests/${encodeURIComponent(manualWalletAdjustmentApprovalId)}/approve`,
  financeApproverAuth.accessToken,
  {},
);
if (
  manualWalletAdjustmentResult.request?.status !== 'EXECUTED' ||
  manualWalletAdjustmentResult.request?.approvedByAdminId !== financeApproverAuth.user.id ||
  manualWalletAdjustmentResult.ledger?.amount !== manualWalletAdjustmentAmount ||
  manualWalletAdjustmentResult.preview?.afterBalance !== manualWalletAdjustmentPreview.afterBalance ||
  manualWalletAdjustmentResult.preview?.bankCashAmount !== 0 ||
  manualWalletAdjustmentResult.preview?.companyOutputVat !== 0 ||
  manualWalletAdjustmentResult.preview?.platformRevenueAmount !== 0
) {
  throw new Error(
    `Manual wallet adjustment approval did not preserve preview accounting: ${JSON.stringify({
      manualWalletAdjustmentPreview,
      manualWalletAdjustmentResult,
    })}`,
  );
}
const manualWalletAdjustmentRows = await getJson(
  `/admin/wallet-adjustments?ownerType=CUSTOMER&ownerId=${encodeURIComponent(
    customerAuth.user.customerProfile.id,
  )}&take=25`,
  adminAuth.accessToken,
);
const manualWalletAdjustmentRow = manualWalletAdjustmentRows.find(
  (row) =>
    row.id === manualWalletAdjustmentResult.ledger.id && row.approvalId === manualWalletAdjustmentApprovalId,
);
if (
  !manualWalletAdjustmentRow ||
  manualWalletAdjustmentRow.walletDelta !== manualWalletAdjustmentAmount ||
  manualWalletAdjustmentRow.ownerType !== 'CUSTOMER'
) {
  throw new Error(
    `Manual wallet adjustment list did not expose the created ledger row: ${JSON.stringify({
      manualWalletAdjustmentRow,
      manualWalletAdjustmentRows,
    })}`,
  );
}
const manualWalletAdjustmentJournalSummary = (
  await getJson('/admin/accounting-journal-batches?range=all&review=posted&take=100', adminAuth.accessToken)
).find(
  (journal) =>
    journal.sourceType === 'MANUAL_WALLET_ADJUSTMENT' &&
    journal.sourceKey ===
      `accounting-journal:manual-wallet-adjustment:CUSTOMER:${customerAuth.user.customerProfile.id}:${manualWalletAdjustmentApprovalId}`,
);
if (!manualWalletAdjustmentJournalSummary) {
  throw new Error(
    `Manual wallet adjustment did not create a posted journal batch: ${JSON.stringify({
      manualWalletAdjustmentApprovalId,
      manualWalletAdjustmentResult,
    })}`,
  );
}
const manualWalletAdjustmentJournal = await getJson(
  `/admin/accounting-journal-batches/${manualWalletAdjustmentJournalSummary.id}`,
  adminAuth.accessToken,
);
assertBalancedAccountingJournal('Manual wallet adjustment journal', manualWalletAdjustmentJournal);
assertJournalEntry('Manual wallet adjustment journal', manualWalletAdjustmentJournal, {
  accountCode: 'customer_compensation_expense',
  amount: manualWalletAdjustmentAmount,
  side: 'DEBIT',
});
assertJournalEntry('Manual wallet adjustment journal', manualWalletAdjustmentJournal, {
  accountCode: 'customer_wallet_liability',
  amount: manualWalletAdjustmentAmount,
  side: 'CREDIT',
});
const companyBankAccountLifecycleSeed = Date.now();
const companyBankAccountLifecycleName = `Smoke staged account ${companyBankAccountLifecycleSeed}`;
const companyBankAccountLifecycleUpdatedName = `${companyBankAccountLifecycleName} approved`;
const companyBankAccountLifecycleRequest = await postJson(
  '/admin/company-bank-accounts',
  adminAuth.accessToken,
  {
    accountNumberLast4: String(companyBankAccountLifecycleSeed % 10000).padStart(4, '0'),
    bankCode: 'VCB',
    bankName: `Smoke lifecycle bank ${companyBankAccountLifecycleSeed}`,
    currency: 'VND',
    direction: 'BOTH',
    evidenceObjectId: `smoke/company-bank-accounts/${companyBankAccountLifecycleSeed}`,
    idempotencyKey: `company-bank-create-${companyBankAccountLifecycleSeed}`,
    isPrimary: false,
    legalOwnerName: 'HANDS Vietnam smoke evidence',
    name: companyBankAccountLifecycleName,
    operatorReason: 'Reviewed staged company bank account ownership evidence.',
    purpose: 'RECONCILIATION',
    statementImportTestedAt: new Date().toISOString(),
    verificationMethod: 'API smoke ownership evidence',
    verificationStatus: 'VERIFIED',
  },
);
await registerApiSmokeCompanyBankAccount(
  companyBankAccountLifecycleRequest.id,
  'api-smoke-company-bank-account-lifecycle',
);
const companyBankAccountCreateApproval = companyBankAccountLifecycleRequest.metadata?.pendingApproval;
if (
  companyBankAccountLifecycleRequest.status !== 'INACTIVE' ||
  companyBankAccountCreateApproval?.operation !== 'CREATE' ||
  companyBankAccountCreateApproval?.requestedByAdminId !== adminAuth.user.id ||
  !companyBankAccountCreateApproval?.requestId
) {
  throw new Error(
    `Company bank account create did not stage inactive maker evidence: ${JSON.stringify(
      companyBankAccountLifecycleRequest,
    )}`,
  );
}
const companyBankAccountMakerQueue = await getJson(
  '/admin/finance-approval-queue?take=25',
  adminAuth.accessToken,
);
const companyBankAccountMakerQueueRequest = companyBankAccountMakerQueue.companyBankAccountRequests?.find(
  (request) => request.requestId === companyBankAccountCreateApproval.requestId,
);
if (
  companyBankAccountMakerQueue.summary?.companyBankAccountPendingCount < 1 ||
  companyBankAccountMakerQueueRequest?.reviewState !== 'BLOCKED'
) {
  throw new Error(
    `Company bank account request was not blocked for its maker in the central approval queue: ${JSON.stringify(
      companyBankAccountMakerQueue,
    )}`,
  );
}
const companyBankAccountFinanceOverview = await getJson(
  '/admin/finance-overview?range=today',
  adminAuth.accessToken,
);
const companyBankAccountStartShift = await getJson(
  '/admin/dashboard/start-shift-summary?dateRange=today',
  adminAuth.accessToken,
);
if (
  companyBankAccountFinanceOverview.companyBankAccountApprovalSummary?.pendingCount < 1 ||
  companyBankAccountStartShift.financeReviewWorkload?.companyBankAccounts?.pendingCount < 1
) {
  throw new Error(
    `Company bank account approval request was missing from Finance command summaries: ${JSON.stringify({
      financeOverview: companyBankAccountFinanceOverview.companyBankAccountApprovalSummary,
      startShift: companyBankAccountStartShift.financeReviewWorkload?.companyBankAccounts,
    })}`,
  );
}
const companyBankAccountApproverQueue = await getJson(
  '/admin/finance-approval-queue?take=25',
  financeApproverAuth.accessToken,
);
const companyBankAccountApproverQueueRequest =
  companyBankAccountApproverQueue.companyBankAccountRequests?.find(
    (request) => request.requestId === companyBankAccountCreateApproval.requestId,
  );
if (
  companyBankAccountApproverQueueRequest?.reviewState !== 'READY' ||
  companyBankAccountApproverQueueRequest?.proposed?.name !== companyBankAccountLifecycleName
) {
  throw new Error(
    `Company bank account request was not ready for a different approver in the central queue: ${JSON.stringify(
      companyBankAccountApproverQueue,
    )}`,
  );
}
const companyBankAccountSelfApprovalFailure = await expectRequestFailure(
  'Company bank account approval rejects the request maker',
  () =>
    postJson(
      `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}/approval-decision`,
      adminAuth.accessToken,
      {
        decision: 'APPROVE',
        operatorReason: 'Attempting to approve the same operator request.',
        requestId: companyBankAccountCreateApproval.requestId,
      },
    ),
  400,
);
if (!companyBankAccountSelfApprovalFailure.includes('requires a different Finance approver')) {
  throw new Error(
    `Company bank account self-approval guard returned unexpected message: ${companyBankAccountSelfApprovalFailure}`,
  );
}
const companyBankAccountCreated = await postJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}/approval-decision`,
  financeApproverAuth.accessToken,
  {
    decision: 'APPROVE',
    operatorReason: 'Verified staged account ownership and import purpose.',
    requestId: companyBankAccountCreateApproval.requestId,
  },
);
if (companyBankAccountCreated.status !== 'INACTIVE' || companyBankAccountCreated.metadata?.pendingApproval) {
  throw new Error(
    `Company bank account create approval did not preserve the inactive activation gate: ${JSON.stringify(
      companyBankAccountCreated,
    )}`,
  );
}
const companyBankAccountQueueAfterApproval = await getJson(
  '/admin/finance-approval-queue?take=25',
  financeApproverAuth.accessToken,
);
if (
  companyBankAccountQueueAfterApproval.companyBankAccountRequests?.some(
    (request) => request.requestId === companyBankAccountCreateApproval.requestId,
  )
) {
  throw new Error('Approved company bank account request remained in the central approval queue');
}
const companyBankAccountActivationRequest = await patchJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}`,
  adminAuth.accessToken,
  {
    idempotencyKey: `company-bank-activate-${companyBankAccountLifecycleSeed}`,
    operatorReason: 'Activate after ownership verification and statement import test.',
    status: 'ACTIVE',
  },
);
const companyBankAccountActivationApproval = companyBankAccountActivationRequest.metadata?.pendingApproval;
if (
  companyBankAccountActivationRequest.status !== 'INACTIVE' ||
  companyBankAccountActivationApproval?.proposed?.status !== 'ACTIVE'
) {
  throw new Error(
    `Company bank account activated before checker approval: ${JSON.stringify(companyBankAccountActivationRequest)}`,
  );
}
const companyBankAccountActivated = await postJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}/approval-decision`,
  financeApproverAuth.accessToken,
  {
    decision: 'APPROVE',
    operatorReason: 'Verified activation readiness and approved operational use.',
    requestId: companyBankAccountActivationApproval.requestId,
  },
);
if (companyBankAccountActivated.status !== 'ACTIVE' || companyBankAccountActivated.metadata?.pendingApproval) {
  throw new Error(
    `Company bank account activation approval did not apply the exact proposal: ${JSON.stringify(
      companyBankAccountActivated,
    )}`,
  );
}
const companyBankAccountUpdateRequest = await patchJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}`,
  adminAuth.accessToken,
  {
    idempotencyKey: `company-bank-update-${companyBankAccountLifecycleSeed}`,
    name: companyBankAccountLifecycleUpdatedName,
    operatorReason: 'Reviewed staged company bank account display name change.',
  },
);
const companyBankAccountUpdateApproval = companyBankAccountUpdateRequest.metadata?.pendingApproval;
if (
  companyBankAccountUpdateRequest.name !== companyBankAccountLifecycleName ||
  companyBankAccountUpdateApproval?.operation !== 'UPDATE' ||
  companyBankAccountUpdateApproval?.proposed?.name !== companyBankAccountLifecycleUpdatedName
) {
  throw new Error(
    `Company bank account update changed managed fields before approval: ${JSON.stringify(
      companyBankAccountUpdateRequest,
    )}`,
  );
}
const companyBankAccountUpdated = await postJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}/approval-decision`,
  financeApproverAuth.accessToken,
  {
    decision: 'APPROVE',
    operatorReason: 'Verified the staged account display name change.',
    requestId: companyBankAccountUpdateApproval.requestId,
  },
);
if (
  companyBankAccountUpdated.name !== companyBankAccountLifecycleUpdatedName ||
  companyBankAccountUpdated.metadata?.pendingApproval
) {
  throw new Error(
    `Company bank account update approval did not apply exact proposal: ${JSON.stringify(
      companyBankAccountUpdated,
    )}`,
  );
}
const companyBankAccountStatusRequest = await patchJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}`,
  adminAuth.accessToken,
  {
    idempotencyKey: `company-bank-archive-${companyBankAccountLifecycleSeed}`,
    operatorReason: 'Archive completed staged account lifecycle smoke evidence.',
    status: 'INACTIVE',
  },
);
const companyBankAccountStatusApproval = companyBankAccountStatusRequest.metadata?.pendingApproval;
if (
  companyBankAccountStatusRequest.status !== 'ACTIVE' ||
  companyBankAccountStatusApproval?.proposed?.status !== 'INACTIVE'
) {
  throw new Error(
    `Company bank account status changed before approval: ${JSON.stringify(companyBankAccountStatusRequest)}`,
  );
}
const companyBankAccountArchived = await postJson(
  `/admin/company-bank-accounts/${companyBankAccountLifecycleRequest.id}/approval-decision`,
  financeApproverAuth.accessToken,
  {
    decision: 'APPROVE',
    operatorReason: 'Verified the staged account archive request.',
    requestId: companyBankAccountStatusApproval.requestId,
  },
);
if (
  companyBankAccountArchived.status !== 'INACTIVE' ||
  companyBankAccountArchived.metadata?.pendingApproval
) {
  throw new Error(
    `Company bank account status approval did not archive exact proposal: ${JSON.stringify(
      companyBankAccountArchived,
    )}`,
  );
}
const smokeCompanyBankAccount = await ensureSmokeCompanyBankAccount();
const bankReconciliationTransferRef = `SMOKE-BANK-${Date.now()}`;
const completedPaymentClearingCurrency = completedPaymentClearingEntry.currency ?? 'VND';
const smokeBankTransaction = await postJson(
  '/admin/bank-reconciliation/transactions',
  adminAuth.accessToken,
  {
    amount: completedPaymentClearingEntry.amount,
    bankAccountId: smokeCompanyBankAccount.id,
    confirmPotentialDuplicate: true,
    counterpartyName: 'HANDS API smoke customer',
    currency: completedPaymentClearingCurrency,
    description: 'API smoke manual bank import for payment clearing reconciliation.',
    occurredAt: new Date().toISOString(),
    operatorReason: 'Reviewed repeatable API smoke bank evidence before import.',
    transferRef: bankReconciliationTransferRef,
    type: 'INFLOW',
    valueDate: new Date().toISOString(),
  },
);
if (
  smokeBankTransaction.status !== 'UNMATCHED' ||
  smokeBankTransaction.amount !== completedPaymentClearingEntry.amount ||
  smokeBankTransaction.transferRef !== bankReconciliationTransferRef
) {
  throw new Error(
    `Manual bank transaction import did not return an unmatched row: ${JSON.stringify(smokeBankTransaction)}`,
  );
}
const smokeBankReconciliationAssignment = await postJson(
  `/admin/bank-reconciliation/${smokeBankTransaction.id}/review-assignment`,
  adminAuth.accessToken,
  {
    assigneeAdminId: adminAuth.user.id,
    reason: 'API smoke assigned bank reconciliation evidence review.',
  },
);
if (smokeBankReconciliationAssignment.assignee?.id !== adminAuth.user.id) {
  throw new Error(
    `Bank reconciliation review owner assignment failed: ${JSON.stringify(
      smokeBankReconciliationAssignment,
    )}`,
  );
}
const smokeBankReconciliationMatch = await postJson(
  `/admin/bank-reconciliation/${smokeBankTransaction.id}/matches`,
  financeApproverAuth.accessToken,
  {
    amount: completedPaymentClearingEntry.amount,
    currency: completedPaymentClearingCurrency,
    notes: 'API smoke payment clearing match.',
    paymentClearingEntryId: completedPaymentClearingEntry.id,
  },
);
if (
  smokeBankReconciliationMatch.bankTransaction?.status !== 'MATCHED' ||
  smokeBankReconciliationMatch.paymentClearingEntry?.status !== 'CLEARED' ||
  smokeBankReconciliationMatch.match?.status !== 'MATCHED' ||
  smokeBankReconciliationMatch.match?.paymentClearingEntryId !== completedPaymentClearingEntry.id ||
  smokeBankReconciliationMatch.match?.amount !== completedPaymentClearingEntry.amount ||
  smokeBankReconciliationMatch.match?.currency !== completedPaymentClearingCurrency
) {
  throw new Error(
    `Bank reconciliation match did not close the bank and payment clearing rows: ${JSON.stringify(
      smokeBankReconciliationMatch,
    )}`,
  );
}
const smokeBankTransactionDetailAfterMatch = await getJson(
  `/admin/bank-reconciliation/${smokeBankTransaction.id}`,
  adminAuth.accessToken,
);
if (
  smokeBankTransactionDetailAfterMatch.status !== 'MATCHED' ||
  !smokeBankTransactionDetailAfterMatch.reconciliationMatches?.some(
    (match) =>
      match.id === smokeBankReconciliationMatch.match.id &&
      match.paymentClearingEntry?.id === completedPaymentClearingEntry.id &&
      match.amount === completedPaymentClearingEntry.amount &&
      match.currency === completedPaymentClearingCurrency,
  )
) {
  throw new Error(
    `Bank reconciliation detail does not expose the linked payment clearing match: ${JSON.stringify(
      smokeBankTransactionDetailAfterMatch,
    )}`,
  );
}
const smokeBankReconciliationReverse = await postJson(
  `/admin/bank-reconciliation/${smokeBankTransaction.id}/matches/${smokeBankReconciliationMatch.match.id}/reverse`,
  financeApproverAuth.accessToken,
  {
    reason: 'API smoke reversal after confirming reconciliation match.',
  },
);
if (
  smokeBankReconciliationReverse.match?.status !== 'REVERSED' ||
  smokeBankReconciliationReverse.match?.amount !== completedPaymentClearingEntry.amount ||
  smokeBankReconciliationReverse.match?.currency !== completedPaymentClearingCurrency ||
  smokeBankReconciliationReverse.bankTransaction?.status !== 'UNMATCHED' ||
  smokeBankReconciliationReverse.paymentClearingEntry?.status !== 'OPEN'
) {
  throw new Error(
    `Bank reconciliation reversal did not reopen the bank and payment clearing rows: ${JSON.stringify(
      smokeBankReconciliationReverse,
    )}`,
  );
}
const smokeBankBatchSeed = Date.now();
const smokeBankBatchAmount = 1_000_000_000 + (smokeBankBatchSeed % 1_000_000_000);
const smokeBankBatchTransferRef = `SMOKE-BANK-BATCH-${smokeBankBatchSeed}`;
const smokeBankBatchOccurredAt = new Date().toISOString();
const smokeBankBatchRows = [
  {
    amount: String(smokeBankBatchAmount),
    bankAccountId: smokeCompanyBankAccount.id,
    counterpartyName: `HANDS batch smoke ${smokeBankBatchSeed}`,
    description: 'Reviewed batch evidence for staged reconciliation smoke.',
    occurredAt: smokeBankBatchOccurredAt,
    rowNumber: 1,
    transferRef: smokeBankBatchTransferRef,
    type: 'INFLOW',
    valueDate: smokeBankBatchOccurredAt,
  },
];
const smokeBankBatchPreview = await postJson(
  '/admin/bank-reconciliation/transactions/batch-preview',
  adminAuth.accessToken,
  { rows: smokeBankBatchRows },
);
if (smokeBankBatchPreview.summary?.new !== 1 || smokeBankBatchPreview.rows?.[0]?.classification !== 'NEW') {
  throw new Error(
    `Bank statement batch preview did not classify unique evidence as new: ${JSON.stringify(
      smokeBankBatchPreview,
    )}`,
  );
}
const smokeBankBatchImport = await postJson(
  '/admin/bank-reconciliation/transactions/batch-import',
  adminAuth.accessToken,
  {
    mappingPreset: 'GENERIC',
    operatorReason: 'Reviewed unique batch bank evidence before importing.',
    rows: smokeBankBatchRows,
    sourceFileName: 'api-smoke-bank-statement.csv',
    sourceFileSha256: smokeBankBatchSeed.toString(16).padStart(64, '0'),
  },
);
const smokeBankBatchTransactionId = smokeBankBatchImport.results?.[0]?.transactionId;
if (
  smokeBankBatchImport.importedCount !== 1 ||
  smokeBankBatchImport.skippedCount !== 0 ||
  !smokeBankBatchTransactionId
) {
  throw new Error(`Bank statement batch import failed: ${JSON.stringify(smokeBankBatchImport)}`);
}
const smokeBankBatchDetail = await getJson(
  `/admin/bank-reconciliation/${smokeBankBatchTransactionId}`,
  adminAuth.accessToken,
);
if (
  smokeBankBatchDetail.status !== 'UNMATCHED' ||
  smokeBankBatchDetail.creationEvidence?.importedByAdminId !== adminAuth.user.id ||
  smokeBankBatchDetail.creationEvidence?.approvalAdminId
) {
  throw new Error(
    `Bank statement batch evidence did not retain maker-only import provenance: ${JSON.stringify(
      smokeBankBatchDetail,
    )}`,
  );
}
await postJson(
  `/admin/bank-reconciliation/${smokeBankBatchTransactionId}/review-assignment`,
  adminAuth.accessToken,
  {
    assigneeAdminId: adminAuth.user.id,
    reason: 'API smoke assigned batch bank evidence reconciliation review.',
  },
);
const smokeBankBatchIgnore = await postJson(
  `/admin/bank-reconciliation/${smokeBankBatchTransactionId}/ignore`,
  financeApproverAuth.accessToken,
  {
    reason: 'API smoke closes synthetic batch evidence after lifecycle verification.',
  },
);
if (
  smokeBankBatchIgnore.bankTransaction?.status !== 'IGNORED' ||
  smokeBankBatchIgnore.auditLog?.actorId !== financeApproverAuth.user.id ||
  smokeBankBatchIgnore.auditLog?.metadata?.reviewOwnerAdminId !== adminAuth.user.id
) {
  throw new Error(
    `Bank statement batch evidence did not close with separated review and approval: ${JSON.stringify(
      smokeBankBatchIgnore,
    )}`,
  );
}
const expectedBasePlatformFee = service.basePrice - basePayoutRule.providerPayoutAmount;
if (
  completedEarning.grossAmount !== service.basePrice ||
  completedEarning.platformFee !== expectedBasePlatformFee
) {
  throw new Error(
    `Completed earning did not use the service payout matrix amounts: ${JSON.stringify({
      completedEarning,
      serviceBasePrice: service.basePrice,
      basePayoutRule,
      expectedBasePlatformFee,
    })}`,
  );
}
if (
  !adminCompletedEarning?.platformFeeLogs?.length ||
  adminCompletedEarning.platformFeeLogs[0].platformFeeAmount !== completedEarning.platformFee
) {
  throw new Error(
    `Completed earning did not record platform fee policy log: ${JSON.stringify(adminCompletedEarning)}`,
  );
}
await expectRequestFailure(
  'Positive partner earnings must be paid through payout batches',
  () =>
    postJson(`/admin/earnings/${adminCompletedEarning.id}/mark-paid`, adminAuth.accessToken, {
      settlementRef: `DIRECT-PAYOUT-BLOCKED-${Date.now()}`,
      settlementMethod: 'PARTNER_DEPOSIT',
    }),
  400,
);
if (adminCompletedEarning.platformFeeLogs[0].ruleSnapshot?.source !== 'SERVICE_PAYOUT_RULE') {
  throw new Error(
    `Completed earning should prefer the service payout matrix: ${JSON.stringify(
      adminCompletedEarning.platformFeeLogs[0],
    )}`,
  );
}
const servicePayoutLog = adminCompletedEarning.platformFeeLogs[0];
const servicePayoutSnapshot = servicePayoutLog.ruleSnapshot ?? {};
const servicePayoutLines = Array.isArray(servicePayoutSnapshot.lines) ? servicePayoutSnapshot.lines : [];
const servicePayoutLine = servicePayoutLines.find(
  (line) => line.serviceId === service.id && line.customerPrice === service.basePrice,
);
const expectedBaseVatAmount = Math.round((expectedBasePlatformFee * basePayoutRule.vatBps) / 10_000);
const expectedBaseOtherCostAmount = basePayoutRule.otherCostAmount;
const expectedNetCompanyFeeBeforeWithholding =
  expectedBasePlatformFee - expectedBaseVatAmount - expectedBaseOtherCostAmount;
if (
  servicePayoutSnapshot.providerPayoutAmount !== basePayoutRule.providerPayoutAmount ||
  servicePayoutSnapshot.vatAmount !== expectedBaseVatAmount ||
  servicePayoutSnapshot.otherCostAmount !== expectedBaseOtherCostAmount ||
  servicePayoutSnapshot.netCompanyFeeBeforeWithholding !== expectedNetCompanyFeeBeforeWithholding
) {
  throw new Error(
    `Completed earning service payout snapshot does not match the admin pricing rule: ${JSON.stringify({
      servicePayoutLog,
      basePayoutRule,
      expectedBasePlatformFee,
      expectedBaseVatAmount,
      expectedBaseOtherCostAmount,
      expectedNetCompanyFeeBeforeWithholding,
    })}`,
  );
}
if (
  !servicePayoutLine ||
  servicePayoutLine.customerAmount !== service.basePrice ||
  servicePayoutLine.providerPayoutAmount !== basePayoutRule.providerPayoutAmount ||
  servicePayoutLine.platformFeeAmount !== expectedBasePlatformFee ||
  servicePayoutLine.vatAmount !== expectedBaseVatAmount ||
  servicePayoutLine.otherCostAmount !== expectedBaseOtherCostAmount ||
  servicePayoutLine.ruleId !== basePayoutRule.id
) {
  throw new Error(
    `Completed earning service payout line does not match the selected service option: ${JSON.stringify({
      servicePayoutLine,
      servicePayoutLines,
      service,
      basePayoutRule,
    })}`,
  );
}

const directCustomPriceBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  address: { line1: 'Custom price payout smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const directCustomPriceBookingDetail = await getJson(
  `/customer/bookings/${directCustomPriceBooking.id}`,
  customerAuth.accessToken,
);
assertBookingPricing('Completed custom-price direct booking', directCustomPriceBookingDetail, {
  customerPrice: higherCustomerPrice,
  paymentAmount: higherCustomerPrice,
});
const acceptedDirectCustomPrice = await postJson(
  `/provider/bookings/${directCustomPriceBooking.id}/accept`,
  providerAuth.accessToken,
);
if (acceptedDirectCustomPrice.status !== 'IN_SERVICE') {
  throw new Error(
    `Custom-price direct booking did not enter service with the selected partner: ${JSON.stringify(acceptedDirectCustomPrice)}`,
  );
}
await completeBooking(directCustomPriceBooking.id, providerAuth.accessToken);
const customPriceCloseout = await postJson(
  `/admin/bookings/${directCustomPriceBooking.id}/closeout`,
  adminAuth.accessToken,
  {
    note: 'Smoke test custom price payout closeout',
  },
);
if (customPriceCloseout.status !== 'COMPLETED' || customPriceCloseout.payment?.status !== 'CAPTURED') {
  throw new Error(`Custom-price booking closeout failed: ${JSON.stringify(customPriceCloseout)}`);
}
const adminCustomPriceEarning = (await getJson('/admin/earnings', adminAuth.accessToken)).find(
  (earning) => earning.bookingId === directCustomPriceBooking.id,
);
const expectedHigherPlatformFee = higherCustomerPrice - higherPricePayoutRule.providerPayoutAmount;
const expectedHigherVatAmount = Math.round(
  (expectedHigherPlatformFee * higherPricePayoutRule.vatBps) / 10_000,
);
const expectedHigherOtherCostAmount = higherPricePayoutRule.otherCostAmount;
const expectedHigherNetCompanyFeeBeforeWithholding =
  expectedHigherPlatformFee - expectedHigherVatAmount - expectedHigherOtherCostAmount;
const customPricePlatformFeeLog = adminCustomPriceEarning?.platformFeeLogs?.[0];
const customPricePayoutSnapshot = customPricePlatformFeeLog?.ruleSnapshot ?? {};
const customPricePayoutLines = Array.isArray(customPricePayoutSnapshot.lines)
  ? customPricePayoutSnapshot.lines
  : [];
const customPricePayoutLine = customPricePayoutLines.find(
  (line) => line.serviceId === service.id && line.customerPrice === higherCustomerPrice,
);
if (
  !adminCustomPriceEarning ||
  adminCustomPriceEarning.grossAmount !== higherCustomerPrice ||
  adminCustomPriceEarning.platformFee !== expectedHigherPlatformFee ||
  customPricePlatformFeeLog?.platformFeeAmount !== expectedHigherPlatformFee ||
  customPricePayoutSnapshot.source !== 'SERVICE_PAYOUT_RULE' ||
  customPricePayoutSnapshot.providerPayoutAmount !== higherPricePayoutRule.providerPayoutAmount ||
  customPricePayoutSnapshot.vatAmount !== expectedHigherVatAmount ||
  customPricePayoutSnapshot.otherCostAmount !== expectedHigherOtherCostAmount ||
  customPricePayoutSnapshot.netCompanyFeeBeforeWithholding !== expectedHigherNetCompanyFeeBeforeWithholding ||
  !customPricePayoutLine ||
  customPricePayoutLine.customerAmount !== higherCustomerPrice ||
  customPricePayoutLine.providerPayoutAmount !== higherPricePayoutRule.providerPayoutAmount ||
  customPricePayoutLine.platformFeeAmount !== expectedHigherPlatformFee ||
  customPricePayoutLine.vatAmount !== expectedHigherVatAmount ||
  customPricePayoutLine.otherCostAmount !== expectedHigherOtherCostAmount ||
  customPricePayoutLine.ruleId !== higherPricePayoutRule.id
) {
  throw new Error(
    `Custom-price completed earning did not use the matching service payout row: ${JSON.stringify({
      adminCustomPriceEarning,
      customPricePayoutLine,
      customPricePayoutLines,
      higherPricePayoutRule,
      expectedHigherPlatformFee,
      expectedHigherVatAmount,
      expectedHigherOtherCostAmount,
      expectedHigherNetCompanyFeeBeforeWithholding,
    })}`,
  );
}

if (providerEarningsSummary.walletBlocked === true || providerEarningsSummary.walletBalance <= 0) {
  throw new Error(
    `Online payment earning should keep provider wallet positive: ${JSON.stringify(providerEarningsSummary)}`,
  );
}
const existingPayoutHolds = await getJson('/admin/partner-sanctions', adminAuth.accessToken);
for (const sanction of existingPayoutHolds.filter(
  (item) =>
    item.providerProfileId === providerAuth.user.providerProfile.id &&
    item.type === 'PAYOUT_HOLD' &&
    item.status === 'ACTIVE',
)) {
  await postJson(`/admin/partner-sanctions/${sanction.id}/lift`, adminAuth.accessToken);
}
const payoutHoldSanction = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sanctions`,
  adminAuth.accessToken,
  {
    type: 'PAYOUT_HOLD',
    reason: 'Smoke payout hold before finance release',
  },
);
await expectRequestFailure(
  'Active payout hold blocks payout batch creation',
  () =>
    postJson('/admin/payout-batches', adminAuth.accessToken, {
      providerProfileId: providerAuth.user.providerProfile.id,
      transferRef: `SMOKE-HOLD-${Date.now()}`,
      notes: 'This should be blocked by active payout hold',
    }),
  400,
);
const liftedPayoutHoldSanction = await postJson(
  `/admin/partner-sanctions/${payoutHoldSanction.id}/lift`,
  adminAuth.accessToken,
);
if (liftedPayoutHoldSanction.status !== 'LIFTED') {
  throw new Error(`Payout hold sanction was not lifted: ${JSON.stringify(liftedPayoutHoldSanction)}`);
}
const payoutBatch = await postJson('/admin/payout-batches', adminAuth.accessToken, {
  providerProfileId: providerAuth.user.providerProfile.id,
  transferRef: `SMOKE-${Date.now()}`,
  notes: 'Created by smoke test',
});
if (payoutBatch.status !== 'DRAFT' || payoutBatch.paidAt) {
  throw new Error(`Payout batch should start as draft: ${JSON.stringify(payoutBatch)}`);
}
if (!payoutBatch.earnings?.length || payoutBatch.earnings.some((earning) => earning.status === 'PAID')) {
  throw new Error(`Draft payout batch should not mark earnings paid: ${JSON.stringify(payoutBatch)}`);
}
if (!payoutBatch.withholdingLogs?.length) {
  throw new Error(`Draft payout batch should include withholding logs: ${JSON.stringify(payoutBatch)}`);
}
const payoutBatchUpdate = await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  confirmationPayoutBatchId: payoutBatch.id,
  expectedStatus: payoutBatch.status,
  expectedTransferRef: payoutBatch.transferRef,
  expectedNotes: payoutBatch.notes,
  reason: 'API smoke updates reviewed payout transfer evidence.',
  transferRef: `${payoutBatch.transferRef}-UPDATED`,
  notes: 'Updated by smoke test',
});
if (payoutBatchUpdate.transferRef !== `${payoutBatch.transferRef}-UPDATED`) {
  throw new Error(`Payout batch transfer reference was not updated: ${JSON.stringify(payoutBatchUpdate)}`);
}
await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  confirmationPayoutBatchId: payoutBatch.id,
  expectedStatus: payoutBatchUpdate.status,
  expectedTransferRef: payoutBatchUpdate.transferRef,
  expectedNotes: payoutBatchUpdate.notes,
  reason: 'API smoke verifies missing payout transfer reference guard.',
  transferRef: null,
  notes: 'Missing transfer reference guard',
});
await expectRequestFailure(
  'Payout processing requires transfer reference',
  () =>
    patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
      status: 'PROCESSING',
    }),
  400,
);
await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  confirmationPayoutBatchId: payoutBatch.id,
  expectedStatus: 'DRAFT',
  expectedTransferRef: null,
  expectedNotes: 'Missing transfer reference guard',
  reason: 'API smoke restores reviewed payout transfer evidence.',
  transferRef: payoutBatchUpdate.transferRef,
  notes: 'Updated by smoke test',
});
const payoutBatchProcessing = await patchJson(
  `/admin/payout-batches/${payoutBatch.id}`,
  adminAuth.accessToken,
  {
    status: 'PROCESSING',
  },
);
if (payoutBatchProcessing.status !== 'PROCESSING' || payoutBatchProcessing.paidAt) {
  throw new Error(
    `Payout batch should move to processing without paidAt: ${JSON.stringify(payoutBatchProcessing)}`,
  );
}
let payoutBatchDualApprovalGuardsReady = false;
const payoutBatchSameAdminFailure = await expectRequestFailure(
  'Payout batch paid closeout rejects same-admin approval',
  () =>
    patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
      status: 'PAID',
    }),
  400,
);
if (
  !payoutBatchSameAdminFailure.includes('Payout batch paid closeout requires approval from a different admin')
) {
  throw new Error(
    `Payout batch same-admin guard returned unexpected message: ${payoutBatchSameAdminFailure}`,
  );
}
const payoutBatchNonFinanceFailure = await expectRequestFailure(
  'Payout batch paid closeout rejects non-finance approver',
  () =>
    patchJson(`/admin/payout-batches/${payoutBatch.id}`, nonFinanceAdminAuth.accessToken, {
      status: 'PAID',
    }),
  400,
);
if (
  !payoutBatchNonFinanceFailure.includes(
    'Payout batch paid closeout requires approval from a finance approver',
  )
) {
  throw new Error(
    `Payout batch non-finance guard returned unexpected message: ${payoutBatchNonFinanceFailure}`,
  );
}
payoutBatchDualApprovalGuardsReady = true;
const payoutBatchPaid = await patchJson(
  `/admin/payout-batches/${payoutBatch.id}`,
  financeApproverAuth.accessToken,
  {
    status: 'PAID',
  },
);
if (
  payoutBatchPaid.status !== 'PAID' ||
  !payoutBatchPaid.paidAt ||
  payoutBatchPaid.earnings?.some((earning) => earning.status !== 'PAID') ||
  payoutBatchPaid.withholdingLogs?.some((log) => log.status !== 'PAID')
) {
  throw new Error(`Payout batch should mark linked earnings paid: ${JSON.stringify(payoutBatchPaid)}`);
}
const adminEarningsAfterPayoutPaid = await getJson('/admin/earnings', adminAuth.accessToken);
const paidPayoutEarning = adminEarningsAfterPayoutPaid.find(
  (earning) => earning.payoutBatchId === payoutBatch.id && earning.netAmount > 0,
);
const payoutPaidLedger = paidPayoutEarning?.walletLedgerEntries?.find(
  (entry) => entry.type === 'PAYOUT_PAID' && entry.metadata?.payoutBatchId === payoutBatch.id,
);
if (!paidPayoutEarning || !payoutPaidLedger || payoutPaidLedger.amount !== -paidPayoutEarning.netAmount) {
  throw new Error(`Payout paid wallet ledger was not recorded: ${JSON.stringify(paidPayoutEarning)}`);
}
const adminPayoutBatches = await getJson('/admin/payout-batches', adminAuth.accessToken);
const adminBookings = await getJson('/admin/bookings', adminAuth.accessToken);
const adminBooking = adminBookings.find((item) => item.id === booking.id);
if (!adminBooking?.chatRoom?.id || !adminBooking?.services?.length || !adminBooking?.participants?.length) {
  throw new Error(`Admin booking monitor payload is incomplete: ${JSON.stringify(adminBooking)}`);
}
const adminBookingDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (
  adminBookingDetail?.id !== booking.id ||
  !adminBookingDetail?.payment?.id ||
  !adminBookingDetail?.chatRoom?.messages?.some((message) => message.id === chatMessage.id) ||
  !adminBookingDetail?.review?.id ||
  !adminBookingDetail?.earning?.id
) {
  throw new Error(`Admin booking detail payload is incomplete: ${JSON.stringify(adminBookingDetail)}`);
}
const adminHybridBooking = adminBookings.find((item) => item.id === hybridBooking.id);
if (!adminHybridBooking?.preferredProvider?.id || !adminHybridBooking?.selectedProvider?.id) {
  throw new Error(
    `Hybrid booking is missing preferred/final provider state: ${JSON.stringify(adminHybridBooking)}`,
  );
}
if (adminHybridBooking.preferredProvider.id === adminHybridBooking.selectedProvider.id) {
  throw new Error(
    `Hybrid booking did not switch from preferred to marketplace participant: ${JSON.stringify(adminHybridBooking)}`,
  );
}
const adminHybridMarketplaceParticipant = adminHybridBooking.participants?.find(
  (participant) => participant.providerProfileId === adminHybridBooking.selectedProvider.id,
);
if (
  !adminHybridMarketplaceParticipant ||
  !['ACCEPTED', 'SELECTED'].includes(adminHybridMarketplaceParticipant.status) ||
  !adminHybridMarketplaceParticipant.joinedAt ||
  adminHybridMarketplaceParticipant.providerProfile?.id !== adminHybridBooking.selectedProvider.id
) {
  throw new Error(
    `Admin booking monitor did not retain the selected marketplace participant record: ${JSON.stringify(
      adminHybridBooking,
    )}`,
  );
}
const adminHybridBookingDetail = await getJson(`/admin/bookings/${hybridBooking.id}`, adminAuth.accessToken);
const adminHybridDetailMarketplaceParticipant = adminHybridBookingDetail.participants?.find(
  (participant) => participant.providerProfileId === adminHybridBookingDetail.selectedProvider?.id,
);
if (
  !adminHybridDetailMarketplaceParticipant ||
  !['ACCEPTED', 'SELECTED'].includes(adminHybridDetailMarketplaceParticipant.status) ||
  !adminHybridDetailMarketplaceParticipant.providerProfile?.user?.phone
) {
  throw new Error(
    `Admin booking detail did not expose marketplace participant identity and status: ${JSON.stringify(
      adminHybridBookingDetail,
    )}`,
  );
}
const adminCancelledBooking = adminBookings.find((item) => item.id === cancellableMomoBooking.id);
if (adminCancelledBooking?.status !== 'CANCELLED' || adminCancelledBooking?.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin booking monitor did not expose cancellation release state: ${JSON.stringify(adminCancelledBooking)}`,
  );
}
if (
  adminCancelledBooking?.closedByRole !== 'CUSTOMER' ||
  adminCancelledBooking?.closedReason !== 'customer_cancelled'
) {
  throw new Error(
    `Admin booking monitor did not expose customer cancellation metadata: ${JSON.stringify(adminCancelledBooking)}`,
  );
}
const adminNoShowBooking = adminBookings.find((item) => item.id === noShowBooking.id);
if (adminNoShowBooking?.status !== 'NO_SHOW') {
  throw new Error(
    `Admin booking monitor did not expose no-show state: ${JSON.stringify(adminNoShowBooking)}`,
  );
}
if (adminNoShowBooking?.closedByRole !== 'ADMIN' || adminNoShowBooking?.closedReason !== 'admin_no_show') {
  throw new Error(
    `Admin booking monitor did not expose no-show closure metadata: ${JSON.stringify(adminNoShowBooking)}`,
  );
}
const adminExpiredBooking = adminBookings.find((item) => item.id === manuallyExpiredBooking.id);
if (adminExpiredBooking?.status !== 'EXPIRED' || adminExpiredBooking?.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin booking monitor did not expose manual expiry release state: ${JSON.stringify(adminExpiredBooking)}`,
  );
}
if (adminExpiredBooking?.closedByRole !== 'ADMIN' || adminExpiredBooking?.closedReason !== 'admin_expired') {
  throw new Error(
    `Admin booking monitor did not expose expiry closure metadata: ${JSON.stringify(adminExpiredBooking)}`,
  );
}
const adminAppSessions = await getJson('/admin/app-sessions', adminAuth.accessToken);
if (
  !adminAppSessions.some((session) => session.id === customerAppSession.id) ||
  !adminAppSessions.some((session) => session.id === providerAppSession.id)
) {
  throw new Error(
    `Admin app session payload is missing expected heartbeats: ${JSON.stringify({
      customerAppSession,
      providerAppSession,
      adminAppSessions: adminAppSessions.slice(0, 5),
    })}`,
  );
}
const adminPartners = await getJson('/admin/partners?view=list', adminAuth.accessToken);
const legacyAdminProviders = await getJson('/admin/providers?view=list', adminAuth.accessToken);
if (legacyAdminProviders.length !== adminPartners.length) {
  throw new Error(
    `Legacy admin provider alias count does not match partner count: ${JSON.stringify({
      providerCount: legacyAdminProviders.length,
      partnerCount: adminPartners.length,
    })}`,
  );
}
const adminPartner = await getJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
const legacyAdminProvider = await getJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
if (!adminPartner) {
  throw new Error(
    `Admin partner payload is missing the smoke partner: ${JSON.stringify({
      providerProfileId: providerAuth.user.providerProfile.id,
      listedPartnerIds: adminPartners.slice(0, 5).map((item) => item.id),
    })}`,
  );
}
if (legacyAdminProvider?.id !== adminPartner.id) {
  throw new Error(
    `Legacy admin provider alias does not return the smoke partner: ${JSON.stringify({
      legacyAdminProvider,
      adminPartner,
    })}`,
  );
}
if (!hasFreshRegisteredPushDevice(adminPartner?.user?.pushDevices, pushRegistrationStartedAt)) {
  throw new Error(`Admin partner payload is missing registered push device: ${JSON.stringify(adminPartner)}`);
}
if (
  adminPartner?.kyc?.status !== 'APPROVED' ||
  !adminPartner?.bankAccounts?.some((account) => account.status === 'APPROVED') ||
  adminPartner?.taxProfile?.status !== 'APPROVED'
) {
  throw new Error(
    `Admin partner payload is missing onboarding review state: ${JSON.stringify(adminPartner)}`,
  );
}
if (
  !adminPartner?.user?.fileAssets?.some(
    (file) => file.id === publicProfileImageUpload.file.id && file.reviewStatus === 'APPROVED',
  )
) {
  throw new Error(`Admin partner payload is missing approved public media: ${JSON.stringify(adminPartner)}`);
}
const partnerOpsNote = `Automated partner handoff note ${Date.now()}`;
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/ops-note`, adminAuth.accessToken, {
  note: partnerOpsNote,
  preset: 'Partner app session and push reachability checked.',
});
const adminPartnerDetail = await getJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}`,
  adminAuth.accessToken,
);
if (
  !adminPartnerDetail?.auditLogs?.some(
    (log) => log.action === 'provider.ops_note.add' && log.metadata?.note === partnerOpsNote,
  )
) {
  throw new Error(
    `Admin partner detail is missing partner operation note audit log: ${JSON.stringify({
      partnerOpsNote,
      auditLogs: adminPartnerDetail?.auditLogs?.slice(0, 5),
    })}`,
  );
}
const shiftHandoffNote = `Automated shift handoff note ${Date.now()}`;
await postJson('/admin/operations-handoff/note', adminAuth.accessToken, {
  owner: 'Dispatch',
  note: shiftHandoffNote,
  preset: 'Next operator should review live matching, chat, and cash settlement lanes first.',
});
const auditLogsAfterHandoff = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !auditLogsAfterHandoff?.some(
    (log) => log.action === 'operations.handoff_note.add' && log.metadata?.note === shiftHandoffNote,
  )
) {
  throw new Error(
    `Admin audit log is missing operations handoff note: ${JSON.stringify({
      shiftHandoffNote,
      auditLogs: auditLogsAfterHandoff?.slice(0, 5),
    })}`,
  );
}
const adminBackupPartner = await getJson(
  `/admin/partners/${backupProviderAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
if (!hasFreshRegisteredPushDevice(adminBackupPartner?.user?.pushDevices, pushRegistrationStartedAt)) {
  throw new Error(
    `Admin marketplace partner payload is missing registered push device: ${JSON.stringify(adminBackupPartner)}`,
  );
}
const payment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === booking.id),
);
const momoPayment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === momoBooking.id),
);
const syncedMomo = momoPayment
  ? await postJson(`/admin/payments/${momoPayment.id}/sync`, adminAuth.accessToken)
  : null;
const releasedMomo = momoPayment
  ? await postJson(`/admin/payments/${momoPayment.id}/release`, adminAuth.accessToken)
  : null;
const capturedCash = couponPayment
  ? await postJson(`/admin/payments/${couponPayment.id}/capture`, adminAuth.accessToken)
  : null;
const refundRequest = payment
  ? await postJson(`/admin/payments/${payment.id}/refund-request`, adminAuth.accessToken, {
      reason: 'API smoke completed booking refund',
    })
  : null;
const refund = payment
  ? await postJson(`/admin/payments/${payment.id}/refund`, financeApproverAuth.accessToken, {})
  : null;
const adminRefunds = await getJson('/admin/refunds', adminAuth.accessToken);
let refundAfterPayoutReceivableReady = false;
if (refund) {
  const refundReversalJournalSummary = (
    await getJson('/admin/accounting-journal-batches?range=all&review=posted&take=100', adminAuth.accessToken)
  ).find(
    (journal) =>
      journal.bookingId === booking.id &&
      journal.sourceType === 'BOOKING_SETTLEMENT_REVERSAL' &&
      journal.status === 'POSTED',
  );
  const refundPaymentClearingEntry = (
    await getJson('/admin/booking-payment-clearing?range=all&review=reversed&take=100', adminAuth.accessToken)
  ).find(
    (entry) =>
      entry.bookingId === booking.id && entry.type === 'REFUND_REVERSAL' && entry.status === 'REVERSED',
  );
  if (
    !refundReversalJournalSummary ||
    refundReversalJournalSummary.totalDebit !== refundReversalJournalSummary.totalCredit ||
    !refundPaymentClearingEntry ||
    refundPaymentClearingEntry.amount !== -completedCloseout.payment.amount
  ) {
    throw new Error(
      `Refund did not expose settlement reversal journal and clearing evidence: ${JSON.stringify({
        refundPaymentClearingEntry,
        refundReversalJournalSummary,
        payment,
        refund,
      })}`,
    );
  }
  const refundReversalJournal = await getJson(
    `/admin/accounting-journal-batches/${refundReversalJournalSummary.id}`,
    adminAuth.accessToken,
  );
  assertBalancedAccountingJournal('Refund settlement reversal journal', refundReversalJournal);
  assertJournalEntry('Refund settlement reversal journal', refundReversalJournal, {
    accountCode: 'partner_receivable_negative_wallet',
    amount: completedEarning.netAmount,
    side: 'DEBIT',
  });
  assertJournalEntry('Refund settlement reversal journal', refundReversalJournal, {
    accountCode: 'booking_payment_clearing',
    amount: completedCloseout.payment.amount,
    side: 'CREDIT',
  });

  const adminEarningsAfterRefund = await getJson('/admin/earnings?take=50', adminAuth.accessToken);
  const refundedPaidEarning = adminEarningsAfterRefund.find((earning) => earning.id === completedEarning.id);
  const refundAfterPayoutReceivableLedger = refundedPaidEarning?.walletLedgerEntries?.find(
    (entry) => entry.sourceKey === `earning:${completedEarning.id}:paid-refund-receivable`,
  );
  const metadata = refundAfterPayoutReceivableLedger?.metadata;
  if (
    !refundedPaidEarning ||
    !refundAfterPayoutReceivableLedger ||
    refundAfterPayoutReceivableLedger.type !== 'REFUND_REVERSAL' ||
    refundAfterPayoutReceivableLedger.amount !== -completedEarning.netAmount ||
    refundAfterPayoutReceivableLedger.reference !== payoutBatchUpdate.transferRef ||
    metadata?.refundAfterPayout !== true ||
    metadata?.partnerReceivableAmount !== completedEarning.netAmount ||
    metadata?.payoutBatchId !== payoutBatch.id ||
    metadata?.payoutBatchStatus !== 'PAID' ||
    metadata?.payoutTransferRef !== payoutBatchUpdate.transferRef
  ) {
    throw new Error(
      `Refund after paid payout did not create partner receivable ledger evidence: ${JSON.stringify({
        completedEarning,
        payoutBatchId: payoutBatch.id,
        refundAfterPayoutReceivableLedger,
        refundedPaidEarning,
      })}`,
    );
  }
  refundAfterPayoutReceivableReady = true;
}
if (!refundAfterPayoutReceivableReady) {
  throw new Error(
    `Refund after paid payout receivable smoke did not run: ${JSON.stringify({ payment, refund })}`,
  );
}
const notifications = await getJson('/notifications', customerAuth.accessToken);
const notificationToRetry = notifications[0];
let retryBeforeDeliveryCount = 0;
let retryAccepted = false;
let retryAuditObserved = false;
if (notificationToRetry) {
  await patchJson('/notifications/device-token/register', customerAuth.accessToken, {
    token: 'demo-customer-device-token',
    platform: 'android',
  });
  const adminNotificationsBeforeRetry = await getJson('/admin/notifications', adminAuth.accessToken);
  const adminNotificationBeforeRetry = adminNotificationsBeforeRetry.find(
    (item) => item.id === notificationToRetry.id,
  );
  retryBeforeDeliveryCount = adminNotificationBeforeRetry?.deliveries?.length ?? 0;
  const retryResult = await postJson(
    `/admin/notifications/${notificationToRetry.id}/retry`,
    adminAuth.accessToken,
  );
  retryAccepted = Boolean(retryResult?.ok);
  const retryAuditLogs = await getJson('/admin/audit-logs', adminAuth.accessToken);
  retryAuditObserved = retryAuditLogs?.some(
    (log) =>
      log.action === 'notification.retry' &&
      log.target === `notification:${notificationToRetry.id}` &&
      log.metadata?.notificationId === notificationToRetry.id,
  );
  if (!retryAuditObserved) {
    throw new Error(
      `Admin notification retry should leave an audit trail: ${JSON.stringify({
        notificationId: notificationToRetry.id,
        auditLogs: retryAuditLogs?.slice(0, 5),
      })}`,
    );
  }
}
let retriedNotification = null;
for (let attempt = 0; attempt < 20 && notificationToRetry; attempt++) {
  await sleep(500);
  const adminNotifications = await getJson('/admin/notifications', adminAuth.accessToken);
  retriedNotification = adminNotifications.find((item) => item.id === notificationToRetry.id);
  if ((retriedNotification?.deliveries?.length ?? 0) > retryBeforeDeliveryCount) {
    break;
  }
}

function hasFreshRegisteredPushDevice(devices, registeredAfterMs) {
  return Boolean(
    devices?.some((device) => {
      const lastSeenMs = Date.parse(device.lastSeenAt ?? device.updatedAt ?? device.createdAt ?? '');
      return (
        String(device.platform ?? '').toLowerCase() === 'android' &&
        Number.isFinite(lastSeenMs) &&
        lastSeenMs >= registeredAfterMs
      );
    }),
  );
}

const financeDualApprovalRoleSeparationReady =
  manualWalletDualApprovalGuardsReady &&
  payoutBatchDualApprovalGuardsReady &&
  providerWalletWithdrawalDualApprovalGuardsReady &&
  withholdingRemittancePaidLifecycleReady;
if (!financeDualApprovalRoleSeparationReady) {
  throw new Error(
    `Finance dual approval role separation smoke did not complete: ${JSON.stringify({
      manualWalletDualApprovalGuardsReady,
      payoutBatchDualApprovalGuardsReady,
      providerWalletWithdrawalDualApprovalGuardsReady,
      withholdingRemittancePaidLifecycleReady,
    })}`,
  );
}

const residualSmokeFixtureCleanup = await cleanupApiSmokeFixtures({
  customerProfileId: customerAuth.user.customerProfile.id,
});
const residualSmokeBookingCleanup = residualSmokeFixtureCleanup.bookings;
const smokeCompanyBankAccountCleanup = residualSmokeFixtureCleanup.companyBankAccounts;
const smokeServiceCleanup = residualSmokeFixtureCleanup.services;
const publicServiceGroupsAfter = await request('/services/groups');
const publicCatalogAfter = {
  groupCount: publicServiceGroupsAfter.length,
  optionCount: publicServiceGroupsAfter.reduce(
    (total, group) => total + (group.options?.length ?? 0),
    0,
  ),
};
if (
  publicCatalogAfter.groupCount !== publicCatalogBefore.groupCount ||
  publicCatalogAfter.optionCount !== publicCatalogBefore.optionCount
) {
  throw new Error(
    `API smoke changed the public service catalog: ${JSON.stringify({ publicCatalogBefore, publicCatalogAfter })}`,
  );
}

console.log({
  ok: true,
  bookingId: booking.id,
  hybridBookingId: hybridBooking.id,
  directCustomPriceBookingId: directCustomPriceBooking.id,
  directCustomPriceGrossAmount: adminCustomPriceEarning.grossAmount,
  directCustomPricePlatformFee: adminCustomPriceEarning.platformFee,
  directCustomPricePayoutRuleMatched: true,
  chatRoomId,
  hybridChatRoomId: hybridMatched.booking.chatRoom.id,
  customerBookingCount: customerBookings.length,
  providerBookingCount: providerBookings.length,
  chatMessageId: chatMessage.id,
  reviewId: review.id,
  earningCount: providerEarnings.length,
  providerNetAmount: providerEarningsSummary.netAmount,
  payoutBatchId: payoutBatch.id,
  payoutBatchCount: adminPayoutBatches.length,
  providerWalletWithdrawalRequestId: providerWalletWithdrawalRequest.id,
  providerWalletWithdrawalLedgerId: providerWalletWithdrawalLedger.id,
  providerWalletWithdrawalPaidLifecycleReady,
  companyBankAccountStagedApprovalReady:
    companyBankAccountArchived.status === 'INACTIVE' && !companyBankAccountArchived.metadata?.pendingApproval,
  companyBankAccountCentralApprovalQueueReady:
    companyBankAccountMakerQueueRequest?.reviewState === 'BLOCKED' &&
    companyBankAccountApproverQueueRequest?.reviewState === 'READY',
  companyBankAccountCommandSummariesReady:
    companyBankAccountFinanceOverview.companyBankAccountApprovalSummary?.pendingCount >= 1 &&
    companyBankAccountStartShift.financeReviewWorkload?.companyBankAccounts?.pendingCount >= 1,
  bankReconciliationTransactionId: smokeBankTransaction.id,
  bankReconciliationMatchId: smokeBankReconciliationMatch.match.id,
  bankReconciliationMatchAmount: smokeBankReconciliationMatch.match.amount,
  bankReconciliationMatchCurrency: smokeBankReconciliationMatch.match.currency,
  bankReconciliationMatchedStatus: smokeBankReconciliationMatch.bankTransaction.status,
  bankReconciliationReversedStatus: smokeBankReconciliationReverse.bankTransaction.status,
  bankReconciliationPaymentClearingReopened:
    smokeBankReconciliationReverse.paymentClearingEntry.status === 'OPEN',
  bankStatementBatchImportId: smokeBankBatchImport.batchImportId,
  bankStatementBatchIgnoreReady: smokeBankBatchIgnore.bankTransaction.status === 'IGNORED',
  monthlyCloseOpenJournalDeltaBlocked,
  withholdingRemittancePaidLifecycleReady,
  financeDualApprovalRoleSeparationReady,
  adminBookingMonitorReady: true,
  adminBookingDetailReady: true,
  customerAppSessionId: customerAppSession.id,
  providerAppSessionId: providerAppSession.id,
  adminCustomerAppSessionReady: true,
  adminAppSessionCount: adminAppSessions.length,
  adminPartnerPushDeviceCount: adminPartner?.user?.pushDevices?.length ?? 0,
  adminBackupPartnerPushDeviceCount: adminBackupPartner?.user?.pushDevices?.length ?? 0,
  partnerAliasMeReady:
    partnerAliasInitialMe.providerProfile?.id === backupProviderAuth.user.providerProfile.id,
  partnerAliasServiceGroupCount: partnerAliasInitialServices.length,
  partnerAliasOpenBookingReady: true,
  providerDeviceSessionId: providerDeviceSession.session?.id ?? null,
  providerDeviceBlockRoundTrip:
    blockedProviderDeviceSession.blocked === true && unblockedProviderDeviceSession.blocked === false,
  partnerControlReportId: partnerControlReport.id,
  partnerControlReportStatus: resolvedPartnerControlReport.status,
  partnerControlSanctionId: partnerControlSanction.id,
  duplicateReviewGuardReady: duplicateReviewError.includes('Review already exists for this booking'),
  publicReviewVisibilityRoundTripReady:
    publicReviewCountAfterCreate >= 1 &&
    (publicProviderDetailAfterHold?.reviewCount ?? 0) < publicReviewCountAfterCreate &&
    (publicProviderDetailAfterRepublish?.reviewCount ?? 0) >= publicReviewCountAfterCreate,
  partnerControlSanctionLifted: liftedPartnerControlSanction.status === 'LIFTED',
  providerPayoutHoldBlocked: Boolean(payoutHoldSanction.id) && liftedPayoutHoldSanction.status === 'LIFTED',
  providerSupabaseRoleSyncStatus: providerSupabaseRoleSync.status,
  hybridPreferredProviderId: adminHybridBooking?.preferredProvider?.id ?? null,
  hybridSelectedProviderId: adminHybridBooking?.selectedProvider?.id ?? null,
  hybridSwitchedToBackup:
    adminHybridBooking?.preferredProvider?.id !== adminHybridBooking?.selectedProvider?.id,
  backupAcceptNotificationObserved,
  backupDeclineNotificationObserved,
  preferredAcceptPolicyBookingId: preferredAcceptPolicyBooking?.id ?? null,
  preferredAcceptPolicyMatched: preferredAcceptPolicyMatched?.status === 'IN_SERVICE',
  firstPickMatchAuditSourceObserved,
  savedSelectedLocationId: savedSelectedLocation.id,
  nearbyProviderDistanceMeters: nearbyProvider.distanceMeters,
  nearbyProviderRecent: nearbyProvider.isRecentLocation,
  globalBrowsePartnerDistanceMeters: globalBrowseProvider.distanceMeters,
  globalBrowseKeepsPartnerDiscoveryOpen: true,
  providerProfileImageReady: Boolean(customerProviderDetail.profileImageUrl),
  providerGalleryImageCount: customerProviderDetail.galleryImageUrls.length,
  providerPublicMediaApproved: true,
  momoPaymentStatus: momoPayment?.status ?? null,
  couponId: coupon.id,
  couponCode: coupon.code,
  couponDiscountAmount: couponPreview.discountAmount,
  couponBookingPaymentAmount: couponPayment?.amount ?? null,
  cancelledBookingId: cancellableMomoBooking.id,
  cancelledBookingStatus: cancelledMomoBooking.status,
  cancelledPaymentStatus: cancelledMomoBooking.payment?.status ?? null,
  cancelledPaymentSyncSkipped: cancelledPaymentSync?.skipped ?? false,
  noShowCustomerNotified: true,
  noShowPartnerNotified: true,
  syncedMomoStatus: syncedMomo?.status ?? null,
  releasedMomoStatus: releasedMomo?.status ?? null,
  capturedCashStatus: capturedCash?.status ?? null,
  refundId: refund?.refunds?.at(-1)?.id ?? null,
  refundCount: adminRefunds.length,
  refundAfterPayoutReceivableReady,
  residualSmokeBookingCleanup,
  smokeCompanyBankAccountCleanup,
  smokeServiceCleanup,
  publicServiceCatalogInvariant: { before: publicCatalogBefore, after: publicCatalogAfter },
  verificationFileId: verificationUpload.file.id,
  verificationUploadStatus: completedVerificationUpload.uploadStatus,
  verificationReadStorageMode: verificationReadUrl.storageMode,
  providerOnboardingLevel: providerOnboarding.level,
  taxPolicyVersionCount: taxPolicyVersions.length,
  customerNotifications: notifications.length,
  retryAccepted,
  retryBeforeDeliveryCount,
  retryAuditObserved,
  retriedNotificationDeliveryCount: retriedNotification?.deliveries?.length ?? 0,
  retryDeliveryObserved: (retriedNotification?.deliveries?.length ?? 0) > retryBeforeDeliveryCount,
  readiness,
  externalReadinessOk: externalReadiness.ok,
  externalCurrentStageOk: externalReadiness.currentStageOk,
  externalBlockingCategories: externalReadiness.blockingCategories ?? [],
  externalDeferredCategories: externalReadiness.deferredCategories ?? [],
  externalReadinessCategories: [...externalCategories].sort(),
});
