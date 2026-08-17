import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
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
  TaxPolicyLifecycleStatus,
  TaxPolicyApprovalStatus,
  TaxPolicyProvenance,
  TaxPolicyStatus,
  TaxRuleScope,
  VerificationStatus,
} from '@prisma/client';
import { Queue } from 'bullmq';
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
import { calculatePartnerTaxWithholding } from '../earnings/tax-policy-withholding';
import { adminOperatorHasRequiredCategory } from '../admin/admin-operator-category.guard';
import {
  financeApproverPolicySnapshot,
  listFinanceApproverPolicySnapshots,
} from '../admin/finance-approver-policy';
import {
  TAX_POLICY_ACTIVATION_QUEUE_NAME,
  TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME,
  taxPolicyActivationJob,
} from './tax-policy-activation.queue';
import { assertTaxPolicyFixtureWriteEnvironment } from './tax-policy-fixture-write-guard';

const ADMIN_TAX_POLICY_VERSION_DEFAULT_TAKE = 20;
const ADMIN_TAX_POLICY_VERSION_MAX_TAKE = 100;

type AdminTaxPolicyVersionListOptions = {
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly id?: string | null;
  readonly lifecycle?: string | null;
  readonly provenance?: string | null;
  readonly q?: string | null;
  readonly skip?: number | string | null;
  readonly sort?: string | null;
  readonly source?: string | null;
  readonly take?: number | string | null;
  readonly view?: string | null;
};

type TaxPolicyMutationInput = {
  readonly operatorReason: string;
};

type TaxPolicySessionAssurance = {
  readonly mfaVerifiedAt?: Date | null;
  readonly sessionId?: string | null;
};

@Injectable()
export class ProviderOnboardingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional()
    @InjectQueue(TAX_POLICY_ACTIVATION_QUEUE_NAME)
    private readonly taxPolicyActivationQueue?: Queue,
  ) {}

  async onModuleInit() {
    if (!this.taxPolicyActivationQueue) {
      return;
    }
    await this.taxPolicyActivationQueue.add(
      TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME,
      {},
      {
        jobId: TAX_POLICY_ACTIVATION_SWEEP_JOB_NAME,
        repeat: { every: 60_000 },
        removeOnComplete: true,
        removeOnFail: { count: 500 },
      },
    );
  }

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
          status: ProviderBankAccountStatus.PENDING_REVIEW,
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
        status: ProviderTaxProfileStatus.PENDING_REVIEW,
      },
      create: {
        providerProfileId: provider.id,
        taxCodeHash: taxCode ? sha256(taxCode) : undefined,
        taxCodeLast4: taxCode?.slice(-4),
        legalName,
        registeredAddress,
        status: ProviderTaxProfileStatus.PENDING_REVIEW,
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

  async listTaxPolicyVersions(options: AdminTaxPolicyVersionListOptions = {}) {
    const skip = normalizeAdminTaxPolicyVersionSkip(options.skip);
    const take = normalizeAdminTaxPolicyVersionTake(options.take);
    const lifecycleByView: Record<string, TaxPolicyLifecycleStatus[]> = {
      current: [TaxPolicyLifecycleStatus.ACTIVE],
      drafts: [
        TaxPolicyLifecycleStatus.DRAFT,
        TaxPolicyLifecycleStatus.PENDING_APPROVAL,
        TaxPolicyLifecycleStatus.APPROVED,
        TaxPolicyLifecycleStatus.SCHEDULED,
      ],
      history: [
        TaxPolicyLifecycleStatus.SUPERSEDED,
        TaxPolicyLifecycleStatus.ARCHIVED,
        TaxPolicyLifecycleStatus.REJECTED,
        TaxPolicyLifecycleStatus.LEGACY_REVIEW,
      ],
    };
    const lifecycle = options.view ? lifecycleByView[options.view] : undefined;
    const provenance = Object.values(TaxPolicyProvenance).includes(
      options.provenance as TaxPolicyProvenance,
    )
      ? (options.provenance as TaxPolicyProvenance)
      : undefined;
    const source = options.source === 'production' || options.source === 'test-legacy'
      ? options.source
      : undefined;
    const requestedLifecycle = Object.values(TaxPolicyLifecycleStatus).includes(
      options.lifecycle as TaxPolicyLifecycleStatus,
    )
      ? (options.lifecycle as TaxPolicyLifecycleStatus)
      : undefined;
    const query = normalizeString(options.q)?.slice(0, 160);
    const effectiveFrom = options.effectiveFrom
      ? parseDate(options.effectiveFrom, 'effectiveFrom must be a valid date')
      : undefined;
    const effectiveTo = options.effectiveTo
      ? parseDate(options.effectiveTo, 'effectiveTo must be a valid date')
      : undefined;
    const where: Prisma.TaxPolicyVersionWhereInput = {
      ...(options.id ? { id: options.id } : {}),
      ...(requestedLifecycle
        ? { lifecycleStatus: requestedLifecycle }
        : lifecycle
          ? { lifecycleStatus: { in: lifecycle } }
          : {}),
      ...(provenance ? { provenance } : {}),
      ...(!provenance && source === 'production' ? { provenance: TaxPolicyProvenance.OPERATOR } : {}),
      ...(!provenance && source === 'test-legacy' ? { provenance: { not: TaxPolicyProvenance.OPERATOR } } : {}),
      ...(query
        ? {
            OR: [
              { id: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
              { legalSourceTitle: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(effectiveFrom || effectiveTo
        ? { effectiveFrom: { ...(effectiveFrom ? { gte: effectiveFrom } : {}), ...(effectiveTo ? { lte: effectiveTo } : {}) } }
        : {}),
    };
    const args: Prisma.TaxPolicyVersionFindManyArgs = {
      where,
      orderBy: options.sort === 'effective-asc'
        ? [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }]
        : [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        rules: { orderBy: { createdAt: 'asc' } },
        supersedesPolicyVersion: { select: { id: true, name: true, provenance: true } },
      },
      take,
    };
    if (skip > 0) {
      args.skip = skip;
    }
    const [items, total] = await Promise.all([
      this.prisma.taxPolicyVersion.findMany(args),
      this.prisma.taxPolicyVersion.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async taxPolicyCapabilities(
    actorId: string,
    assurance: TaxPolicySessionAssurance = {},
    policyVersionId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pendingRequest = policyVersionId
        ? await tx.taxPolicyApprovalRequest.findFirst({
            where: { policyVersionId, status: TaxPolicyApprovalStatus.PENDING },
            orderBy: { requestedAt: 'desc' },
            select: { requestedByAdminId: true },
          })
        : null;
      return buildTaxPolicyCapabilities(
        tx,
        actorId,
        assurance,
        pendingRequest?.requestedByAdminId ?? null,
      );
    });
  }

  async taxPolicyWorkspaceSummary(actorId: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const [groups, nextScheduled] = await Promise.all([
        tx.taxPolicyVersion.groupBy({
          by: ['lifecycleStatus', 'provenance'],
          _count: { _all: true },
        }),
        tx.taxPolicyVersion.findFirst({
          where: {
            lifecycleStatus: TaxPolicyLifecycleStatus.SCHEDULED,
            effectiveFrom: { gte: now },
          },
          orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
          include: {
            createdBy: { select: { id: true, email: true, fullName: true } },
            rules: { orderBy: { createdAt: 'asc' } },
            supersedesPolicyVersion: { select: { id: true, name: true, provenance: true } },
          },
        }),
      ]);
      const count = (lifecycleStatus: TaxPolicyLifecycleStatus, provenance?: TaxPolicyProvenance) =>
        groups
          .filter((group) => group.lifecycleStatus === lifecycleStatus && (!provenance || group.provenance === provenance))
          .reduce((total, group) => total + group._count._all, 0);
      const historyStatuses: TaxPolicyLifecycleStatus[] = [
          TaxPolicyLifecycleStatus.SUPERSEDED,
          TaxPolicyLifecycleStatus.ARCHIVED,
          TaxPolicyLifecycleStatus.REJECTED,
          TaxPolicyLifecycleStatus.LEGACY_REVIEW,
      ];
      const productionHistory = groups
        .filter((group) => group.provenance === TaxPolicyProvenance.OPERATOR && historyStatuses.includes(group.lifecycleStatus))
        .reduce((total, group) => total + group._count._all, 0);
      const historyTotal = groups
        .filter((group) => historyStatuses.includes(group.lifecycleStatus))
        .reduce((total, group) => total + group._count._all, 0);
      return {
        generatedAt: now.toISOString(),
        drafts: {
          needsAuthor: count(TaxPolicyLifecycleStatus.DRAFT),
          awaitingChecker: count(TaxPolicyLifecycleStatus.PENDING_APPROVAL),
          approved: count(TaxPolicyLifecycleStatus.APPROVED),
          scheduled: count(TaxPolicyLifecycleStatus.SCHEDULED),
        },
        history: {
          production: productionHistory,
          testOrLegacy: Math.max(0, historyTotal - productionHistory),
        },
        nextScheduled,
      };
    });
  }

  async listTaxPolicyAuditLogs(
    actorId: string,
    options: {
      action?: string;
      actorId?: string;
      eventId?: string;
      from?: string;
      policyVersionId?: string;
      skip?: string;
      source?: string;
      take?: string;
      to?: string;
    } = {},
  ) {
    const skip = normalizeAdminTaxPolicyVersionSkip(options.skip);
    const take = normalizeAdminTaxPolicyVersionTake(options.take);
    const domainWhere: Prisma.AdminAuditLogWhereInput = {
      OR: [
        { action: { startsWith: 'tax_policy.' } },
        { action: { startsWith: 'tax_rule.' } },
      ],
    };
    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const source = taxPolicyEvidenceSource(options.source, true) as Exclude<TaxPolicyEvidenceSource, 'all'> | undefined;
      const sourcePolicies = source
        ? (await tx.taxPolicyVersion.findMany({
            where: taxPolicyVersionSourceWhere(source),
            select: { id: true, provenance: true },
          }))
        : [];
      const sourcePolicyIds = sourcePolicies.map((policy) => policy.id);
      const sourceByPolicyId = new Map(sourcePolicies.map((policy) => [policy.id, policy.provenance]));
      const policyFilter = (policyIds: string[]): Prisma.AdminAuditLogWhereInput => ({
        OR: policyIds.flatMap((policyVersionId) => [
          { target: `tax_policy:${policyVersionId}` },
          { metadata: { path: ['policyVersionId'], equals: policyVersionId } },
        ]),
      });
      const filters: Prisma.AdminAuditLogWhereInput[] = [domainWhere];
      if (options.eventId?.trim()) filters.push({ id: options.eventId.trim() });
      if (options.policyVersionId) filters.push(policyFilter([options.policyVersionId]));
      if (source) filters.push(sourcePolicyIds.length ? policyFilter(sourcePolicyIds) : { id: '__no_match__' });
      if (options.action?.trim()) filters.push({ action: options.action.trim() });
      if (options.actorId?.trim()) filters.push({ actorId: options.actorId.trim() });
      if (options.from || options.to) {
        filters.push({
          createdAt: {
            ...(options.from ? { gte: parseDate(options.from, 'Audit from date must be valid') } : {}),
            ...(options.to ? { lte: parseDate(options.to, 'Audit to date must be valid') } : {}),
          },
        });
      }
      const where: Prisma.AdminAuditLogWhereInput = { AND: filters };
      const [items, total] = await Promise.all([
        tx.adminAuditLog.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include: {
            actor: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        }),
        tx.adminAuditLog.count({ where }),
      ]);
      return {
        items: source
          ? items.map((item) => ({
              ...item,
              policyProvenance: sourceByPolicyId.get(taxPolicyAuditPolicyVersionId(item)) ?? null,
            }))
          : items,
        total,
        skip,
        take,
      };
    });
  }

  async simulateTaxPolicyVersion(
    actorId: string,
    policyVersionId: string,
    input: { grossAmount?: string | number; serviceType?: string },
  ) {
    const grossAmount = Number(input.grossAmount);
    if (!Number.isSafeInteger(grossAmount) || grossAmount < 0) {
      throw new BadRequestException({
        code: 'TAX_POLICY_SIMULATION_AMOUNT_INVALID',
        message: 'Simulation gross amount must be a non-negative whole VND amount.',
      });
    }
    const serviceType = requiredString(input.serviceType, 'Simulation service is required');

    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const policy = await tx.taxPolicyVersion.findUnique({
        where: { id: policyVersionId },
        include: { rules: { where: { active: true }, orderBy: { createdAt: 'asc' } } },
      });
      if (!policy) {
        throw new NotFoundException({
          code: 'TAX_POLICY_NOT_FOUND',
          message: 'Tax policy version not found',
        });
      }
      const calculation = calculatePartnerTaxWithholding(policy.rules, {
        grossAmount,
        serviceTypes: [serviceType],
      });
      const lines = [calculation.vat, calculation.pit, calculation.combined]
        .filter((line): line is NonNullable<typeof line> => Boolean(line?.rule))
        .map((line) => ({
          amount: line.amount,
          fixedAmount: line.fixedAmount,
          rateBps: line.rateBps,
          ruleId: line.rule!.id,
          scope: line.rule!.scope,
          taxKind: line.rule!.taxKind,
        }));
      return {
        amount: calculation.amount,
        currency: 'VND',
        grossAmount,
        lines,
        policyName: policy.name,
        policyVersionId: policy.id,
        serviceType,
      };
    });
  }

  async taxPolicyIntegritySummary(actorId: string, now = new Date()) {
    const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const rows = await tx.$queryRaw<Array<{
        total: bigint;
        healthy: bigint;
        amountMismatch: bigint;
        missingTaxLog: bigint;
        missingSnapshot: bigint;
        noActivePolicy: bigint;
        noApprovedTaxProfile: bigint;
        noMatchingRule: bigint;
        oldestAmountMismatch: Date | null;
        oldestMissingTaxLog: Date | null;
        oldestMissingSnapshot: Date | null;
        oldestNoActivePolicy: Date | null;
        oldestNoApprovedTaxProfile: Date | null;
        oldestNoMatchingRule: Date | null;
      }>>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS "total",
          COUNT(*) FILTER (
            WHERE evidence."logCount" > 0
              AND evidence."snapshotCount" = evidence."logCount"
              AND evidence."withholdingTotal" = earning."withholdingAmount"
          )::bigint AS "healthy",
          COUNT(*) FILTER (
            WHERE evidence."logCount" > 0
              AND evidence."withholdingTotal" <> earning."withholdingAmount"
          )::bigint AS "amountMismatch",
          COUNT(*) FILTER (WHERE evidence."logCount" = 0)::bigint AS "missingTaxLog",
          COUNT(*) FILTER (
            WHERE evidence."logCount" > 0 AND evidence."snapshotCount" < evidence."logCount"
          )::bigint AS "missingSnapshot",
          COUNT(*) FILTER (WHERE evidence."noActivePolicy")::bigint AS "noActivePolicy",
          COUNT(*) FILTER (WHERE evidence."noApprovedTaxProfile")::bigint AS "noApprovedTaxProfile",
          COUNT(*) FILTER (WHERE evidence."noMatchingRule")::bigint AS "noMatchingRule",
          MIN(earning."createdAt") FILTER (
            WHERE evidence."logCount" > 0 AND evidence."withholdingTotal" <> earning."withholdingAmount"
          ) AS "oldestAmountMismatch",
          MIN(earning."createdAt") FILTER (WHERE evidence."logCount" = 0) AS "oldestMissingTaxLog",
          MIN(earning."createdAt") FILTER (
            WHERE evidence."logCount" > 0 AND evidence."snapshotCount" < evidence."logCount"
          ) AS "oldestMissingSnapshot",
          MIN(earning."createdAt") FILTER (WHERE evidence."noActivePolicy") AS "oldestNoActivePolicy",
          MIN(earning."createdAt") FILTER (WHERE evidence."noApprovedTaxProfile") AS "oldestNoApprovedTaxProfile",
          MIN(earning."createdAt") FILTER (WHERE evidence."noMatchingRule") AS "oldestNoMatchingRule"
        FROM "ProviderEarning" earning
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS "logCount",
            COUNT(log."ruleSnapshot")::int AS "snapshotCount",
            COALESCE(SUM(log."withholdingAmount"), 0)::bigint AS "withholdingTotal",
            COALESCE(BOOL_OR(log."ruleSnapshot"->>'reason' = 'NO_ACTIVE_POLICY'), false) AS "noActivePolicy",
            COALESCE(BOOL_OR(log."ruleSnapshot"->>'reason' = 'NO_APPROVED_TAX_PROFILE'), false) AS "noApprovedTaxProfile",
            COALESCE(BOOL_OR(
              log."ruleSnapshot"->>'reason' = 'NO_MATCHING_RULE'
              OR jsonb_path_exists(COALESCE(log."ruleSnapshot", '{}'::jsonb), '$.lines[*] ? (@.scope == "NONE")')
            ), false) AS "noMatchingRule"
          FROM "ProviderTaxLog" log
          WHERE log."earningId" = earning."id"
        ) evidence ON true
        WHERE earning."createdAt" >= ${rangeStart}
      `);
      const row = rows[0];
      return {
        generatedAt: now.toISOString(),
        range: '30d',
        rangeStart: rangeStart.toISOString(),
        total: Number(row?.total ?? 0),
        recordIntegrity: {
          healthy: Number(row?.healthy ?? 0),
          amountMismatch: Number(row?.amountMismatch ?? 0),
          missingTaxLog: Number(row?.missingTaxLog ?? 0),
          missingSnapshot: Number(row?.missingSnapshot ?? 0),
          oldestAmountMismatch: row?.oldestAmountMismatch?.toISOString() ?? null,
          oldestMissingTaxLog: row?.oldestMissingTaxLog?.toISOString() ?? null,
          oldestMissingSnapshot: row?.oldestMissingSnapshot?.toISOString() ?? null,
        },
        taxApplicability: {
          noActivePolicy: Number(row?.noActivePolicy ?? 0),
          noApprovedTaxProfile: Number(row?.noApprovedTaxProfile ?? 0),
          noMatchingRule: Number(row?.noMatchingRule ?? 0),
          oldestNoActivePolicy: row?.oldestNoActivePolicy?.toISOString() ?? null,
          oldestNoApprovedTaxProfile: row?.oldestNoApprovedTaxProfile?.toISOString() ?? null,
          oldestNoMatchingRule: row?.oldestNoMatchingRule?.toISOString() ?? null,
        },
      };
    });
  }

  async taxPolicyIntegrityRecords(
    actorId: string,
    options: {
      from?: string;
      issue?: string;
      skip?: string;
      sort?: string;
      source?: string;
      take?: string;
      to?: string;
    } = {},
    now = new Date(),
  ) {
    const issue = taxPolicyIntegrityIssue(options.issue);
    const skip = normalizeAdminTaxPolicyVersionSkip(options.skip);
    const take = normalizeAdminTaxPolicyVersionTake(options.take);
    const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const source = taxPolicyEvidenceSource(options.source) ?? 'all';
    const sort = options.sort === 'newest' ? 'newest' : 'oldest';
    const requestedFrom = options.from
      ? parseVietnamDateBoundary(options.from, 'Integrity from date must be valid')
      : rangeStart;
    const from = requestedFrom > rangeStart ? requestedFrom : rangeStart;
    const to = options.to
      ? parseVietnamDateBoundary(options.to, 'Integrity to date must be valid', true)
      : null;
    if (to && to <= from) {
      throw new BadRequestException({
        code: 'TAX_POLICY_INTEGRITY_DATE_RANGE_INVALID',
        message: 'Integrity to date must be after the from date.',
      });
    }
    const predicate = Prisma.sql`
      ${taxPolicyIntegrityIssuePredicate(issue)}
      AND ${taxPolicyIntegritySourcePredicate(source)}
      ${to ? Prisma.sql`AND earning."createdAt" < ${to}` : Prisma.empty}
    `;
    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const [countRows, rows] = await Promise.all([
        tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS "total"
          ${taxPolicyIntegrityEvidenceSource(from, predicate)}
        `),
        tx.$queryRaw<Array<{
          bookingId: string;
          createdAt: Date;
          grossAmount: number;
          id: string;
          policyProvenance: TaxPolicyProvenance | null;
          policyVersionId: string | null;
          providerDisplayName: string;
          providerProfileId: string;
          taxLogWithholdingAmount: bigint;
          withholdingAmount: number;
        }>>(Prisma.sql`
          SELECT
            earning."id",
            earning."bookingId",
            earning."providerProfileId",
            provider."displayName" AS "providerDisplayName",
            earning."createdAt",
            earning."grossAmount",
            earning."withholdingAmount",
            evidence."withholdingTotal" AS "taxLogWithholdingAmount",
            evidence."policyVersionId",
            evidence."policyProvenance"
          ${taxPolicyIntegrityEvidenceSource(from, predicate)}
          ORDER BY earning."createdAt" ${sort === 'newest' ? Prisma.raw('DESC') : Prisma.raw('ASC')}, earning."id" ${sort === 'newest' ? Prisma.raw('DESC') : Prisma.raw('ASC')}
          OFFSET ${skip}
          LIMIT ${take}
        `),
      ]);
      return {
        generatedAt: now.toISOString(),
        issue,
        items: rows.map((row) => {
          const evidenceSource = taxPolicyIntegrityRowSource(row.policyProvenance);
          return {
            ...row,
            classification: taxPolicyIntegrityClassification(issue, evidenceSource),
            createdAt: row.createdAt.toISOString(),
            evidenceSource,
            taxLogWithholdingAmount: Number(row.taxLogWithholdingAmount),
          };
        }),
        skip,
        sort,
        source,
        take,
        total: Number(countRows[0]?.total ?? 0),
      };
    });
  }

  async createTaxPolicyVersion(
    actorId: string,
    input: TaxPolicyMutationInput & {
      name: string;
      status?: TaxPolicyStatus;
      effectiveFrom: string;
      effectiveTo?: string | null;
      notes?: string;
      legalSourceTitle: string;
      legalSourceUrl: string;
      promulgatedDate: string;
      taxSubject: string;
      changeSummary: string;
      supersedesPolicyVersionId?: string;
      defaultRateBps?: number;
    },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    const status = input.status ?? TaxPolicyStatus.DRAFT;
    assertDraftTaxPolicyStatus(status);
    const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom is required');
    const effectiveTo = parseOptionalDate(input.effectiveTo, 'effectiveTo must be a valid date');
    assertTaxPolicyEffectiveWindow(effectiveFrom, effectiveTo);
    const legalSourceTitle = requiredString(input.legalSourceTitle, 'Legal source title is required');
    const legalSourceUrl = requiredHttpsUrl(input.legalSourceUrl, 'Legal source URL must use HTTPS');
    const promulgatedDate = parseDate(input.promulgatedDate, 'Promulgated date is required');
    const taxSubject = requiredString(input.taxSubject, 'Tax subject is required');
    const changeSummary = requiredTaxPolicyEvidence(input.changeSummary, 'Tax policy change summary');

    const policy = await this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'draft', assurance);
      const provenance = await requireTaxPolicyDraftProvenance(tx, actorId);
      const supersededPolicy = input.supersedesPolicyVersionId
        ? await tx.taxPolicyVersion.findUnique({
            where: { id: input.supersedesPolicyVersionId },
            select: { id: true, revision: true },
          })
        : null;
      if (input.supersedesPolicyVersionId && !supersededPolicy) {
        throw new NotFoundException('Superseded tax policy version not found');
      }
      const policy = await tx.taxPolicyVersion.create({
        data: {
          name: requiredString(input.name, 'Policy name is required'),
          status,
          lifecycleStatus: TaxPolicyLifecycleStatus.DRAFT,
          provenance,
          jurisdiction: 'VN',
          timezone: 'Asia/Ho_Chi_Minh',
          effectiveFrom,
          effectiveTo,
          notes: normalizeString(input.notes),
          legalSourceTitle,
          legalSourceUrl,
          promulgatedDate,
          taxSubject,
          changeSummary,
          supersedesPolicyVersionId: supersededPolicy?.id,
          revision: (supersededPolicy?.revision ?? 0) + 1,
          createdById: actorId,
        },
        include: { rules: true },
      });
      let createdDefaultRule = null;
      if (input.defaultRateBps !== undefined) {
        const defaultRule = normalizeTaxRuleInput(
          {
            scope: TaxRuleScope.DEFAULT,
            rateBps: input.defaultRateBps,
            fixedAmount: 0,
            active: true,
          },
          true,
        );
        createdDefaultRule = await tx.taxRule.create({
          data: {
            policyVersionId: policy.id,
            ...defaultRule,
          },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'tax_policy.draft_created',
          target: `tax_policy:${policy.id}`,
          metadata: toJson({
            operatorReason: requiredTaxPolicyEvidence(input.operatorReason, 'Tax policy draft create'),
            status: policy.status,
          }),
        },
      });
      return createdDefaultRule
        ? { ...policy, rules: [...policy.rules, createdDefaultRule] }
        : policy;
    });
    return policy;
  }

  async updateTaxPolicyVersion(
    actorId: string,
    id: string,
    input: TaxPolicyMutationInput & {
      name?: string;
      status?: TaxPolicyStatus;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      notes?: string | null;
      legalSourceTitle?: string;
      legalSourceUrl?: string;
      promulgatedDate?: string;
      taxSubject?: string;
      changeSummary?: string;
      supersedesPolicyVersionId?: string | null;
    },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    if (input.status !== undefined) {
      assertDraftTaxPolicyStatus(input.status);
    }
    const effectiveFrom = input.effectiveFrom
      ? parseDate(input.effectiveFrom, 'effectiveFrom must be a valid date')
      : undefined;
    const effectiveTo =
      input.effectiveTo === undefined
        ? undefined
        : parseOptionalDate(input.effectiveTo, 'effectiveTo must be a valid date');
    const promulgatedDate = input.promulgatedDate
      ? parseDate(input.promulgatedDate, 'Promulgated date must be valid')
      : undefined;
    if (effectiveFrom && effectiveTo) {
      assertTaxPolicyEffectiveWindow(effectiveFrom, effectiveTo);
    }

    const policy = await this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'draft', assurance);
      const existing = await requireEditableTaxPolicy(tx, id);
      const nextEffectiveFrom = effectiveFrom ?? existing.effectiveFrom;
      const nextEffectiveTo = effectiveTo === undefined ? existing.effectiveTo : effectiveTo;
      assertTaxPolicyEffectiveWindow(nextEffectiveFrom, nextEffectiveTo);
      const policy = await tx.taxPolicyVersion.update({
        where: { id },
        data: {
          name: normalizeString(input.name),
          effectiveFrom,
          effectiveTo,
          notes: input.notes === undefined ? undefined : normalizeString(input.notes),
          legalSourceTitle: input.legalSourceTitle === undefined
            ? undefined
            : requiredString(input.legalSourceTitle, 'Legal source title is required'),
          legalSourceUrl: input.legalSourceUrl === undefined
            ? undefined
            : requiredHttpsUrl(input.legalSourceUrl, 'Legal source URL must use HTTPS'),
          promulgatedDate,
          taxSubject: input.taxSubject === undefined
            ? undefined
            : requiredString(input.taxSubject, 'Tax subject is required'),
          changeSummary: input.changeSummary === undefined
            ? undefined
            : requiredTaxPolicyEvidence(input.changeSummary, 'Tax policy change summary'),
          supersedesPolicyVersionId: input.supersedesPolicyVersionId,
          payloadHash: null,
        },
        include: { rules: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'tax_policy.draft_updated',
          target: `tax_policy:${policy.id}`,
          metadata: toJson({
            operatorReason: requiredTaxPolicyEvidence(input.operatorReason, 'Tax policy draft update'),
            status: policy.status,
          }),
        },
      });
      return policy;
    });
    return policy;
  }

  async createTaxRule(
    actorId: string,
    policyVersionId: string,
    input: TaxPolicyMutationInput & {
      scope?: TaxRuleScope;
      serviceType?: string;
      minGrossAmount?: number;
      maxGrossAmount?: number;
      rateBps?: number;
      fixedAmount?: number;
      active?: boolean;
    },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    const data = normalizeTaxRuleInput(input, true);
    const rule = await this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'draft', assurance);
      await requireEditableTaxPolicy(tx, policyVersionId);
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
      await tx.taxPolicyVersion.update({
        where: { id: policyVersionId },
        data: { payloadHash: null },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'tax_rule.draft_created',
          target: `tax_rule:${createdRule.id}`,
          metadata: toJson({
            operatorReason: requiredTaxPolicyEvidence(input.operatorReason, 'Tax rule draft create'),
            policyVersionId,
            scope: createdRule.scope,
            rateBps: createdRule.rateBps,
          }),
        },
      });
      return createdRule;
    });
    return rule;
  }

  async updateTaxRule(
    actorId: string,
    id: string,
    input: TaxPolicyMutationInput & {
      scope?: TaxRuleScope;
      serviceType?: string | null;
      minGrossAmount?: number | null;
      maxGrossAmount?: number | null;
      rateBps?: number;
      fixedAmount?: number;
      active?: boolean;
    },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    const rule = await this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'draft', assurance);
      const existing = await tx.taxRule.findUnique({
        where: { id },
        include: {
          policyVersion: {
            include: {
              _count: { select: { taxLogs: true, bookingSettlementSnapshots: true } },
            },
          },
        },
      });
      if (!existing) {
        throw new NotFoundException('Tax rule not found');
      }
      assertEditableTaxPolicy(existing.policyVersion);
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
      await assertTaxRuleDoesNotConflict(tx, existing.policyVersionId, data, existing.id);
      const updatedRule = await tx.taxRule.update({
        where: { id },
        data,
      });
      await tx.taxPolicyVersion.update({
        where: { id: existing.policyVersionId },
        data: { payloadHash: null },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'tax_rule.draft_updated',
          target: `tax_rule:${updatedRule.id}`,
          metadata: toJson({
            operatorReason: requiredTaxPolicyEvidence(input.operatorReason, 'Tax rule draft update'),
            policyVersionId: updatedRule.policyVersionId,
            scope: updatedRule.scope,
            rateBps: updatedRule.rateBps,
            active: updatedRule.active,
          }),
        },
      });
      return updatedRule;
    });
    return rule;
  }

  async submitTaxPolicyApprovalRequest(
    actorId: string,
    policyVersionId: string,
    input: { cleanSourceAcknowledged?: boolean; operatorReason: string; idempotencyKey: string },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    const operatorReason = requiredTaxPolicyEvidence(
      input.operatorReason,
      'Tax policy approval request',
    );
    const idempotencyKey = requiredString(input.idempotencyKey, 'Idempotency key is required');

    return this.prisma.$transaction(
      async (tx) => {
        await requireTaxPolicyOperatorAccess(tx, actorId, 'request', assurance);
        const policy = await tx.taxPolicyVersion.findUnique({
          where: { id: policyVersionId },
          include: {
            rules: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            _count: { select: { taxLogs: true, bookingSettlementSnapshots: true } },
            supersedesPolicyVersion: { select: { id: true, provenance: true } },
          },
        });
        if (!policy) {
          throw new NotFoundException({
            code: 'TAX_POLICY_NOT_FOUND',
            message: 'Tax policy version not found',
          });
        }
        assertEditableTaxPolicy(policy);
        assertTaxPolicyReadyForApproval(policy);
        if (
          policy.supersedesPolicyVersion &&
          policy.supersedesPolicyVersion.provenance !== TaxPolicyProvenance.OPERATOR &&
          input.cleanSourceAcknowledged !== true
        ) {
          throw new BadRequestException({
            code: 'TAX_POLICY_CLEAN_SOURCE_ACKNOWLEDGEMENT_REQUIRED',
            message: 'Confirm that non-production source values were independently reviewed before submission.',
          });
        }
        const payloadHash = taxPolicyPayloadHash(policy);

        const replay = await tx.taxPolicyApprovalRequest.findUnique({
          where: { idempotencyKey },
          include: { policyVersion: true, requestedByAdmin: true, decidedByAdmin: true },
        });
        if (replay) {
          if (
            replay.policyVersionId === policyVersionId &&
            replay.requestedByAdminId === actorId &&
            replay.payloadHash === payloadHash
          ) {
            return taxPolicyApprovalReceipt(replay, true);
          }
          throw new ConflictException({
            code: 'TAX_POLICY_IDEMPOTENCY_KEY_REUSED',
            message: 'This idempotency key belongs to a different tax policy approval request.',
          });
        }

        const pendingKey = `tax-policy:${policyVersionId}`;
        const pending = await tx.taxPolicyApprovalRequest.findUnique({ where: { pendingKey } });
        if (pending) {
          throw new ConflictException({
            code: 'TAX_POLICY_APPROVAL_ALREADY_PENDING',
            message: 'This tax policy already has a pending approval request.',
          });
        }

        const request = await tx.taxPolicyApprovalRequest.create({
          data: {
            policyVersionId,
            requestedByAdminId: actorId,
            operatorReason,
            payloadHash,
            idempotencyKey,
            pendingKey,
          },
          include: { policyVersion: true, requestedByAdmin: true, decidedByAdmin: true },
        });
        await tx.taxPolicyVersion.update({
          where: { id: policyVersionId },
          data: {
            lifecycleStatus: TaxPolicyLifecycleStatus.PENDING_APPROVAL,
            payloadHash,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'tax_policy.approval_requested',
            target: `tax_policy_approval:${request.id}`,
            metadata: toJson({
              cleanSourceAcknowledged: input.cleanSourceAcknowledged === true,
              policyVersionId,
              payloadHash,
              operatorReason,
              sourcePolicyId: policy.supersedesPolicyVersion?.id ?? null,
              sourceProvenance: policy.supersedesPolicyVersion?.provenance ?? null,
            }),
          },
        });
        return taxPolicyApprovalReceipt(request, false);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listTaxPolicyApprovalRequests(
    actorId: string,
    options: { policyVersionId?: string; skip?: string; take?: string } = {},
  ) {
    const skip = normalizeAdminTaxPolicyVersionSkip(options.skip);
    const take = normalizeAdminTaxPolicyVersionTake(options.take);
    return this.prisma.$transaction(async (tx) => {
      await requireTaxPolicyOperatorAccess(tx, actorId, 'read');
      const where: Prisma.TaxPolicyApprovalRequestWhereInput = options.policyVersionId
        ? { policyVersionId: options.policyVersionId }
        : {};
      const [items, total] = await Promise.all([
        tx.taxPolicyApprovalRequest.findMany({
          where,
          orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include: { policyVersion: true, requestedByAdmin: true, decidedByAdmin: true },
        }),
        tx.taxPolicyApprovalRequest.count({ where }),
      ]);
      return {
        items: items.map((request) => taxPolicyApprovalReceipt(request, false)),
        total,
        skip,
        take,
      };
    });
  }

  async decideTaxPolicyApprovalRequest(
    actorId: string,
    requestId: string,
    input: { decision: 'APPROVE' | 'REJECT'; decisionReason: string },
    assurance: TaxPolicySessionAssurance = {},
  ) {
    const decisionReason = requiredTaxPolicyEvidence(
      input.decisionReason,
      'Tax policy approval decision',
    );
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.taxPolicyApprovalRequest.findUnique({
          where: { id: requestId },
          include: {
            requestedByAdmin: true,
            decidedByAdmin: true,
            policyVersion: {
              include: { rules: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
            },
          },
        });
        if (!request) {
          throw new NotFoundException({
            code: 'TAX_POLICY_APPROVAL_NOT_FOUND',
            message: 'Tax policy approval request not found',
          });
        }
        await requireTaxPolicyOperatorAccess(
          tx,
          actorId,
          'decision',
          assurance,
          request.requestedByAdminId,
        );
        if (request.requestedByAdminId === actorId) {
          throw new ForbiddenException({
            code: 'TAX_POLICY_MAKER_CANNOT_APPROVE',
            message: 'The operator who submitted this tax policy cannot decide its approval.',
          });
        }
        if (request.status !== TaxPolicyApprovalStatus.PENDING) {
          const replayed =
            (input.decision === 'APPROVE' &&
              (request.status === TaxPolicyApprovalStatus.APPROVED ||
                request.status === TaxPolicyApprovalStatus.ACTIVATED)) ||
            (input.decision === 'REJECT' && request.status === TaxPolicyApprovalStatus.REJECTED);
          if (replayed) {
            return {
              receipt: taxPolicyApprovalReceipt(request, true),
              activation: input.decision === 'APPROVE'
                ? {
                    policyVersionId: request.policyVersionId,
                    approvalRequestId: request.id,
                    effectiveFrom: request.policyVersion.effectiveFrom,
                  }
                : null,
            };
          }
          throw new ConflictException({
            code: 'TAX_POLICY_APPROVAL_ALREADY_DECIDED',
            message: 'This tax policy approval request already has a different final decision.',
          });
        }
        if (request.policyVersion.lifecycleStatus !== TaxPolicyLifecycleStatus.PENDING_APPROVAL) {
          throw new ConflictException({
            code: 'TAX_POLICY_APPROVAL_STATE_CHANGED',
            message: 'The tax policy lifecycle changed after this approval request was submitted.',
          });
        }
        const currentHash = taxPolicyPayloadHash(request.policyVersion);
        if (
          currentHash !== request.payloadHash ||
          request.policyVersion.payloadHash !== request.payloadHash
        ) {
          throw new ConflictException({
            code: 'TAX_POLICY_PAYLOAD_CHANGED',
            message: 'The tax policy payload changed after submission. Create a new draft request.',
          });
        }

        if (input.decision === 'REJECT') {
          const rejected = await tx.taxPolicyApprovalRequest.update({
            where: { id: request.id },
            data: {
              status: TaxPolicyApprovalStatus.REJECTED,
              decidedByAdminId: actorId,
              decisionReason,
              decidedAt: now,
              pendingKey: null,
            },
            include: { policyVersion: true, requestedByAdmin: true, decidedByAdmin: true },
          });
          await tx.taxPolicyVersion.update({
            where: { id: request.policyVersionId },
            data: { lifecycleStatus: TaxPolicyLifecycleStatus.REJECTED },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId,
              action: 'tax_policy.approval_rejected',
              target: `tax_policy_approval:${request.id}`,
              metadata: toJson({
                policyVersionId: request.policyVersionId,
                makerId: request.requestedByAdminId,
                checkerId: actorId,
                decisionReason,
                payloadHash: request.payloadHash,
              }),
            },
          });
          return { receipt: taxPolicyApprovalReceipt(rejected, false), activation: null };
        }

        const scheduled = request.policyVersion.effectiveFrom.getTime() > now.getTime();
        const activationJobId = `activate-tax-policy-${request.id}`;
        const approved = await tx.taxPolicyApprovalRequest.update({
          where: { id: request.id },
          data: {
            status: TaxPolicyApprovalStatus.APPROVED,
            decidedByAdminId: actorId,
            decisionReason,
            decidedAt: now,
            scheduledFor: request.policyVersion.effectiveFrom,
            activationJobId,
            pendingKey: null,
          },
          include: { policyVersion: true, requestedByAdmin: true, decidedByAdmin: true },
        });
        await tx.taxPolicyVersion.update({
          where: { id: request.policyVersionId },
          data: {
            lifecycleStatus: scheduled
              ? TaxPolicyLifecycleStatus.SCHEDULED
              : TaxPolicyLifecycleStatus.APPROVED,
            approvedByAdminId: actorId,
            approvedAt: now,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: scheduled ? 'tax_policy.approval_scheduled' : 'tax_policy.approval_approved',
            target: `tax_policy_approval:${request.id}`,
            metadata: toJson({
              policyVersionId: request.policyVersionId,
              makerId: request.requestedByAdminId,
              checkerId: actorId,
              decisionReason,
              payloadHash: request.payloadHash,
              scheduledFor: request.policyVersion.effectiveFrom.toISOString(),
            }),
          },
        });
        return {
          receipt: taxPolicyApprovalReceipt(approved, false),
          activation: {
            policyVersionId: request.policyVersionId,
            approvalRequestId: request.id,
            effectiveFrom: request.policyVersion.effectiveFrom,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.activation && this.taxPolicyActivationQueue) {
      const job = taxPolicyActivationJob(
        result.activation.policyVersionId,
        result.activation.approvalRequestId,
        result.activation.effectiveFrom,
      );
      await this.taxPolicyActivationQueue.add(job.name, job.data, job.options);
    }
    return result.receipt;
  }

  async activateDueTaxPolicies(now = new Date()) {
    const due = await this.prisma.taxPolicyApprovalRequest.findMany({
      where: {
        status: TaxPolicyApprovalStatus.APPROVED,
        scheduledFor: { lte: now },
        policyVersion: {
          lifecycleStatus: {
            in: [TaxPolicyLifecycleStatus.APPROVED, TaxPolicyLifecycleStatus.SCHEDULED],
          },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { requestedAt: 'asc' }],
      take: 25,
      select: { id: true, policyVersionId: true },
    });
    const results = [];
    for (const request of due) {
      results.push(await this.activateTaxPolicyVersion(request.policyVersionId, request.id, now));
    }
    return { checked: due.length, results };
  }

  async activateTaxPolicyVersion(
    policyVersionId: string,
    approvalRequestId?: string,
    now = new Date(),
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('hands-tax-policy-activation'))`;
        const policy = await tx.taxPolicyVersion.findUnique({
          where: { id: policyVersionId },
          include: { rules: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
        if (!policy) {
          return { skipped: true, reason: 'policy-not-found', policyVersionId };
        }
        const request = approvalRequestId
          ? await tx.taxPolicyApprovalRequest.findUnique({ where: { id: approvalRequestId } })
          : await tx.taxPolicyApprovalRequest.findFirst({
              where: { policyVersionId, status: TaxPolicyApprovalStatus.APPROVED },
              orderBy: { requestedAt: 'desc' },
            });
        if (!request || request.policyVersionId !== policyVersionId) {
          return { skipped: true, reason: 'approval-not-found', policyVersionId };
        }
        if (
          policy.status === TaxPolicyStatus.ACTIVE &&
          policy.lifecycleStatus === TaxPolicyLifecycleStatus.ACTIVE
        ) {
          return { activated: true, replayed: true, policyVersionId };
        }
        if (request.status !== TaxPolicyApprovalStatus.APPROVED) {
          return { skipped: true, reason: 'approval-not-ready', policyVersionId };
        }
        if (
          policy.lifecycleStatus !== TaxPolicyLifecycleStatus.APPROVED &&
          policy.lifecycleStatus !== TaxPolicyLifecycleStatus.SCHEDULED
        ) {
          return { skipped: true, reason: 'policy-not-approved', policyVersionId };
        }
        if (policy.effectiveFrom.getTime() > now.getTime()) {
          return { skipped: true, reason: 'not-due', policyVersionId };
        }
        if (taxPolicyPayloadHash(policy) !== request.payloadHash) {
          await tx.taxPolicyApprovalRequest.update({
            where: { id: request.id },
            data: {
              status: TaxPolicyApprovalStatus.FAILED,
              failureCode: 'TAX_POLICY_PAYLOAD_CHANGED',
            },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId: request.decidedByAdminId ?? request.requestedByAdminId,
              action: 'tax_policy.activation_blocked',
              target: `tax_policy_approval:${request.id}`,
              metadata: toJson({ policyVersionId, failureCode: 'TAX_POLICY_PAYLOAD_CHANGED' }),
            },
          });
          return { skipped: true, reason: 'payload-changed', policyVersionId };
        }

        const activePolicies = await tx.taxPolicyVersion.findMany({
          where: { status: TaxPolicyStatus.ACTIVE, id: { not: policyVersionId } },
          select: { id: true },
        });
        const previousActiveId = activePolicies[0]?.id ?? null;
        if (!request.decidedByAdminId) {
          return { skipped: true, reason: 'checker-missing', policyVersionId };
        }
        if (activePolicies.length > 0) {
          await tx.taxPolicyVersion.updateMany({
            where: { id: { in: activePolicies.map((active) => active.id) } },
            data: {
              status: TaxPolicyStatus.INACTIVE,
              lifecycleStatus: TaxPolicyLifecycleStatus.SUPERSEDED,
              effectiveTo: now,
              supersededAt: now,
            },
          });
        }
        await tx.taxPolicyVersion.update({
          where: { id: policyVersionId },
          data: {
            status: TaxPolicyStatus.ACTIVE,
            lifecycleStatus: TaxPolicyLifecycleStatus.ACTIVE,
            activatedAt: now,
            supersedesPolicyVersionId: policy.supersedesPolicyVersionId ?? previousActiveId,
          },
        });
        await tx.taxPolicyApprovalRequest.update({
          where: { id: request.id },
          data: {
            status: TaxPolicyApprovalStatus.ACTIVATED,
            activatedAt: now,
            failureCode: null,
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: request.decidedByAdminId,
            action: 'tax_policy.activated',
            target: `tax_policy:${policyVersionId}`,
            metadata: toJson({
              approvalRequestId: request.id,
              makerId: request.requestedByAdminId,
              checkerId: request.decidedByAdminId,
              previousActiveId,
              payloadHash: request.payloadHash,
              activatedAt: now.toISOString(),
            }),
          },
        });
        return { activated: true, replayed: false, policyVersionId, previousActiveId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

function assertDraftTaxPolicyStatus(status: TaxPolicyStatus) {
  if (status !== TaxPolicyStatus.DRAFT) {
    throw new ConflictException({
      code: 'TAX_POLICY_DIRECT_ACTIVATION_FORBIDDEN',
      message: 'Tax policies can only be created or edited as drafts. Submit the draft for approval instead.',
    });
  }
}

async function requireEditableTaxPolicy(tx: Prisma.TransactionClient, id: string) {
  const policy = await tx.taxPolicyVersion.findUnique({
    where: { id },
    include: {
      _count: { select: { taxLogs: true, bookingSettlementSnapshots: true } },
    },
  });
  if (!policy) {
    throw new NotFoundException('Tax policy version not found');
  }
  assertEditableTaxPolicy(policy);
  return policy;
}

function assertEditableTaxPolicy(policy: {
  readonly status: TaxPolicyStatus;
  readonly lifecycleStatus: TaxPolicyLifecycleStatus;
  readonly _count: {
    readonly taxLogs: number;
    readonly bookingSettlementSnapshots: number;
  };
}) {
  if (
    policy.status !== TaxPolicyStatus.DRAFT ||
    policy.lifecycleStatus !== TaxPolicyLifecycleStatus.DRAFT
  ) {
    throw new ConflictException({
      code: 'TAX_POLICY_IMMUTABLE',
      message: 'Only unreferenced draft tax policies can be edited.',
    });
  }
  if (policy._count.taxLogs > 0 || policy._count.bookingSettlementSnapshots > 0) {
    throw new ConflictException({
      code: 'TAX_POLICY_REFERENCED',
      message: 'This tax policy is referenced by financial records and is immutable.',
    });
  }
}

function requiredHttpsUrl(value: string | undefined, message: string) {
  const url = requiredString(value, message);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('not https');
    }
    return parsed.toString();
  } catch {
    throw new BadRequestException(message);
  }
}

function requiredTaxPolicyEvidence(value: string | undefined, actionLabel: string) {
  const evidence = requiredString(value, `${actionLabel} requires operator evidence`);
  if (evidence.length < 10) {
    throw new BadRequestException(`${actionLabel} requires at least 10 characters of operator evidence`);
  }
  return evidence;
}

async function requireTaxPolicyOperatorAccess(
  tx: Prisma.TransactionClient,
  actorId: string,
  purpose: 'decision' | 'draft' | 'read' | 'request',
  assurance: TaxPolicySessionAssurance = {},
  makerId?: string | null,
) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      roles: true,
      adminUserProvenance: true,
      adminOperatorPermission: { select: { categories: true } },
    },
  });
  const categories = actor?.adminOperatorPermission?.categories ?? [];
  if (
    !actor ||
    !actor.roles.includes(Role.ADMIN) ||
    !adminOperatorHasRequiredCategory(
      categories,
      AdminOperatorPermissionCategory.FINANCE_TAX,
    )
  ) {
    throw new ForbiddenException({
      code: 'TAX_POLICY_FINANCE_ACCESS_REQUIRED',
      message: 'A verified Finance Tax operator session is required for tax policy changes.',
    });
  }
  if (purpose === 'read') return actor;
  if (actor.adminUserProvenance === AdminUserProvenance.FIXTURE && purpose === 'draft') {
    assertTaxPolicyFixtureWriteEnvironment(
      process.env.DATABASE_URL,
      process.env.TAX_POLICY_FIXTURE_WRITE_ALLOWLIST,
    );
    return actor;
  }
  const snapshot = await financeApproverPolicySnapshot(tx, actorId, {
    makerId: purpose === 'decision' ? makerId : undefined,
    requiredCategory: AdminOperatorPermissionCategory.FINANCE_TAX,
    requireAttestation: purpose === 'decision',
    requireFinanceRole: purpose === 'decision',
    requireRecentReauthentication: purpose === 'request' || purpose === 'decision',
    requireSessionMfa: purpose === 'request' || purpose === 'decision',
    sessionId: assurance.sessionId,
    sessionMfaVerifiedAt: assurance.mfaVerifiedAt,
  });
  if (!snapshot.ready) {
    const blocker = snapshot.blockers[0];
    throw new ForbiddenException({
      blockers: snapshot.blockers,
      code: blocker?.code ?? 'TAX_POLICY_VERIFIED_OPERATOR_REQUIRED',
      message: blocker?.message ?? 'A verified production operator session is required for tax policy changes.',
    });
  }
  if (purpose === 'request') {
    const checkers = await listFinanceApproverPolicySnapshots(tx, {
      excludeIds: [actorId],
      requiredCategory: AdminOperatorPermissionCategory.FINANCE_TAX,
      requireAttestation: true,
      requireFinanceRole: true,
    });
    if (!checkers.some((checker) => checker.ready)) {
      throw new ForbiddenException({
        code: 'INDEPENDENT_CHECKER_UNAVAILABLE',
        message: 'No separate verified Finance approver is available to review this request.',
      });
    }
  }
  return actor;
}

async function buildTaxPolicyCapabilities(
  tx: Prisma.TransactionClient,
  actorId: string,
  assurance: TaxPolicySessionAssurance,
  makerId: string | null,
) {
  const base = {
    requiredCategory: AdminOperatorPermissionCategory.FINANCE_TAX,
    sessionId: assurance.sessionId,
    sessionMfaVerifiedAt: assurance.mfaVerifiedAt,
  };
  const [draft, submit, decision, checkers] = await Promise.all([
    financeApproverPolicySnapshot(tx, actorId, {
      ...base,
      requireAttestation: false,
      requireFinanceRole: false,
    }),
    financeApproverPolicySnapshot(tx, actorId, {
      ...base,
      requireAttestation: false,
      requireFinanceRole: false,
      requireRecentReauthentication: true,
      requireSessionMfa: true,
    }),
    financeApproverPolicySnapshot(tx, actorId, {
      ...base,
      makerId,
      requireAttestation: true,
      requireFinanceRole: true,
      requireRecentReauthentication: true,
      requireSessionMfa: true,
    }),
    listFinanceApproverPolicySnapshots(tx, {
      excludeIds: [actorId],
      requiredCategory: AdminOperatorPermissionCategory.FINANCE_TAX,
      requireAttestation: true,
      requireFinanceRole: true,
    }),
  ]);
  const readyCheckers = checkers.filter((checker) => checker.ready);
  let draftBlockers: Array<{ code: string; message: string }> = [...draft.blockers];
  if (draft.source === 'FIXTURE' || draft.source === 'TEST_RUN') {
    try {
      assertTaxPolicyFixtureWriteEnvironment(
        process.env.DATABASE_URL,
        process.env.TAX_POLICY_FIXTURE_WRITE_ALLOWLIST,
      );
      draftBlockers = draftBlockers.filter((blocker) =>
        blocker.code !== 'TEST_OR_FIXTURE_ACCOUNT' && blocker.code !== 'NON_PRODUCTION_PROVENANCE');
    } catch (error) {
      draftBlockers.push({
        code: 'FIXTURE_DATABASE_NOT_ISOLATED',
        message: error instanceof Error ? error.message : 'Fixture Tax Policy writes require an isolated database.',
      });
    }
  }
  const submitBlockers: Array<{ code: string; message: string }> = [...submit.blockers];
  if (!readyCheckers.length) {
    submitBlockers.push({
      code: 'INDEPENDENT_CHECKER_UNAVAILABLE',
      message: 'No separate verified Finance approver is available to review this request.',
    });
  }
  return {
    actorId,
    canDecide: decision.ready,
    canDraft: draftBlockers.length === 0,
    canSubmit: submitBlockers.length === 0,
    decisionBlockers: decision.blockers,
    draftBlockers,
    generatedAt: new Date().toISOString(),
    independentCheckerCount: readyCheckers.length,
    source: draft.source,
    submitBlockers,
    warning: draft.source === 'PRODUCTION'
      ? null
      : 'This identity is not verified for production Tax Policy work.',
  };
}

async function requireTaxPolicyDraftProvenance(
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { adminUserProvenance: true },
  });
  if (actor?.adminUserProvenance === AdminUserProvenance.FIXTURE) {
    assertTaxPolicyFixtureWriteEnvironment(
      process.env.DATABASE_URL,
      process.env.TAX_POLICY_FIXTURE_WRITE_ALLOWLIST,
    );
    return TaxPolicyProvenance.SMOKE_TEST;
  }
  if (actor?.adminUserProvenance === AdminUserProvenance.PRODUCTION) {
    return TaxPolicyProvenance.OPERATOR;
  }
  throw new ForbiddenException({
    code: 'TAX_POLICY_OPERATOR_PROVENANCE_REQUIRED',
    message: 'Tax policy drafts require a production operator or an isolated fixture identity.',
  });
}

function assertTaxPolicyReadyForApproval(policy: {
  readonly provenance: TaxPolicyProvenance;
  readonly legalSourceTitle: string | null;
  readonly legalSourceUrl: string | null;
  readonly promulgatedDate: Date | null;
  readonly taxSubject: string | null;
  readonly changeSummary: string | null;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly rules: ReadonlyArray<{ readonly scope: TaxRuleScope; readonly active: boolean }>;
}) {
  if (policy.provenance !== TaxPolicyProvenance.OPERATOR) {
    throw new ConflictException({
      code: 'TAX_POLICY_NON_OPERATOR_DRAFT',
      message: 'Seed, smoke, migration, and legacy policies cannot enter the production approval flow.',
    });
  }
  if (
    !policy.legalSourceTitle ||
    !policy.legalSourceUrl ||
    !policy.promulgatedDate ||
    !policy.taxSubject ||
    !policy.changeSummary
  ) {
    throw new BadRequestException({
      code: 'TAX_POLICY_LEGAL_EVIDENCE_REQUIRED',
      message: 'Legal source, promulgated date, tax subject, and change summary are required.',
    });
  }
  requiredHttpsUrl(policy.legalSourceUrl, 'Legal source URL must use HTTPS');
  assertTaxPolicyEffectiveWindow(policy.effectiveFrom, policy.effectiveTo);
  const activeDefaultRules = policy.rules.filter(
    (rule) => rule.active && rule.scope === TaxRuleScope.DEFAULT,
  );
  if (activeDefaultRules.length !== 1) {
    throw new BadRequestException({
      code: 'TAX_POLICY_DEFAULT_RULE_REQUIRED',
      message: 'Exactly one active DEFAULT tax rule is required before approval.',
    });
  }
}

function taxPolicyPayloadHash(policy: {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: string;
  readonly timezone: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly notes: string | null;
  readonly legalSourceTitle: string | null;
  readonly legalSourceUrl: string | null;
  readonly promulgatedDate: Date | null;
  readonly taxSubject: string | null;
  readonly changeSummary: string | null;
  readonly supersedesPolicyVersionId: string | null;
  readonly revision: number;
  readonly rules: ReadonlyArray<{
    readonly id: string;
    readonly scope: TaxRuleScope;
    readonly serviceType: string | null;
    readonly minGrossAmount: number | null;
    readonly maxGrossAmount: number | null;
    readonly taxKind: string;
    readonly category: string | null;
    readonly collectionMode: string | null;
    readonly rateBps: number;
    readonly fixedAmount: number;
    readonly active: boolean;
  }>;
}) {
  return sha256(
    JSON.stringify({
      id: policy.id,
      name: policy.name,
      jurisdiction: policy.jurisdiction,
      timezone: policy.timezone,
      effectiveFrom: policy.effectiveFrom.toISOString(),
      effectiveTo: policy.effectiveTo?.toISOString() ?? null,
      notes: policy.notes,
      legalSourceTitle: policy.legalSourceTitle,
      legalSourceUrl: policy.legalSourceUrl,
      promulgatedDate: policy.promulgatedDate?.toISOString() ?? null,
      taxSubject: policy.taxSubject,
      changeSummary: policy.changeSummary,
      supersedesPolicyVersionId: policy.supersedesPolicyVersionId,
      revision: policy.revision,
      rules: policy.rules.map((rule) => ({
        id: rule.id,
        scope: rule.scope,
        serviceType: rule.serviceType,
        minGrossAmount: rule.minGrossAmount,
        maxGrossAmount: rule.maxGrossAmount,
        taxKind: rule.taxKind,
        category: rule.category,
        collectionMode: rule.collectionMode,
        rateBps: rule.rateBps,
        fixedAmount: rule.fixedAmount,
        active: rule.active,
      })),
    }),
  );
}

function taxPolicyApprovalReceipt(
  request: {
    readonly id: string;
    readonly policyVersionId: string;
    readonly requestedByAdminId: string;
    readonly decidedByAdminId: string | null;
    readonly operatorReason: string;
    readonly decisionReason: string | null;
    readonly payloadHash: string;
    readonly status: TaxPolicyApprovalStatus;
    readonly requestedAt: Date;
    readonly decidedAt: Date | null;
    readonly scheduledFor: Date | null;
    readonly activatedAt: Date | null;
    readonly failureCode: string | null;
    readonly policyVersion?: unknown;
    readonly requestedByAdmin?: unknown;
    readonly decidedByAdmin?: unknown;
  },
  replayed: boolean,
) {
  return {
    id: request.id,
    policyVersionId: request.policyVersionId,
    status: request.status,
    payloadHash: request.payloadHash,
    operatorReason: request.operatorReason,
    decisionReason: request.decisionReason,
    requestedAt: request.requestedAt,
    decidedAt: request.decidedAt,
    scheduledFor: request.scheduledFor,
    activatedAt: request.activatedAt,
    failureCode: request.failureCode,
    maker: request.requestedByAdmin ?? { id: request.requestedByAdminId },
    checker: request.decidedByAdmin ?? (request.decidedByAdminId ? { id: request.decidedByAdminId } : null),
    policyVersion: request.policyVersion,
    replayed,
  };
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

type TaxPolicyIntegrityIssue =
  | 'amount-mismatch'
  | 'missing-snapshot'
  | 'missing-tax-log'
  | 'no-active-policy'
  | 'no-approved-tax-profile'
  | 'no-matching-rule';

function taxPolicyIntegrityIssue(value?: string): TaxPolicyIntegrityIssue {
  const issues = new Set<TaxPolicyIntegrityIssue>([
    'amount-mismatch',
    'missing-snapshot',
    'missing-tax-log',
    'no-active-policy',
    'no-approved-tax-profile',
    'no-matching-rule',
  ]);
  if (!issues.has(value as TaxPolicyIntegrityIssue)) {
    throw new BadRequestException({
      code: 'TAX_POLICY_INTEGRITY_ISSUE_INVALID',
      message: 'Select a supported Tax Policy integrity issue.',
    });
  }
  return value as TaxPolicyIntegrityIssue;
}

function taxPolicyIntegrityIssuePredicate(issue: TaxPolicyIntegrityIssue) {
  if (issue === 'amount-mismatch') {
    return Prisma.sql`evidence."logCount" > 0 AND evidence."withholdingTotal" <> earning."withholdingAmount"`;
  }
  if (issue === 'missing-snapshot') {
    return Prisma.sql`evidence."logCount" > 0 AND evidence."snapshotCount" < evidence."logCount"`;
  }
  if (issue === 'missing-tax-log') return Prisma.sql`evidence."logCount" = 0`;
  if (issue === 'no-active-policy') return Prisma.sql`evidence."noActivePolicy"`;
  if (issue === 'no-approved-tax-profile') return Prisma.sql`evidence."noApprovedTaxProfile"`;
  return Prisma.sql`evidence."noMatchingRule"`;
}

function taxPolicyIntegrityEvidenceSource(rangeStart: Date, predicate: Prisma.Sql) {
  return Prisma.sql`
    FROM "ProviderEarning" earning
    INNER JOIN "ProviderProfile" provider ON provider."id" = earning."providerProfileId"
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "logCount",
        COUNT(log."ruleSnapshot")::int AS "snapshotCount",
        COALESCE(SUM(log."withholdingAmount"), 0)::bigint AS "withholdingTotal",
        CASE WHEN COUNT(DISTINCT log."policyVersionId") = 1 THEN MIN(log."policyVersionId") ELSE NULL END AS "policyVersionId",
        CASE WHEN COUNT(DISTINCT policy."provenance") = 1 THEN MIN(policy."provenance"::text)::"TaxPolicyProvenance" ELSE NULL END AS "policyProvenance",
        COUNT(policy."id")::int AS "policyCount",
        COUNT(DISTINCT policy."provenance")::int AS "provenanceCount",
        COALESCE(BOOL_OR(policy."provenance" = 'OPERATOR'), false) AS "hasProductionPolicy",
        COALESCE(BOOL_OR(policy."provenance" IN ('SEED', 'SMOKE_TEST')), false) AS "hasTestPolicy",
        COALESCE(BOOL_OR(policy."provenance" = 'MIGRATION'), false) AS "hasLegacyPolicy",
        COALESCE(BOOL_OR(log."ruleSnapshot"->>'reason' = 'NO_ACTIVE_POLICY'), false) AS "noActivePolicy",
        COALESCE(BOOL_OR(log."ruleSnapshot"->>'reason' = 'NO_APPROVED_TAX_PROFILE'), false) AS "noApprovedTaxProfile",
        COALESCE(BOOL_OR(
          log."ruleSnapshot"->>'reason' = 'NO_MATCHING_RULE'
          OR jsonb_path_exists(COALESCE(log."ruleSnapshot", '{}'::jsonb), '$.lines[*] ? (@.scope == "NONE")')
        ), false) AS "noMatchingRule"
      FROM "ProviderTaxLog" log
      LEFT JOIN "TaxPolicyVersion" policy ON policy."id" = log."policyVersionId"
      WHERE log."earningId" = earning."id"
    ) evidence ON true
    WHERE earning."createdAt" >= ${rangeStart} AND ${predicate}
  `;
}

type TaxPolicyEvidenceSource = 'all' | 'legacy' | 'production' | 'test' | 'test-legacy' | 'unknown';

function taxPolicyEvidenceSource(value?: string | null, allowCombined = false): TaxPolicyEvidenceSource | undefined {
  if (!value?.trim()) return undefined;
  const source = value.trim();
  const supported = allowCombined
    ? ['production', 'test', 'legacy', 'unknown', 'test-legacy']
    : ['all', 'production', 'test', 'legacy', 'unknown'];
  return supported.includes(source) ? source as TaxPolicyEvidenceSource : undefined;
}

function taxPolicyVersionSourceWhere(source: Exclude<TaxPolicyEvidenceSource, 'all'>): Prisma.TaxPolicyVersionWhereInput {
  if (source === 'production') return { provenance: TaxPolicyProvenance.OPERATOR };
  if (source === 'test') {
    return { provenance: { in: [TaxPolicyProvenance.SEED, TaxPolicyProvenance.SMOKE_TEST] } };
  }
  if (source === 'legacy') return { provenance: TaxPolicyProvenance.MIGRATION };
  if (source === 'unknown') return { provenance: TaxPolicyProvenance.LEGACY_UNKNOWN };
  return { provenance: { not: TaxPolicyProvenance.OPERATOR } };
}

function taxPolicyAuditPolicyVersionId(log: { metadata?: Prisma.JsonValue | null; target: string }) {
  if (log.target.startsWith('tax_policy:')) return log.target.slice('tax_policy:'.length);
  const metadata = log.metadata;
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return '';
  const policyVersionId = (metadata as Prisma.JsonObject).policyVersionId;
  return typeof policyVersionId === 'string' ? policyVersionId : '';
}

function taxPolicyIntegritySourceExpression() {
  return Prisma.sql`
    CASE
      WHEN evidence."logCount" = 0
        OR evidence."policyCount" <> evidence."logCount"
        OR evidence."provenanceCount" <> 1
        THEN 'UNKNOWN'
      WHEN evidence."hasProductionPolicy" THEN 'PRODUCTION'
      WHEN evidence."hasTestPolicy" THEN 'TEST'
      WHEN evidence."hasLegacyPolicy" THEN 'LEGACY'
      ELSE 'UNKNOWN'
    END
  `;
}

function taxPolicyIntegritySourcePredicate(source: TaxPolicyEvidenceSource) {
  if (source === 'all') return Prisma.sql`true`;
  const label = source.toUpperCase();
  return Prisma.sql`${taxPolicyIntegritySourceExpression()} = ${label}`;
}

function taxPolicyIntegrityRowSource(
  provenance: TaxPolicyProvenance | null,
): 'LEGACY' | 'PRODUCTION' | 'TEST' | 'UNKNOWN' {
  if (!provenance || provenance === TaxPolicyProvenance.LEGACY_UNKNOWN) return 'UNKNOWN';
  if (provenance === TaxPolicyProvenance.OPERATOR) return 'PRODUCTION';
  if (provenance === TaxPolicyProvenance.MIGRATION) return 'LEGACY';
  return 'TEST';
}

function taxPolicyIntegrityClassification(
  issue: TaxPolicyIntegrityIssue,
  source: 'LEGACY' | 'PRODUCTION' | 'TEST' | 'UNKNOWN',
) {
  if (issue === 'no-active-policy' || issue === 'no-approved-tax-profile' || issue === 'no-matching-rule') {
    return 'APPLICABILITY_READINESS' as const;
  }
  if (source === 'PRODUCTION') return 'CURRENT_REGRESSION' as const;
  if (source === 'LEGACY') return 'LEGACY_MIGRATION_DEBT' as const;
  return 'UNKNOWN' as const;
}

function parseVietnamDateBoundary(value: string, message: string, endExclusive = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(message);
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
  if (endExclusive) date.setUTCDate(date.getUTCDate() + 1);
  return date;
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
