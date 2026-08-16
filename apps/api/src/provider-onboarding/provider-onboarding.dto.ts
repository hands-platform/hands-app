import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ProviderAgreementType,
  ProviderDocumentType,
  TaxPolicyStatus,
  TaxRuleScope,
} from '@prisma/client';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function numberString(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? value : Number(trimmed);
}

export class UpdateProviderBasicProfileDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  gender?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  facebookId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  activityNickname?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @IsOptional()
  @Allow()
  specialties?: unknown;

  @IsOptional()
  @Allow()
  languages?: unknown;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  serviceStyle?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  residentialAddress?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Allow()
  serviceArea?: unknown;
}

class SubmitProviderKycDocumentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  fileId!: string;

  @IsEnum(ProviderDocumentType)
  type!: ProviderDocumentType;
}

export class SubmitProviderKycDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  cccdNumber?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitProviderKycDocumentDto)
  documents?: SubmitProviderKycDocumentDto[];
}

export class CreateProviderBankAccountDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  accountHolderName!: string;

  @IsOptional()
  @Allow()
  qrBankingInfo?: unknown;

}

export class UpsertProviderTaxProfileDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  taxCode?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  legalName!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  registeredAddress!: string;

}

export class AcceptProviderAgreementDto {
  @IsEnum(ProviderAgreementType)
  type!: ProviderAgreementType;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  version!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

class TaxPolicyMutationEvidenceDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  operatorReason!: string;
}

export class CreateTaxPolicyVersionDto extends TaxPolicyMutationEvidenceDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsEnum(TaxPolicyStatus)
  status?: TaxPolicyStatus;

  @Transform(({ value }) => trimString(value))
  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  legalSourceTitle!: string;

  @Transform(({ value }) => trimString(value))
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(1000)
  legalSourceUrl!: string;

  @Transform(({ value }) => trimString(value))
  @IsDateString()
  promulgatedDate!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  taxSubject!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  changeSummary!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  supersedesPolicyVersionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  defaultRateBps?: number;
}

export class UpdateTaxPolicyVersionDto extends TaxPolicyMutationEvidenceDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsEnum(TaxPolicyStatus)
  status?: TaxPolicyStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  legalSourceTitle?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(1000)
  legalSourceUrl?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  promulgatedDate?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  taxSubject?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  changeSummary?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  supersedesPolicyVersionId?: string | null;
}

export class CreateTaxRuleDto extends TaxPolicyMutationEvidenceDto {
  @IsOptional()
  @IsEnum(TaxRuleScope)
  scope?: TaxRuleScope;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  serviceType?: string;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  minGrossAmount?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  maxGrossAmount?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateTaxRuleDto extends TaxPolicyMutationEvidenceDto {
  @IsOptional()
  @IsEnum(TaxRuleScope)
  scope?: TaxRuleScope;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  serviceType?: string | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  minGrossAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  maxGrossAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  fixedAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SubmitTaxPolicyApprovalRequestDto {
  @IsOptional()
  @IsBoolean()
  cleanSourceAcknowledged?: boolean;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  operatorReason!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  idempotencyKey!: string;
}

export enum TaxPolicyApprovalDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class DecideTaxPolicyApprovalRequestDto {
  @IsEnum(TaxPolicyApprovalDecision)
  decision!: TaxPolicyApprovalDecision;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  decisionReason!: string;
}


export class ProviderOnboardingReasonDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
