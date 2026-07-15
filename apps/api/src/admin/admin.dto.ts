import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  AdminOperatorPermissionCategory,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
  MonthlyTaxClosingStatus,
  PayoutBatchStatus,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  ProviderWalletWithdrawalRequestStatus,
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionType,
  ReferralRewardMode,
  ReviewStatus,
  Role,
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

@ValidatorConstraint({ name: 'providerPayoutDoesNotExceedCustomerPrice', async: false })
class ProviderPayoutDoesNotExceedCustomerPriceConstraint implements ValidatorConstraintInterface {
  validate(providerPayoutAmount: unknown, args: ValidationArguments) {
    const body = args.object as { basePrice?: unknown; customerPrice?: unknown };
    const customerPrice = body.customerPrice ?? body.basePrice;
    if (providerPayoutAmount === undefined || customerPrice === undefined) {
      return true;
    }
    return (
      typeof providerPayoutAmount === 'number' &&
      typeof customerPrice === 'number' &&
      providerPayoutAmount <= customerPrice
    );
  }

  defaultMessage() {
    return 'Partner payout amount cannot exceed customer price';
  }
}

class AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Allow()
  nameTranslations?: unknown;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  basePrice?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  priceStep?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAdminServiceDto extends AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string;
}

export class UpdateAdminServiceDto extends AdminServiceSharedPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string | null;
}

class ServiceDurationOptionDto {
  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  basePrice?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Validate(ProviderPayoutDoesNotExceedCustomerPriceConstraint)
  providerPayoutAmount?: number | null;
}

export class CreateServiceDurationSetDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  serviceGroupKey?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  priceStep?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  vatBps?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  otherCostAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDurationOptionDto)
  durations?: ServiceDurationOptionDto[];
}

class ServicePayoutRulePayloadDto {
  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  customerPrice?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Validate(ProviderPayoutDoesNotExceedCustomerPriceConstraint)
  providerPayoutAmount?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  vatBps?: number;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  otherCostAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpsertServicePayoutRuleDto extends ServicePayoutRulePayloadDto {}

export class UpdateServicePayoutRuleDto extends ServicePayoutRulePayloadDto {}

export class BulkUpsertServicePayoutRulesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertServicePayoutRuleDto)
  rules?: UpsertServicePayoutRuleDto[];
}

export class BookingOpsNoteDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  preset?: string;
}

export class BookingOpsReasonDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class BookingCloseoutDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class BookingPostMatchCancellationDecisionDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class BookingOpsTaskDto {
  @IsEnum(BookingOpsTaskType)
  type!: BookingOpsTaskType;

  @IsEnum(BookingOpsTaskStatus)
  status!: BookingOpsTaskStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CustomerOpsNoteDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  preset?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  bookingId?: string | null;
}

export class PartnerOpsNoteDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  preset?: string;
}

export class AdminReasonDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateFinanceApproverRoleDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateAdminOperatorDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  phone?: string;

  @Transform(({ value }) => trimString(value))
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  email!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  password!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  fullName?: string | null;

  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @IsOptional()
  @IsArray()
  @IsEnum(AdminOperatorPermissionCategory, { each: true })
  permissionCategories?: AdminOperatorPermissionCategory[];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class VerifyAdminOperatorLoginDto {
  @Transform(({ value }) => trimString(value))
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  email!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  password!: string;
}

export class UpdateAdminOperatorAccessDto {
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @IsOptional()
  @IsArray()
  @IsEnum(AdminOperatorPermissionCategory, { each: true })
  permissionCategories?: AdminOperatorPermissionCategory[];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteAdminOperatorAccessDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminOperatorActivityDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  operatorIdentity?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  action!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  target!: string;

  @IsOptional()
  @Allow()
  metadata?: unknown;
}

class AdminCalendarEventPayloadDto {
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  operatorIdentity?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  operatorName?: string;
}

export class CreateAdminCalendarEventDto extends AdminCalendarEventPayloadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}

export class UpdateAdminCalendarEventDto extends AdminCalendarEventPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}

export class AdminCalendarActorDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  operatorIdentity?: string;
}

export class UpdateMonthlyTaxClosingStatusDto {
  @IsEnum(MonthlyTaxClosingStatus)
  status!: MonthlyTaxClosingStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  remittanceTransferRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  remittanceChannel?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  remittanceEvidenceUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  paidAt?: string | null;
}

export class CreatePaymentFeePolicyVersionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdatePaymentFeePolicyVersionDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpsertPaymentFeeRuleDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsEnum(PaymentFeeRuleType)
  feeType!: PaymentFeeRuleType;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps!: number;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  fixedAmount!: number;

  @IsEnum(PaymentFeePayer)
  payer!: PaymentFeePayer;

  @IsEnum(PaymentFeeTreatment)
  treatment!: PaymentFeeTreatment;
}

export class ActivatePaymentFeePolicyVersionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class RequestPaymentFeePolicyApprovalDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ClosePaymentFeePolicyApprovalDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreatePartnerReportDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  providerProfileId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  bookingId?: string | null;

  @IsOptional()
  @IsEnum(ProviderReportSource)
  source?: ProviderReportSource;

  @IsOptional()
  @IsEnum(ProviderReportSeverity)
  severity?: ProviderReportSeverity;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  details?: string | null;
}

export class UpdatePartnerReportDto {
  @IsOptional()
  @IsEnum(ProviderReportStatus)
  status?: ProviderReportStatus;

  @IsOptional()
  @IsEnum(ProviderReportSeverity)
  severity?: ProviderReportSeverity;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string | null;
}

export class CreatePartnerSanctionDto {
  @IsOptional()
  @IsEnum(ProviderSanctionType)
  type?: ProviderSanctionType;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  reportId?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  reportReason?: string;
}

export class CreateCouponDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDefined()
  @Allow()
  discount!: unknown;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Allow()
  discount?: unknown;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class OperationsHandoffNoteDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  preset?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  owner?: string;
}

export class UpdateOperationalPolicyDto {
  @IsOptional()
  @Allow()
  value?: unknown;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateNotificationTemplateDto {
  @Transform(({ value }) => trimString(value))
  @IsIn(['en', 'vi', 'ko', 'ja', 'zh'])
  locale!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AdminPushCampaignDto {
  @IsEnum(Role)
  targetRole!: Role;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  targetUserId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  targetSegment?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsIn(['notificationCenter', 'booking', 'jobs', 'earnings', 'chat', 'providerProfile', 'profile'])
  appDestination?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsIn(['en', 'vi', 'ko', 'ja', 'zh'])
  locale?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}

export class UpdateReferralPolicyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(ReferralRewardMode)
  rewardMode?: ReferralRewardMode;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionPercentBps?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  fixedRewardAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  perRewardCapAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  totalRewardCapAmount?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  maxRewardedReferrals?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  maxRewardsPerReferred?: number | null;

  @IsOptional()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  @Max(365)
  holdPeriodDays?: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpsertMarketingSpendDailyDto {
  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(10)
  spendDate!: string;

  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  source!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(30)
  platform?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  regionCode?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  campaignId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  campaignName?: string | null;

  @IsDefined()
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(0)
  spendAmount!: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ReferralRewardDecisionDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReferralRewardCashoutPaidDto extends ReferralRewardDecisionDto {
  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transferRef!: string;
}

export class RepairBookingSettlementGapDto {
  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @IsDefined()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class MarkEarningPaidDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  settlementRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  settlementNotes?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  settlementMethod?: string | null;
}

class PartnerBankDepositPayloadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  providerProfileId!: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  amount!: number;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankTransactionId!: string;

  @Transform(({ value }) => trimString(value))
  @IsDateString()
  depositDate!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  bankAccount?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  attachmentFileId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  attachmentUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreatePartnerBankDepositRequestDto extends PartnerBankDepositPayloadDto {}

export class AllocatePartnerBankDepositCashDebtDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  earningId!: string;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  amount!: number;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  notes!: string;
}

export class RecordPartnerBankDepositDto extends PartnerBankDepositPayloadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;
}

export class AssignCompanyBankTransactionImportBatchDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  assigneeAdminId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AssignCompanyBankTransactionReviewDto extends AssignCompanyBankTransactionImportBatchDto {}

export class RejectPartnerBankDepositRequestDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

const MANUAL_WALLET_ADJUSTMENT_OWNER_TYPES = ['CUSTOMER', 'PARTNER'] as const;
const MANUAL_WALLET_ADJUSTMENT_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
const MANUAL_WALLET_ADJUSTMENT_TYPES = [
  'PROMOTION_CREDIT',
  'CUSTOMER_COMPENSATION',
  'PARTNER_BONUS',
  'REFERRAL_CORRECTION',
  'ERROR_CORRECTION',
  'PENALTY',
  'CASH_BOOKING_DEDUCTION',
  'RECEIVABLE_WRITE_OFF',
  'MANUAL_REVERSAL',
] as const;

class ManualWalletAdjustmentPayloadDto {
  @Transform(({ value }) => trimString(value))
  @IsIn(MANUAL_WALLET_ADJUSTMENT_OWNER_TYPES)
  ownerType!: (typeof MANUAL_WALLET_ADJUSTMENT_OWNER_TYPES)[number];

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  ownerId!: string;

  @Transform(({ value }) => trimString(value))
  @IsIn(MANUAL_WALLET_ADJUSTMENT_DIRECTIONS)
  direction!: (typeof MANUAL_WALLET_ADJUSTMENT_DIRECTIONS)[number];

  @Transform(({ value }) => trimString(value))
  @IsIn(MANUAL_WALLET_ADJUSTMENT_TYPES)
  adjustmentType!: (typeof MANUAL_WALLET_ADJUSTMENT_TYPES)[number];

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(7)
  monthlyPeriod?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  attachmentUrl?: string | null;
}

export class PreviewManualWalletAdjustmentDto extends ManualWalletAdjustmentPayloadDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string;
}

export class CreateManualWalletAdjustmentDto extends ManualWalletAdjustmentPayloadDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;
}

export class CreateManualWalletAdjustmentRequestDto extends ManualWalletAdjustmentPayloadDto {}

export class RejectManualWalletAdjustmentRequestDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class UpdateProviderWalletWithdrawalRequestDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string | null;

  @IsOptional()
  @IsEnum(ProviderWalletWithdrawalRequestStatus)
  status?: ProviderWalletWithdrawalRequestStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  transferRef?: string | null;

  @IsOptional()
  @IsDateString()
  bankTransferDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  attachmentFileId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  attachmentUrl?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  adminNote?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  correctionReason?: string | null;
}

export class CreateCompanyBankAccountDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  operatorReason!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  accountNumberMasked?: string | null;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^\d{4}$/u, { message: 'accountNumberLast4 must contain exactly four digits' })
  accountNumberLast4!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^[A-Za-z]{3}$/u, { message: 'currency must be a three-letter code' })
  currency!: string;
}

export class UpdateCompanyBankAccountDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  operatorReason!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  accountNumberMasked?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^\d{4}$/u, { message: 'accountNumberLast4 must contain exactly four digits' })
  accountNumberLast4?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^[A-Za-z]{3}$/u, { message: 'currency must be a three-letter code' })
  currency?: string;

  @IsOptional()
  @IsEnum(CompanyBankAccountStatus)
  status?: CompanyBankAccountStatus;
}

export class CreateCompanyBankTransactionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  operatorReason?: string | null;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bankAccountId!: string;

  @IsEnum(CompanyBankTransactionType)
  type!: CompanyBankTransactionType;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  amount!: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsDateString()
  valueDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  sourceKey?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  transferRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  counterpartyName?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  confirmPotentialDuplicate?: boolean;
}

export class CompanyBankTransactionBatchRowDto {
  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(10_000)
  rowNumber!: number;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  bankAccountId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  type!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  amount!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  occurredAt!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(64)
  valueDate?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  sourceKey?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  transferRef?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(160)
  counterpartyName?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  confirmPotentialDuplicate?: boolean;
}

export class PreviewCompanyBankTransactionBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompanyBankTransactionBatchRowDto)
  rows!: CompanyBankTransactionBatchRowDto[];
}

export class ImportCompanyBankTransactionBatchDto extends PreviewCompanyBankTransactionBatchDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(12)
  @MaxLength(500)
  operatorReason?: string | null;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceFileName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(/^[a-f0-9]{64}$/u, { message: 'sourceFileSha256 must be a SHA-256 hexadecimal digest' })
  sourceFileSha256!: string;

  @Transform(({ value }) => trimString(value))
  @IsIn(['GENERIC', 'VCB', 'MOMO', 'VNPAY'])
  mappingPreset!: 'GENERIC' | 'VCB' | 'MOMO' | 'VNPAY';
}

export class CreateBankReconciliationMatchDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  accountingJournalEntryId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  partnerBankDepositRequestId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  paymentClearingEntryId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  withdrawalRequestId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  payoutBatchId?: string | null;

  @Transform(({ value }) => numberString(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ReverseBankReconciliationMatchDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class IgnoreCompanyBankTransactionDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  approvalAdminId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreatePayoutBatchDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  providerProfileId!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  transferRef?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePayoutBatchDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(128)
  approvalAdminId?: string | null;

  @IsOptional()
  @IsEnum(PayoutBatchStatus)
  status?: PayoutBatchStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  transferRef?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
