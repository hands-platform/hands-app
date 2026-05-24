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
import {
  OPTIONAL_PROVIDER_DOCUMENT_TYPES,
  PROVIDER_AGREEMENT_VERSION,
  PROVIDER_LEVEL_REQUIREMENTS,
  REQUIRED_KYC_DOCUMENT_TYPES,
  REQUIRED_PAYOUT_AGREEMENTS,
} from './provider-onboarding.policy';

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
    const payoutSetupStarted = completedBookingCount > 0;
    const canWithdraw =
      payoutSetupStarted && taxProfileApproved && hasAddress && missingAgreements.length === 0;

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
      recentVerificationLogs: provider.verificationLogs,
      completedBookingCount,
      payoutGate: {
        canWithdraw,
        missing: {
          firstCompletedService: !payoutSetupStarted,
          taxProfileApproved: payoutSetupStarted && !taxProfileApproved,
          residentialAddress: payoutSetupStarted && !hasAddress,
          agreements: payoutSetupStarted ? missingAgreements : [],
        },
      },
      activeTaxPolicy,
      requirements: {
        requiredKycDocumentTypes: REQUIRED_KYC_DOCUMENT_TYPES,
        optionalProviderDocumentTypes: OPTIONAL_PROVIDER_DOCUMENT_TYPES,
        requiredPayoutAgreements: REQUIRED_PAYOUT_AGREEMENTS,
        agreementVersion: PROVIDER_AGREEMENT_VERSION,
        providerLevelRequirements: PROVIDER_LEVEL_REQUIREMENTS,
      },
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
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: provider.id,
        action: 'basic_profile.update',
        toStatus: 'UPDATED',
        metadata: toJson({
          hasAddress: Boolean(updated.residentialAddress?.trim()),
          city: updated.city,
        }),
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
    const requestedDocuments = (input.documents ?? []).map((document) => ({
      fileId: requiredString(document.fileId, 'fileId is required'),
      type: parseEnum(ProviderDocumentType, document.type, 'Invalid provider document type'),
    }));
    this.assertUniqueKycDocumentPayload(requestedDocuments);
    const submittedDocumentTypes = new Set([
      ...provider.documents
        .filter((document) => document.status !== ProviderDocumentStatus.REJECTED)
        .map((document) => document.type),
      ...requestedDocuments.map((document) => document.type),
    ]);
    const missingRequiredDocuments = REQUIRED_KYC_DOCUMENT_TYPES.filter(
      (type) => !submittedDocumentTypes.has(type),
    );
    if (missingRequiredDocuments.length > 0) {
      throw new BadRequestException(`Missing required KYC documents: ${missingRequiredDocuments.join(', ')}`);
    }

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

    for (const document of requestedDocuments) {
      await this.attachProviderDocument(provider.id, document.fileId, document.type);
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

  private assertUniqueKycDocumentPayload(documents: Array<{ fileId: string; type: ProviderDocumentType }>) {
    const seenTypes = new Set<ProviderDocumentType>();
    const seenFileIds = new Set<string>();
    for (const document of documents) {
      if (seenTypes.has(document.type)) {
        throw new BadRequestException(`Duplicate KYC document type: ${document.type}`);
      }
      if (seenFileIds.has(document.fileId)) {
        throw new BadRequestException('Each KYC document must use a different uploaded file');
      }
      seenTypes.add(document.type);
      seenFileIds.add(document.fileId);
    }
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
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: provider.id,
        action: 'bank_account.submit',
        toStatus: account.status,
        metadata: toJson({
          bankAccountId: account.id,
          bankName,
          accountNumberLast4: account.accountNumberLast4,
        }),
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
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: provider.id,
        action: 'tax_profile.submit',
        fromStatus: provider.taxProfile?.status,
        toStatus: taxProfile.status,
        metadata: toJson({
          taxProfileId: taxProfile.id,
          taxCodeLast4: taxProfile.taxCodeLast4,
        }),
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
    await this.prisma.providerVerificationLog.create({
      data: {
        providerProfileId: provider.id,
        action: 'agreement.accept',
        toStatus: type,
        metadata: toJson({
          type,
          version,
          deviceId: normalizeString(input.deviceId),
        }),
      },
    });
    return { ok: true, agreement };
  }

  async reviewKyc(actorId: string, providerProfileId: string, status: ProviderKycStatus, reason?: string) {
    const existing = await this.prisma.providerKyc.findUnique({
      where: { providerProfileId },
    });
    if (status === ProviderKycStatus.APPROVED) {
      const missingRequiredDocuments = await this.findMissingApprovedKycDocumentTypes(providerProfileId);
      if (missingRequiredDocuments.length > 0) {
        throw new BadRequestException(
          `Cannot approve KYC before required documents are approved: ${missingRequiredDocuments.join(', ')}`,
        );
      }
    }
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
    await this.refreshProviderLevel(document.providerProfileId);
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
    const status = input.status ?? TaxPolicyStatus.DRAFT;
    const result = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.taxPolicyVersion.create({
        data: {
          name: requiredString(input.name, 'Policy name is required'),
          status,
          effectiveFrom: parseDate(input.effectiveFrom, 'effectiveFrom is required'),
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
          notes: normalizeString(input.notes),
          createdById: actorId,
        },
        include: { rules: true },
      });
      const deactivated = await deactivateOtherActiveTaxPolicies(tx, policy.id, status);
      return { policy, deactivatedCount: deactivated.count };
    });
    const { policy } = result;
    await this.writeAudit(actorId, 'tax_policy.create', `tax_policy:${policy.id}`, {
      status: policy.status,
      deactivatedOtherActivePolicies: result.deactivatedCount,
    });
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
    const result = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.taxPolicyVersion.update({
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
      const deactivated = await deactivateOtherActiveTaxPolicies(tx, policy.id, policy.status);
      return { policy, deactivatedCount: deactivated.count };
    });
    const { policy } = result;
    await this.writeAudit(actorId, 'tax_policy.update', `tax_policy:${policy.id}`, {
      status: policy.status,
      deactivatedOtherActivePolicies: result.deactivatedCount,
    });
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
    const data = normalizeTaxRuleInput(input, true);
    const rule = await this.prisma.taxRule.create({
      data: {
        policyVersionId,
        scope: data.scope,
        serviceType: data.serviceType,
        minGrossAmount: data.minGrossAmount,
        maxGrossAmount: data.maxGrossAmount,
        rateBps: data.rateBps,
        fixedAmount: data.fixedAmount,
        active: data.active,
      },
    });
    await this.writeAudit(actorId, 'tax_rule.create', `tax_rule:${rule.id}`, {
      policyVersionId,
      scope: rule.scope,
      rateBps: rule.rateBps,
    });
    return rule;
  }

  async updateTaxRule(
    actorId: string,
    id: string,
    input: {
      scope?: TaxRuleScope;
      serviceType?: string | null;
      minGrossAmount?: number | null;
      maxGrossAmount?: number | null;
      rateBps?: number;
      fixedAmount?: number;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.taxRule.findUniqueOrThrow({ where: { id } });
    const data = normalizeTaxRuleInput(
      {
        scope: input.scope ?? existing.scope,
        serviceType: input.serviceType === undefined ? existing.serviceType : input.serviceType,
        minGrossAmount: input.minGrossAmount === undefined ? existing.minGrossAmount : input.minGrossAmount,
        maxGrossAmount: input.maxGrossAmount === undefined ? existing.maxGrossAmount : input.maxGrossAmount,
        rateBps: input.rateBps ?? existing.rateBps,
        fixedAmount: input.fixedAmount ?? existing.fixedAmount,
        active: input.active ?? existing.active,
      },
      false,
    );
    const rule = await this.prisma.taxRule.update({
      where: { id },
      data,
    });
    await this.writeAudit(actorId, 'tax_rule.update', `tax_rule:${rule.id}`, {
      policyVersionId: rule.policyVersionId,
      scope: rule.scope,
      rateBps: rule.rateBps,
      active: rule.active,
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
        verificationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { actor: { select: { phone: true, fullName: true } } },
        },
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

  private async findMissingApprovedKycDocumentTypes(providerProfileId: string) {
    const approvedDocuments = await this.prisma.providerDocument.findMany({
      where: {
        providerProfileId,
        type: { in: [...REQUIRED_KYC_DOCUMENT_TYPES] },
        status: ProviderDocumentStatus.APPROVED,
      },
      select: { type: true },
    });
    const approvedTypes = new Set(approvedDocuments.map((document) => document.type));
    return REQUIRED_KYC_DOCUMENT_TYPES.filter((type) => !approvedTypes.has(type));
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

function deactivateOtherActiveTaxPolicies(
  tx: Prisma.TransactionClient,
  activePolicyId: string,
  status: TaxPolicyStatus,
) {
  if (status !== TaxPolicyStatus.ACTIVE) {
    return Promise.resolve({ count: 0 });
  }
  return tx.taxPolicyVersion.updateMany({
    where: {
      id: { not: activePolicyId },
      status: TaxPolicyStatus.ACTIVE,
    },
    data: { status: TaxPolicyStatus.INACTIVE },
  });
}

function normalizeTaxRuleInput(
  input: {
    scope?: TaxRuleScope;
    serviceType?: string | null;
    minGrossAmount?: number | null;
    maxGrossAmount?: number | null;
    rateBps?: number;
    fixedAmount?: number;
    active?: boolean;
  },
  isCreate: boolean,
) {
  const scope = input.scope ?? TaxRuleScope.DEFAULT;
  const rateBps = input.rateBps ?? 0;
  const fixedAmount = input.fixedAmount ?? 0;
  const minGrossAmount = input.minGrossAmount ?? null;
  const maxGrossAmount = input.maxGrossAmount ?? null;
  const serviceType = normalizeString(input.serviceType);

  if (!Object.values(TaxRuleScope).includes(scope)) {
    throw new BadRequestException('Invalid tax rule scope');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new BadRequestException('rateBps must be an integer between 0 and 10000');
  }
  if (!Number.isInteger(fixedAmount) || fixedAmount < 0) {
    throw new BadRequestException('fixedAmount must be a non-negative integer');
  }
  if (minGrossAmount !== null && (!Number.isInteger(minGrossAmount) || minGrossAmount < 0)) {
    throw new BadRequestException('minGrossAmount must be a non-negative integer');
  }
  if (maxGrossAmount !== null && (!Number.isInteger(maxGrossAmount) || maxGrossAmount < 0)) {
    throw new BadRequestException('maxGrossAmount must be a non-negative integer');
  }
  if (minGrossAmount !== null && maxGrossAmount !== null && minGrossAmount > maxGrossAmount) {
    throw new BadRequestException('minGrossAmount cannot be greater than maxGrossAmount');
  }
  if (scope === TaxRuleScope.SERVICE_TYPE && !serviceType) {
    throw new BadRequestException('SERVICE_TYPE tax rules require serviceType');
  }
  if (scope === TaxRuleScope.AMOUNT_BAND && minGrossAmount === null && maxGrossAmount === null) {
    throw new BadRequestException('AMOUNT_BAND tax rules require minGrossAmount or maxGrossAmount');
  }

  return {
    scope,
    serviceType: scope === TaxRuleScope.SERVICE_TYPE ? serviceType : null,
    minGrossAmount: scope === TaxRuleScope.AMOUNT_BAND ? minGrossAmount : null,
    maxGrossAmount: scope === TaxRuleScope.AMOUNT_BAND ? maxGrossAmount : null,
    rateBps,
    fixedAmount,
    active: input.active ?? (isCreate ? true : undefined),
  };
}
