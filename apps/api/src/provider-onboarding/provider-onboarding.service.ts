import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  FileUploadStatus,
  FileVisibility,
  Prisma,
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderLevel,
  ProviderTaxProfileStatus,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const REQUIRED_PAYOUT_AGREEMENTS = [
  ProviderAgreementType.TERMS,
  ProviderAgreementType.PRIVACY,
  ProviderAgreementType.LOCATION,
  ProviderAgreementType.PAYOUT,
  ProviderAgreementType.TAX,
];

@Injectable()
export class ProviderOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(userId?: string) {
    const provider = await this.requireProvider(userId);
    const [completedBookingCount, activeTaxPolicy] = await Promise.all([
      this.prisma.booking.count({
        where: {
          selectedProviderId: provider.id,
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.taxPolicyVersion.findFirst({
        where: { status: TaxPolicyStatus.ACTIVE, effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: 'desc' },
        include: { rules: { where: { active: true }, orderBy: { createdAt: 'asc' } } },
      }),
    ]);

    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));
    const approvedBankAccount = provider.bankAccounts.some(
      (account) => account.status === ProviderBankAccountStatus.APPROVED,
    );
    const kycApproved = provider.kyc?.status === ProviderKycStatus.APPROVED;
    const legacyVerificationApproved = provider.verification?.status === VerificationStatus.APPROVED;
    const taxProfileApproved = provider.taxProfile?.status === ProviderTaxProfileStatus.APPROVED;
    const hasAddress = Boolean(provider.residentialAddress?.trim());
    const canWithdraw =
      completedBookingCount > 0 && taxProfileApproved && hasAddress && missingAgreements.length === 0;

    return {
      providerProfileId: provider.id,
      level: provider.level,
      recommendedLevel: this.recommendedLevel({
        kycApproved,
        legacyVerificationApproved,
        approvedBankAccount,
        canWithdraw,
        trustedAt: provider.trustedAt,
      }),
      basicProfile: {
        displayName: provider.displayName,
        legalName: provider.legalName,
        dateOfBirth: provider.dateOfBirth,
        gender: provider.gender,
        facebookId: provider.facebookId,
        activityNickname: provider.activityNickname,
        bio: provider.bio,
        residentialAddress: provider.residentialAddress,
        city: provider.city,
        serviceArea: provider.serviceArea,
      },
      verification: provider.verification,
      kyc: provider.kyc,
      documents: provider.documents,
      bankAccounts: provider.bankAccounts,
      taxProfile: provider.taxProfile,
      agreements: provider.agreements,
      completedBookingCount,
      payoutGate: {
        canWithdraw,
        missing: {
          firstCompletedService: completedBookingCount === 0,
          taxProfileApproved: !taxProfileApproved,
          residentialAddress: !hasAddress,
          agreements: missingAgreements,
        },
      },
      activeTaxPolicy,
      nextRequiredActions: this.nextRequiredActions({
        provider,
        kycApproved,
        legacyVerificationApproved,
        approvedBankAccount,
        completedBookingCount,
        taxProfileApproved,
        hasAddress,
        missingAgreements,
      }),
    };
  }

  async updateBasicProfile(
    userId: string | undefined,
    input: {
      legalName?: string;
      dateOfBirth?: string;
      gender?: string;
      facebookId?: string;
      displayName?: string;
      activityNickname?: string;
      bio?: string;
      residentialAddress?: string;
      city?: string;
      serviceArea?: unknown;
    },
  ) {
    const provider = await this.requireProvider(userId);
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        legalName: normalizeString(input.legalName),
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        gender: normalizeString(input.gender),
        facebookId: normalizeString(input.facebookId),
        displayName: normalizeString(input.displayName),
        activityNickname: normalizeString(input.activityNickname),
        bio: normalizeString(input.bio),
        residentialAddress: normalizeString(input.residentialAddress),
        city: normalizeString(input.city),
        serviceArea: input.serviceArea === undefined ? undefined : toJson(input.serviceArea),
      },
    });
    return { ok: true, provider: updated };
  }

  async submitKyc(
    userId: string | undefined,
    input: {
      cccdNumber?: string;
      documents?: Array<{ fileId: string; type: string }>;
    },
  ) {
    const provider = await this.requireProvider(userId);
    const now = new Date();
    const normalizedCccd = normalizeIdNumber(input.cccdNumber);
    const kyc = await this.prisma.providerKyc.upsert({
      where: { providerProfileId: provider.id },
      update: {
        cccdNumberHash: normalizedCccd ? sha256(normalizedCccd) : undefined,
        cccdNumberLast4: normalizedCccd?.slice(-4),
        status: ProviderKycStatus.PENDING,
        submittedAt: now,
        rejectionReason: null,
      },
      create: {
        providerProfileId: provider.id,
        cccdNumberHash: normalizedCccd ? sha256(normalizedCccd) : undefined,
        cccdNumberLast4: normalizedCccd?.slice(-4),
        status: ProviderKycStatus.PENDING,
        submittedAt: now,
      },
    });

    for (const document of input.documents ?? []) {
      const type = parseEnum(ProviderDocumentType, document.type, 'Invalid provider document type');
      await this.attachProviderDocument(provider.id, document.fileId, type);
    }

    await this.prisma.providerVerification.upsert({
      where: { providerProfileId: provider.id },
      update: {
        status: VerificationStatus.SUBMITTED,
        submittedAt: now,
        rejectionReason: null,
      },
      create: {
        providerProfileId: provider.id,
        status: VerificationStatus.SUBMITTED,
        submittedAt: now,
      },
    });

    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: provider.id,
        action: 'kyc.submit',
        toStatus: ProviderKycStatus.PENDING,
        metadata: toJson({ documentCount: input.documents?.length ?? 0 }),
      },
    });

    return { ok: true, kyc };
  }

  async createBankAccount(
    userId: string | undefined,
    input: {
      bankName: string;
      accountNumber?: string;
      accountHolderName: string;
      qrBankingInfo?: unknown;
      status?: ProviderBankAccountStatus;
    },
  ) {
    const provider = await this.requireProvider(userId);
    const accountNumber = normalizeIdNumber(input.accountNumber);
    const bankName = requiredString(input.bankName, 'bankName is required');
    const accountHolderName = requiredString(input.accountHolderName, 'accountHolderName is required');
    const account = await this.prisma.providerBankAccount.create({
      data: {
        providerProfileId: provider.id,
        bankName,
        accountNumberMasked: maskAccountNumber(accountNumber),
        accountNumberLast4: accountNumber?.slice(-4),
        accountHolderName,
        qrBankingInfo: input.qrBankingInfo === undefined ? undefined : toJson(input.qrBankingInfo),
        status: input.status ?? ProviderBankAccountStatus.PENDING_REVIEW,
        isPrimary: true,
      },
    });
    return { ok: true, bankAccount: account };
  }

  async upsertTaxProfile(
    userId: string | undefined,
    input: {
      taxCode?: string;
      legalName: string;
      registeredAddress: string;
      status?: ProviderTaxProfileStatus;
    },
  ) {
    const provider = await this.requireProvider(userId);
    const taxCode = normalizeIdNumber(input.taxCode);
    const legalName = requiredString(input.legalName, 'legalName is required');
    const registeredAddress = requiredString(input.registeredAddress, 'registeredAddress is required');
    const taxProfile = await this.prisma.providerTaxProfile.upsert({
      where: { providerProfileId: provider.id },
      update: {
        taxCodeHash: taxCode ? sha256(taxCode) : undefined,
        taxCodeLast4: taxCode?.slice(-4),
        legalName,
        registeredAddress,
        status: input.status ?? ProviderTaxProfileStatus.PENDING_REVIEW,
      },
      create: {
        providerProfileId: provider.id,
        taxCodeHash: taxCode ? sha256(taxCode) : undefined,
        taxCodeLast4: taxCode?.slice(-4),
        legalName,
        registeredAddress,
        status: input.status ?? ProviderTaxProfileStatus.PENDING_REVIEW,
      },
    });
    return { ok: true, taxProfile };
  }

  async acceptAgreement(
    userId: string | undefined,
    input: {
      type: ProviderAgreementType;
      version: string;
      ipAddress?: string;
      deviceId?: string;
    },
  ) {
    const provider = await this.requireProvider(userId);
    const type = parseEnum(ProviderAgreementType, input.type, 'Invalid agreement type');
    const version = requiredString(input.version, 'Agreement version is required');
    const agreement = await this.prisma.providerAgreement.upsert({
      where: { providerProfileId_type_version: { providerProfileId: provider.id, type, version } },
      update: {
        acceptedAt: new Date(),
        ipAddress: normalizeString(input.ipAddress),
        deviceId: normalizeString(input.deviceId),
      },
      create: {
        providerProfileId: provider.id,
        type,
        version,
        ipAddress: normalizeString(input.ipAddress),
        deviceId: normalizeString(input.deviceId),
      },
    });
    return { ok: true, agreement };
  }

  async reviewKyc(actorId: string, providerProfileId: string, status: ProviderKycStatus, reason?: string) {
    const existing = await this.prisma.providerKyc.findUnique({
      where: { providerProfileId },
    });
    const kyc = await this.prisma.providerKyc.upsert({
      where: { providerProfileId },
      update: {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizeString(reason),
        blockedAt: status === ProviderKycStatus.BLOCKED ? new Date() : undefined,
      },
      create: {
        providerProfileId,
        status,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizeString(reason),
        blockedAt: status === ProviderKycStatus.BLOCKED ? new Date() : undefined,
      },
    });

    await this.prisma.providerVerification.upsert({
      where: { providerProfileId },
      update: {
        status:
          status === ProviderKycStatus.APPROVED ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizeString(reason),
        reviewedAt: new Date(),
      },
      create: {
        providerProfileId,
        status:
          status === ProviderKycStatus.APPROVED ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizeString(reason),
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId,
        actorId,
        action: `kyc.${status.toLowerCase()}`,
        fromStatus: existing?.status,
        toStatus: status,
        metadata: toJson({ reason }),
      },
    });
    await this.writeAudit(actorId, `provider_kyc.${status.toLowerCase()}`, `provider:${providerProfileId}`, {
      reason,
    });
    await this.refreshProviderLevel(providerProfileId);
    return { ok: true, kyc };
  }

  async reviewProviderDocument(
    actorId: string,
    documentId: string,
    status: ProviderDocumentStatus,
    reason?: string,
  ) {
    const existing = await this.prisma.providerDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    const document = await this.prisma.providerDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === ProviderDocumentStatus.APPROVED ? null : normalizeString(reason),
      },
      include: { fileAsset: true },
    });

    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: document.providerProfileId,
        actorId,
        action: `document.${status.toLowerCase()}`,
        fromStatus: existing.status,
        toStatus: status,
        metadata: toJson({
          documentId,
          type: document.type,
          fileAssetId: document.fileAssetId,
          reason,
        }),
      },
    });
    await this.writeAudit(
      actorId,
      `provider_document.${status.toLowerCase()}`,
      `provider:${document.providerProfileId}`,
      {
        documentId,
        type: document.type,
        reason,
      },
    );
    return { ok: true, document };
  }

  async reviewBankAccount(
    actorId: string,
    bankAccountId: string,
    status: ProviderBankAccountStatus,
    reason?: string,
  ) {
    const existing = await this.prisma.providerBankAccount.findUniqueOrThrow({
      where: { id: bankAccountId },
    });
    const account = await this.prisma.providerBankAccount.update({
      where: { id: bankAccountId },
      data: {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === ProviderBankAccountStatus.APPROVED ? null : normalizeString(reason),
      },
    });
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: account.providerProfileId,
        actorId,
        action: `bank_account.${status.toLowerCase()}`,
        fromStatus: existing.status,
        toStatus: status,
        metadata: toJson({ reason, bankAccountId }),
      },
    });
    await this.writeAudit(
      actorId,
      `provider_bank_account.${status.toLowerCase()}`,
      `bank_account:${bankAccountId}`,
      {
        providerProfileId: account.providerProfileId,
        reason,
      },
    );
    await this.refreshProviderLevel(account.providerProfileId);
    return { ok: true, bankAccount: account };
  }

  async reviewTaxProfile(
    actorId: string,
    providerProfileId: string,
    status: ProviderTaxProfileStatus,
    reason?: string,
  ) {
    const existing = await this.prisma.providerTaxProfile.findUniqueOrThrow({
      where: { providerProfileId },
    });
    const taxProfile = await this.prisma.providerTaxProfile.update({
      where: { providerProfileId },
      data: {
        status,
        approvedAt: status === ProviderTaxProfileStatus.APPROVED ? new Date() : null,
        rejectionReason: status === ProviderTaxProfileStatus.APPROVED ? null : normalizeString(reason),
      },
    });
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId,
        actorId,
        action: `tax_profile.${status.toLowerCase()}`,
        fromStatus: existing.status,
        toStatus: status,
        metadata: toJson({ reason }),
      },
    });
    await this.writeAudit(
      actorId,
      `provider_tax_profile.${status.toLowerCase()}`,
      `provider:${providerProfileId}`,
      {
        reason,
      },
    );
    await this.refreshProviderLevel(providerProfileId);
    return { ok: true, taxProfile };
  }

  listTaxPolicyVersions() {
    return this.prisma.taxPolicyVersion.findMany({
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: { rules: { orderBy: { createdAt: 'asc' } } },
      take: 100,
    });
  }

  async createTaxPolicyVersion(
    actorId: string,
    input: {
      name: string;
      status?: TaxPolicyStatus;
      effectiveFrom: string;
      effectiveTo?: string | null;
      notes?: string;
    },
  ) {
    const policy = await this.prisma.taxPolicyVersion.create({
      data: {
        name: requiredString(input.name, 'Policy name is required'),
        status: input.status ?? TaxPolicyStatus.DRAFT,
        effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom is required'),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        notes: normalizeString(input.notes),
        createdById: actorId,
      },
      include: { rules: true },
    });
    await this.writeAudit(actorId, 'tax_policy.create', `tax_policy:${policy.id}`, { status: policy.status });
    return policy;
  }

  async updateTaxPolicyVersion(
    actorId: string,
    id: string,
    input: {
      name?: string;
      status?: TaxPolicyStatus;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ) {
    const policy = await this.prisma.taxPolicyVersion.update({
      where: { id },
      data: {
        name: normalizeString(input.name),
        status: input.status,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
        effectiveTo:
          input.effectiveTo === undefined
            ? undefined
            : input.effectiveTo
              ? new Date(input.effectiveTo)
              : null,
        notes: input.notes === undefined ? undefined : normalizeString(input.notes),
      },
      include: { rules: true },
    });
    await this.writeAudit(actorId, 'tax_policy.update', `tax_policy:${policy.id}`, { status: policy.status });
    return policy;
  }

  async createTaxRule(
    actorId: string,
    policyVersionId: string,
    input: {
      scope?: TaxRuleScope;
      serviceType?: string;
      minGrossAmount?: number;
      maxGrossAmount?: number;
      rateBps?: number;
      fixedAmount?: number;
      active?: boolean;
    },
  ) {
    const scope = input.scope ?? TaxRuleScope.DEFAULT;
    const rateBps = input.rateBps ?? 0;
    if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
      throw new BadRequestException('rateBps must be an integer between 0 and 10000');
    }
    const rule = await this.prisma.taxRule.create({
      data: {
        policyVersionId,
        scope,
        serviceType: normalizeString(input.serviceType),
        minGrossAmount: input.minGrossAmount,
        maxGrossAmount: input.maxGrossAmount,
        rateBps,
        fixedAmount: input.fixedAmount ?? 0,
        active: input.active ?? true,
      },
    });
    await this.writeAudit(actorId, 'tax_rule.create', `tax_rule:${rule.id}`, {
      policyVersionId,
      scope,
      rateBps,
    });
    return rule;
  }

  private async attachProviderDocument(
    providerProfileId: string,
    fileAssetId: string,
    type: ProviderDocumentType,
  ) {
    const file = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        owner: { providerProfile: { id: providerProfileId } },
        visibility: FileVisibility.PRIVATE,
        uploadStatus: FileUploadStatus.UPLOADED,
      },
    });
    if (!file) {
      throw new BadRequestException(`Uploaded private file not found for document ${type}`);
    }
    return this.prisma.providerDocument.upsert({
      where: { fileAssetId },
      update: {
        providerProfileId,
        type,
        status: ProviderDocumentStatus.PENDING_REVIEW,
        rejectionReason: null,
      },
      create: {
        providerProfileId,
        fileAssetId,
        type,
      },
    });
  }

  private async requireProvider(userId?: string) {
    if (!userId) {
      throw new BadRequestException('Authenticated provider is required');
    }
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        verification: true,
        kyc: true,
        documents: { include: { fileAsset: true }, orderBy: { createdAt: 'desc' } },
        bankAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
        taxProfile: true,
        agreements: { orderBy: { acceptedAt: 'desc' } },
      },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }
    return provider;
  }

  private async refreshProviderLevel(providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerProfileId },
      include: {
        verification: true,
        kyc: true,
        bankAccounts: true,
        taxProfile: true,
        agreements: true,
      },
    });
    const completedBookingCount = await this.prisma.booking.count({
      where: {
        selectedProviderId: provider.id,
        status: BookingStatus.COMPLETED,
      },
    });
    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));
    const level = this.recommendedLevel({
      kycApproved: provider.kyc?.status === ProviderKycStatus.APPROVED,
      legacyVerificationApproved: provider.verification?.status === VerificationStatus.APPROVED,
      approvedBankAccount: provider.bankAccounts.some(
        (account) => account.status === ProviderBankAccountStatus.APPROVED,
      ),
      canWithdraw:
        completedBookingCount > 0 &&
        provider.taxProfile?.status === ProviderTaxProfileStatus.APPROVED &&
        Boolean(provider.residentialAddress?.trim()) &&
        missingAgreements.length === 0,
      trustedAt: provider.trustedAt,
    });
    if (provider.level === level) {
      return provider;
    }
    return this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: { level },
    });
  }

  private recommendedLevel(input: {
    kycApproved: boolean;
    legacyVerificationApproved: boolean;
    approvedBankAccount: boolean;
    canWithdraw: boolean;
    trustedAt: Date | null;
  }) {
    if (input.trustedAt) {
      return ProviderLevel.LEVEL_4_TRUSTED;
    }
    if (input.canWithdraw) {
      return ProviderLevel.LEVEL_3_PAYOUT_ENABLED;
    }
    if ((input.kycApproved || input.legacyVerificationApproved) && input.approvedBankAccount) {
      return ProviderLevel.LEVEL_2_ACTIVE;
    }
    return ProviderLevel.LEVEL_1_SIGNUP;
  }

  private nextRequiredActions(input: {
    provider: Awaited<ReturnType<ProviderOnboardingService['requireProvider']>>;
    kycApproved: boolean;
    legacyVerificationApproved: boolean;
    approvedBankAccount: boolean;
    completedBookingCount: number;
    taxProfileApproved: boolean;
    hasAddress: boolean;
    missingAgreements: ProviderAgreementType[];
  }) {
    const actions = [];
    if (!input.provider.legalName || !input.provider.dateOfBirth || !input.provider.displayName) {
      actions.push('BASIC_PROFILE');
    }
    if (!input.kycApproved && !input.legacyVerificationApproved) {
      actions.push('KYC_REVIEW');
    }
    if (!input.approvedBankAccount) {
      actions.push('BANK_ACCOUNT_REVIEW');
    }
    if (input.completedBookingCount > 0 && !input.taxProfileApproved) {
      actions.push('TAX_PROFILE_REVIEW');
    }
    if (input.completedBookingCount > 0 && !input.hasAddress) {
      actions.push('RESIDENTIAL_ADDRESS');
    }
    if (input.completedBookingCount > 0 && input.missingAgreements.length > 0) {
      actions.push('AGREEMENTS');
    }
    return actions;
  }

  private writeAudit(actorId: string, action: string, target: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata,
      },
    });
  }
}

function parseEnum<T extends Record<string, string>>(values: T, value: string, message: string): T[keyof T] {
  if (Object.values(values).includes(value)) {
    return value as T[keyof T];
  }
  throw new BadRequestException(message);
}

function parseDate(value: string | undefined, message: string) {
  if (!value) {
    throw new BadRequestException(message);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(message);
  }
  return date;
}

function requiredString(value: string | undefined, message: string) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new BadRequestException(message);
  }
  return normalized;
}

function normalizeString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIdNumber(value?: string | null) {
  const normalized = value?.replace(/\s+/g, '').trim();
  return normalized ? normalized : undefined;
}

function maskAccountNumber(value?: string) {
  if (!value) {
    return undefined;
  }
  const last4 = value.slice(-4);
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${last4}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
