import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
  Role,
  ProviderTaxProfileStatus,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  OPTIONAL_PROVIDER_DOCUMENT_TYPES,
  PROVIDER_AGREEMENT_VERSION,
  PROVIDER_LEVEL_REQUIREMENTS,
  REQUIRED_KYC_DOCUMENT_TYPES,
  REQUIRED_PAYOUT_AGREEMENTS,
} from './provider-onboarding.policy';
import { providerBankCorrectionRequest } from './provider-bank-correction';

const ADMIN_TAX_POLICY_VERSION_DEFAULT_TAKE = 20;
const ADMIN_TAX_POLICY_VERSION_MAX_TAKE = 100;

type AdminTaxPolicyVersionListOptions = {
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};

type TaxPolicyFinanceApprovalInput = {
  readonly approvalAdminId: string;
  readonly operatorReason: string;
};

@Injectable()
export class ProviderOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

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

    const readiness = this.providerReadiness(provider, completedBookingCount);
    const bankCorrectionRequest = providerBankCorrectionRequest(provider.bankAccounts);

    return {
      providerProfileId: provider.id,
      level: provider.level,
      recommendedLevel: this.recommendedLevel({
        kycApproved: readiness.kycApproved,
        legacyVerificationApproved: readiness.legacyVerificationApproved,
        requiredDocumentsApproved: readiness.requiredDocumentsApproved,
        serviceReadyProfile: readiness.serviceReadyProfile,
      }),
      basicProfile: {
        displayName: provider.displayName,
        legalName: provider.legalName,
        dateOfBirth: provider.dateOfBirth,
        gender: provider.gender,
        facebookId: provider.facebookId,
        activityNickname: provider.activityNickname,
        bio: provider.bio,
        experienceYears: provider.experienceYears,
        specialties: provider.specialties,
        languages: provider.languages,
        serviceStyle: provider.serviceStyle,
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
        canWithdraw: readiness.canWithdraw,
        missing: {
          firstCompletedService: !readiness.payoutSetupStarted,
          taxProfileApproved: false,
          residentialAddress: readiness.payoutSetupStarted && !readiness.hasAddress,
          agreements: readiness.payoutSetupStarted ? readiness.missingAgreements : [],
        },
        bankCorrectionRequest,
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
        kycApproved: readiness.kycApproved,
        legacyVerificationApproved: readiness.legacyVerificationApproved,
        requiredDocumentsApproved: readiness.requiredDocumentsApproved,
        serviceReadyProfile: readiness.serviceReadyProfile,
        completedBookingCount,
        hasAddress: readiness.hasAddress,
        missingAgreements: readiness.missingAgreements,
        bankCorrectionRequest,
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
      experienceYears?: number;
      specialties?: unknown;
      languages?: unknown;
      serviceStyle?: string;
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
        experienceYears: normalizeOptionalInteger(input.experienceYears),
        specialties: input.specialties === undefined ? undefined : toJsonList(input.specialties),
        languages: input.languages === undefined ? undefined : toJsonList(input.languages),
        serviceStyle: normalizeString(input.serviceStyle),
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
          specialtyCount: Array.isArray(updated.specialties) ? updated.specialties.length : 0,
          languageCount: Array.isArray(updated.languages) ? updated.languages.length : 0,
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
    const account = await this.prisma.$transaction(async (tx) => {
      await tx.providerBankAccount.updateMany({
        where: { providerProfileId: provider.id, isPrimary: true, deletedAt: null },
        data: { isPrimary: false },
      });
      return tx.providerBankAccount.create({
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
    const normalizedReason = normalizeString(reason);
    if (status === ProviderKycStatus.BLOCKED && !normalizedReason) {
      throw new BadRequestException('KYC hold reason is required');
    }
    const [existing, provider] = await Promise.all([
      this.prisma.providerKyc.findUnique({ where: { providerProfileId } }),
      this.prisma.providerProfile.findUniqueOrThrow({
        where: { id: providerProfileId },
        select: { displayName: true, userId: true },
      }),
    ]);
    if (status === ProviderKycStatus.APPROVED) {
      const missingRequiredDocuments = await this.findMissingSubmittedKycDocumentTypes(providerProfileId);
      if (missingRequiredDocuments.length > 0) {
        throw new BadRequestException(
          `Cannot approve KYC before required documents are submitted: ${missingRequiredDocuments.join(', ')}`,
        );
      }
      await this.prisma.providerDocument.updateMany({
        where: {
          providerProfileId,
          type: { in: [...REQUIRED_KYC_DOCUMENT_TYPES] },
          deletedAt: null,
        },
        data: {
          status: ProviderDocumentStatus.APPROVED,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
    }
    const verificationStatus =
      status === ProviderKycStatus.APPROVED
        ? VerificationStatus.APPROVED
        : status === ProviderKycStatus.BLOCKED
          ? VerificationStatus.SUBMITTED
          : VerificationStatus.REJECTED;
    const kyc = await this.prisma.providerKyc.upsert({
      where: { providerProfileId },
      update: {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizedReason,
        blockedAt: status === ProviderKycStatus.BLOCKED ? new Date() : null,
      },
      create: {
        providerProfileId,
        status,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizedReason,
        blockedAt: status === ProviderKycStatus.BLOCKED ? new Date() : undefined,
      },
    });

    await this.prisma.providerVerification.upsert({
      where: { providerProfileId },
      update: {
        status: verificationStatus,
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizedReason,
        reviewedAt: new Date(),
      },
      create: {
        providerProfileId,
        status: verificationStatus,
        rejectionReason: status === ProviderKycStatus.APPROVED ? null : normalizedReason,
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
        metadata: toJson({ reason: normalizedReason }),
      },
    });
    await this.writeAudit(actorId, `provider_kyc.${status.toLowerCase()}`, `provider:${providerProfileId}`, {
      reason,
    });
    await this.refreshProviderLevel(providerProfileId);
    await this.notifyProviderReviewResult({
      userId: provider.userId,
      providerProfileId,
      kind: 'kyc',
      label: 'Identity verification',
      status,
      reason: normalizedReason,
    });
    return { ok: true, kyc };
  }

  async reviewProviderDocument(
    actorId: string,
    documentId: string,
    status: ProviderDocumentStatus,
    reason?: string,
  ) {
    const normalizedReason = normalizeString(reason);
    const existing = await this.prisma.providerDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: { providerProfile: { select: { userId: true } } },
    });
    const document = await this.prisma.providerDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewedAt: new Date(),
        rejectionReason: status === ProviderDocumentStatus.APPROVED ? null : normalizedReason,
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
    await this.notifyProviderReviewResult({
      userId: existing.providerProfile.userId,
      providerProfileId: document.providerProfileId,
      kind: 'document',
      label: providerDocumentNotificationLabel(document.type),
      status,
      reason: normalizedReason,
      documentId,
    });
    return { ok: true, document };
  }

  private async notifyProviderReviewResult(input: {
    readonly documentId?: string;
    readonly kind: 'document' | 'kyc';
    readonly label: string;
    readonly providerProfileId: string;
    readonly reason?: string;
    readonly status: ProviderDocumentStatus | ProviderKycStatus;
    readonly userId: string;
  }) {
    if (!this.notifications) return;

    const approved = String(input.status) === 'APPROVED';
    const onHold = String(input.status) === 'BLOCKED';
    const reviewReason = normalizeString(input.reason);
    const type = `provider.${input.kind}.${approved ? 'approved' : onHold ? 'on_hold' : 'rejected'}`;
    const title = approved
      ? `${input.label} approved`
      : onHold
        ? `${input.label} on hold`
        : `${input.label} needs correction`;
    const body = approved
      ? `${input.label} has been approved. No further action is required.`
      : onHold
        ? `${input.label} is on hold${reviewReason ? `: ${reviewReason}` : '.'} Update the requested information and submit it again.`
        : `${input.label} was not approved${reviewReason ? `: ${reviewReason}` : '.'} Update the requested information and submit it again.`;

    await this.notifications.create({
      userId: input.userId,
      targetRole: Role.PROVIDER,
      type,
      title,
      body,
      resolveTemplate: false,
      data: {
        documentId: input.documentId,
        providerProfileId: input.providerProfileId,
        reviewReason,
        reviewStatus: input.status,
        resubmissionRequired: !approved,
      },
    });
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

  listTaxPolicyVersions(options: AdminTaxPolicyVersionListOptions = {}) {
    const skip = normalizeAdminTaxPolicyVersionSkip(options.skip);
    const args: Prisma.TaxPolicyVersionFindManyArgs = {
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: { rules: { orderBy: { createdAt: 'asc' } } },
      take: normalizeAdminTaxPolicyVersionTake(options.take),
    };
    if (skip > 0) {
      args.skip = skip;
    }
    return this.prisma.taxPolicyVersion.findMany(args);
  }

  async createTaxPolicyVersion(
    actorId: string,
    input: TaxPolicyFinanceApprovalInput & {
      name: string;
      status?: TaxPolicyStatus;
      effectiveFrom: string;
      effectiveTo?: string | null;
      notes?: string;
    },
  ) {
    const status = input.status ?? TaxPolicyStatus.DRAFT;
    const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom is required');
    const effectiveTo = parseOptionalDate(input.effectiveTo, 'effectiveTo must be a valid date');
    assertTaxPolicyEffectiveWindow(effectiveFrom, effectiveTo);

    const result = await this.prisma.$transaction(async (tx) => {
      const approval = await requireTaxPolicyFinanceApproval(
        tx,
        actorId,
        input,
        'Tax policy version create',
      );
      const policy = await tx.taxPolicyVersion.create({
        data: {
          name: requiredString(input.name, 'Policy name is required'),
          status,
          effectiveFrom,
          effectiveTo,
          notes: normalizeString(input.notes),
          createdById: actorId,
        },
        include: { rules: true },
      });
      const deactivated = await deactivateOtherActiveTaxPolicies(tx, policy.id, status);
      return { approval, policy, deactivatedCount: deactivated.count };
    });
    const { policy } = result;
    await this.writeAudit(actorId, 'tax_policy.create', `tax_policy:${policy.id}`, {
      approvalAdminId: result.approval.approvalAdminId,
      operatorReason: result.approval.operatorReason,
      status: policy.status,
      deactivatedOtherActivePolicies: result.deactivatedCount,
    });
    return policy;
  }

  async updateTaxPolicyVersion(
    actorId: string,
    id: string,
    input: TaxPolicyFinanceApprovalInput & {
      name?: string;
      status?: TaxPolicyStatus;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ) {
    const effectiveFrom = input.effectiveFrom
      ? parseDate(input.effectiveFrom, 'effectiveFrom must be a valid date')
      : undefined;
    const effectiveTo =
      input.effectiveTo === undefined
        ? undefined
        : parseOptionalDate(input.effectiveTo, 'effectiveTo must be a valid date');
    if (effectiveFrom && effectiveTo) {
      assertTaxPolicyEffectiveWindow(effectiveFrom, effectiveTo);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const approval = await requireTaxPolicyFinanceApproval(
        tx,
        actorId,
        input,
        'Tax policy version update',
      );
      const policy = await tx.taxPolicyVersion.update({
        where: { id },
        data: {
          name: normalizeString(input.name),
          status: input.status,
          effectiveFrom,
          effectiveTo,
          notes: input.notes === undefined ? undefined : normalizeString(input.notes),
        },
        include: { rules: true },
      });
      assertTaxPolicyEffectiveWindow(policy.effectiveFrom, policy.effectiveTo);
      const deactivated = await deactivateOtherActiveTaxPolicies(tx, policy.id, policy.status);
      return { approval, policy, deactivatedCount: deactivated.count };
    });
    const { policy } = result;
    await this.writeAudit(actorId, 'tax_policy.update', `tax_policy:${policy.id}`, {
      approvalAdminId: result.approval.approvalAdminId,
      operatorReason: result.approval.operatorReason,
      status: policy.status,
      deactivatedOtherActivePolicies: result.deactivatedCount,
    });
    return policy;
  }

  async createTaxRule(
    actorId: string,
    policyVersionId: string,
    input: TaxPolicyFinanceApprovalInput & {
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
    const rule = await this.prisma.$transaction(async (tx) => {
      const approval = await requireTaxPolicyFinanceApproval(
        tx,
        actorId,
        input,
        'Tax rule create',
      );
      await assertTaxRuleDoesNotConflict(tx, policyVersionId, data);
      const createdRule = await tx.taxRule.create({
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
      return { approval, rule: createdRule };
    });
    await this.writeAudit(actorId, 'tax_rule.create', `tax_rule:${rule.rule.id}`, {
      approvalAdminId: rule.approval.approvalAdminId,
      operatorReason: rule.approval.operatorReason,
      policyVersionId,
      scope: rule.rule.scope,
      rateBps: rule.rule.rateBps,
    });
    return rule.rule;
  }

  async updateTaxRule(
    actorId: string,
    id: string,
    input: TaxPolicyFinanceApprovalInput & {
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
    const rule = await this.prisma.$transaction(async (tx) => {
      const approval = await requireTaxPolicyFinanceApproval(
        tx,
        actorId,
        input,
        'Tax rule update',
      );
      await assertTaxRuleDoesNotConflict(tx, existing.policyVersionId, data, existing.id);
      const updatedRule = await tx.taxRule.update({
        where: { id },
        data,
      });
      return { approval, rule: updatedRule };
    });
    await this.writeAudit(actorId, 'tax_rule.update', `tax_rule:${rule.rule.id}`, {
      approvalAdminId: rule.approval.approvalAdminId,
      operatorReason: rule.approval.operatorReason,
      policyVersionId: rule.rule.policyVersionId,
      scope: rule.rule.scope,
      rateBps: rule.rule.rateBps,
      active: rule.rule.active,
    });
    return rule.rule;
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
      throw new BadRequestException('Authenticated partner is required');
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
      throw new NotFoundException('Partner profile not found');
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
        documents: {
          select: { type: true, status: true, deletedAt: true },
        },
        agreements: true,
      },
    });
    const completedBookingCount = await this.prisma.booking.count({
      where: {
        selectedProviderId: provider.id,
        status: BookingStatus.COMPLETED,
      },
    });
    const readiness = this.providerReadiness(provider, completedBookingCount);
    const level = this.recommendedLevel({
      kycApproved: readiness.kycApproved,
      legacyVerificationApproved: readiness.legacyVerificationApproved,
      requiredDocumentsApproved: readiness.requiredDocumentsApproved,
      serviceReadyProfile: readiness.serviceReadyProfile,
    });
    if (provider.level === level) {
      return provider;
    }
    return this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: { level },
    });
  }

  private async findMissingSubmittedKycDocumentTypes(providerProfileId: string) {
    const submittedDocuments = await this.prisma.providerDocument.findMany({
      where: {
        providerProfileId,
        type: { in: [...REQUIRED_KYC_DOCUMENT_TYPES] },
        deletedAt: null,
        fileAsset: { uploadStatus: FileUploadStatus.UPLOADED },
      },
      select: { type: true },
    });
    const submittedTypes = new Set(submittedDocuments.map((document) => document.type));
    return REQUIRED_KYC_DOCUMENT_TYPES.filter((type) => !submittedTypes.has(type));
  }

  private providerReadiness(
    provider: {
      verification?: { status: VerificationStatus } | null;
      kyc?: { status: ProviderKycStatus } | null;
      bankAccounts: readonly { status: ProviderBankAccountStatus }[];
      taxProfile?: { status: ProviderTaxProfileStatus } | null;
      documents?: readonly {
        type: ProviderDocumentType;
        status: ProviderDocumentStatus;
        deletedAt?: Date | null;
      }[];
      agreements: readonly { type: ProviderAgreementType }[];
      displayName?: string | null;
      legalName?: string | null;
      residentialAddress?: string | null;
    },
    completedBookingCount: number,
  ) {
    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));
    const approvedDocumentTypes = new Set(
      (provider.documents ?? [])
        .filter((document) => document.status === ProviderDocumentStatus.APPROVED && !document.deletedAt)
        .map((document) => document.type),
    );
    const hasAddress = Boolean(provider.residentialAddress?.trim());
    const payoutSetupStarted = completedBookingCount > 0;
    const requiredDocumentsApproved = REQUIRED_KYC_DOCUMENT_TYPES.every((type) =>
      approvedDocumentTypes.has(type),
    );
    const serviceReadyProfile = Boolean(provider.displayName?.trim() && provider.legalName?.trim());

    return {
      approvedBankAccount: provider.bankAccounts.some(
        (account) => account.status === ProviderBankAccountStatus.APPROVED,
      ),
      canWithdraw: payoutSetupStarted && hasAddress && missingAgreements.length === 0,
      hasAddress,
      kycApproved: provider.kyc?.status === ProviderKycStatus.APPROVED,
      legacyVerificationApproved: provider.verification?.status === VerificationStatus.APPROVED,
      missingAgreements,
      payoutSetupStarted,
      requiredDocumentsApproved,
      serviceReadyProfile,
      taxProfileApproved: true,
    };
  }

  private recommendedLevel(input: {
    kycApproved: boolean;
    legacyVerificationApproved: boolean;
    requiredDocumentsApproved: boolean;
    serviceReadyProfile: boolean;
  }) {
    if (
      input.kycApproved &&
      input.legacyVerificationApproved &&
      input.requiredDocumentsApproved &&
      input.serviceReadyProfile
    ) {
      return ProviderLevel.LEVEL_2_ACTIVE;
    }
    return ProviderLevel.LEVEL_1_SIGNUP;
  }

  private nextRequiredActions(input: {
    provider: Awaited<ReturnType<ProviderOnboardingService['requireProvider']>>;
    kycApproved: boolean;
    legacyVerificationApproved: boolean;
    requiredDocumentsApproved: boolean;
    serviceReadyProfile: boolean;
    completedBookingCount: number;
    hasAddress: boolean;
    missingAgreements: ProviderAgreementType[];
    bankCorrectionRequest: ReturnType<typeof providerBankCorrectionRequest>;
  }) {
    const actions = [];
    if (!input.provider.legalName || !input.provider.dateOfBirth || !input.provider.displayName) {
      actions.push('BASIC_PROFILE');
    }
    if (!input.kycApproved && !input.legacyVerificationApproved) {
      actions.push('KYC_REVIEW');
    }
    if (!input.requiredDocumentsApproved) {
      actions.push('KYC_DOCUMENT_REVIEW');
    }
    if (!input.serviceReadyProfile) {
      actions.push('SERVICE_READY_PROFILE');
    }
    if (input.completedBookingCount > 0 && !input.hasAddress) {
      actions.push('RESIDENTIAL_ADDRESS');
    }
    if (input.completedBookingCount > 0 && input.missingAgreements.length > 0) {
      actions.push('AGREEMENTS');
    }
    if (input.bankCorrectionRequest) {
      actions.push('BANK_ACCOUNT_CORRECTION');
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

function parseOptionalDate(value: string | null | undefined, message: string) {
  if (!value) {
    return null;
  }
  return parseDate(value, message);
}

function assertTaxPolicyEffectiveWindow(effectiveFrom: Date, effectiveTo?: Date | null) {
  if (!effectiveTo) {
    return;
  }
  if (effectiveTo.getTime() <= effectiveFrom.getTime()) {
    throw new BadRequestException('effectiveTo must be after effectiveFrom');
  }
}

function requiredString(value: string | undefined, message: string) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new BadRequestException(message);
  }
  return normalized;
}

async function requireTaxPolicyFinanceApproval(
  tx: Prisma.TransactionClient,
  actorId: string,
  input: TaxPolicyFinanceApprovalInput,
  actionLabel: string,
) {
  const approvalAdminId = requiredString(
    input.approvalAdminId,
    `${actionLabel} requires a Finance approver`,
  );
  if (approvalAdminId === actorId) {
    throw new BadRequestException(`${actionLabel} requires a different Finance approver`);
  }
  const approver = await tx.user.findUnique({
    where: { id: approvalAdminId },
    select: { id: true, roles: true },
  });
  if (
    !approver?.roles.includes(Role.ADMIN) ||
    !approver.roles.includes(Role.FINANCE_APPROVER)
  ) {
    throw new BadRequestException(`${actionLabel} requires approval from a Finance approver`);
  }
  const operatorReason = requiredString(
    input.operatorReason,
    `${actionLabel} requires operator evidence`,
  );
  if (operatorReason.length < 10) {
    throw new BadRequestException(`${actionLabel} requires at least 10 characters of operator evidence`);
  }
  return {
    approvalAdminId,
    operatorReason,
  };
}

function normalizeString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalInteger(value?: number | null) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 0 || value > 80) {
    throw new BadRequestException('experienceYears must be an integer between 0 and 80');
  }
  return value;
}

function toJsonList(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
    .filter(Boolean)
    .slice(0, 20) as Prisma.InputJsonValue;
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

async function assertTaxRuleDoesNotConflict(
  tx: Prisma.TransactionClient,
  policyVersionId: string,
  data: {
    scope: TaxRuleScope;
    serviceType?: string | null;
    minGrossAmount: number | null;
    maxGrossAmount: number | null;
    active?: boolean;
  },
  currentRuleId?: string,
) {
  if (data.active === false) {
    return;
  }

  const existingRules = await tx.taxRule.findMany({
    where: {
      policyVersionId,
      active: true,
      id: currentRuleId ? { not: currentRuleId } : undefined,
      scope: data.scope,
    },
  });

  if (data.scope === TaxRuleScope.DEFAULT && existingRules.length > 0) {
    throw new BadRequestException('Only one active DEFAULT tax rule is allowed per policy version');
  }

  if (data.scope === TaxRuleScope.SERVICE_TYPE) {
    const duplicate = existingRules.find((rule) => rule.serviceType === data.serviceType);
    if (duplicate) {
      throw new BadRequestException('Only one active SERVICE_TYPE tax rule is allowed for each service type');
    }
  }

  if (data.scope === TaxRuleScope.AMOUNT_BAND) {
    const overlapping = existingRules.find((rule) =>
      amountBandsOverlap(data.minGrossAmount, data.maxGrossAmount, rule.minGrossAmount, rule.maxGrossAmount),
    );
    if (overlapping) {
      throw new BadRequestException('Active AMOUNT_BAND tax rules cannot overlap in the same policy version');
    }
  }
}

function amountBandsOverlap(
  leftMin: number | null,
  leftMax: number | null,
  rightMin: number | null,
  rightMax: number | null,
) {
  const aMin = leftMin ?? Number.NEGATIVE_INFINITY;
  const aMax = leftMax ?? Number.POSITIVE_INFINITY;
  const bMin = rightMin ?? Number.NEGATIVE_INFINITY;
  const bMax = rightMax ?? Number.POSITIVE_INFINITY;
  return aMin <= bMax && bMin <= aMax;
}

function normalizeAdminTaxPolicyVersionTake(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_TAX_POLICY_VERSION_DEFAULT_TAKE;
  }
  return Math.min(Math.floor(parsed), ADMIN_TAX_POLICY_VERSION_MAX_TAKE);
}

function normalizeAdminTaxPolicyVersionSkip(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function providerDocumentNotificationLabel(type: ProviderDocumentType) {
  const labels: Partial<Record<ProviderDocumentType, string>> = {
    [ProviderDocumentType.CCCD_FRONT]: 'ID card front',
    [ProviderDocumentType.CCCD_BACK]: 'ID card back',
    [ProviderDocumentType.SELFIE]: 'Identity selfie',
  };

  return labels[type] ?? type.replaceAll('_', ' ').toLowerCase();
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
