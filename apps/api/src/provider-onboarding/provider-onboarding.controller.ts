import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderKycStatus,
  ProviderTaxProfileStatus,
  Role,
} from '@prisma/client';
import { AdminOperatorCategoryGuard } from '../admin/admin-operator-category.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AcceptProviderAgreementDto,
  CreateProviderBankAccountDto,
  CreateTaxPolicyVersionDto,
  CreateTaxRuleDto,
  ProviderOnboardingReasonDto,
  SubmitProviderKycDto,
  UpdateProviderBasicProfileDto,
  UpdateTaxPolicyVersionDto,
  UpdateTaxRuleDto,
  UpsertProviderTaxProfileDto,
} from './provider-onboarding.dto';
import { ProviderOnboardingService } from './provider-onboarding.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, AdminOperatorCategoryGuard)
export class ProviderOnboardingController {
  constructor(private readonly onboarding: ProviderOnboardingService) {}

  @Get(['partner/onboarding', 'provider/onboarding'])
  @Roles(Role.PROVIDER)
  snapshot(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getSnapshot(user.id);
  }

  @Patch(['partner/onboarding/basic-profile', 'provider/onboarding/basic-profile'])
  @Roles(Role.PROVIDER)
  updateBasicProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProviderBasicProfileDto,
  ) {
    return this.onboarding.updateBasicProfile(user.id, body);
  }

  @Post(['partner/onboarding/kyc/submit', 'provider/onboarding/kyc/submit'])
  @Roles(Role.PROVIDER)
  submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubmitProviderKycDto,
  ) {
    return this.onboarding.submitKyc(user.id, body);
  }

  @Post(['partner/onboarding/bank-accounts', 'provider/onboarding/bank-accounts'])
  @Roles(Role.PROVIDER)
  createBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateProviderBankAccountDto,
  ) {
    return this.onboarding.createBankAccount(user.id, body);
  }

  @Post(['partner/onboarding/tax-profile', 'provider/onboarding/tax-profile'])
  @Roles(Role.PROVIDER)
  upsertTaxProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertProviderTaxProfileDto,
  ) {
    return this.onboarding.upsertTaxProfile(user.id, body);
  }

  @Post(['partner/onboarding/agreements', 'provider/onboarding/agreements'])
  @Roles(Role.PROVIDER)
  acceptAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: { ip?: string },
    @Body() body: AcceptProviderAgreementDto,
  ) {
    return this.onboarding.acceptAgreement(user.id, {
      ...body,
      ipAddress: request.ip,
    });
  }

  @Get('admin/tax-policy-versions')
  @Roles(Role.ADMIN)
  taxPolicyVersions(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.onboarding.listTaxPolicyVersions({ skip, take });
  }

  @Post('admin/tax-policy-versions')
  @Roles(Role.ADMIN)
  createTaxPolicyVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTaxPolicyVersionDto,
  ) {
    return this.onboarding.createTaxPolicyVersion(user.id, body);
  }

  @Patch('admin/tax-policy-versions/:id')
  @Roles(Role.ADMIN)
  updateTaxPolicyVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTaxPolicyVersionDto,
  ) {
    return this.onboarding.updateTaxPolicyVersion(user.id, id, body);
  }

  @Post('admin/tax-policy-versions/:id/rules')
  @Roles(Role.ADMIN)
  createTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') policyVersionId: string,
    @Body() body: CreateTaxRuleDto,
  ) {
    return this.onboarding.createTaxRule(user.id, policyVersionId, body);
  }

  @Patch('admin/tax-rules/:id')
  @Roles(Role.ADMIN)
  updateTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateTaxRuleDto,
  ) {
    return this.onboarding.updateTaxRule(user.id, id, body);
  }

  @Post('admin/providers/:id/kyc/approve')
  @Roles(Role.ADMIN)
  approveKyc(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.onboarding.reviewKyc(user.id, providerProfileId, ProviderKycStatus.APPROVED);
  }

  @Post('admin/partners/:id/kyc/approve')
  @Roles(Role.ADMIN)
  approvePartnerKyc(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.onboarding.reviewKyc(user.id, providerProfileId, ProviderKycStatus.APPROVED);
  }

  @Post('admin/providers/:id/kyc/reject')
  @Roles(Role.ADMIN)
  rejectKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewKyc(user.id, providerProfileId, ProviderKycStatus.REJECTED, body.reason);
  }

  @Post('admin/partners/:id/kyc/reject')
  @Roles(Role.ADMIN)
  rejectPartnerKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewKyc(user.id, providerProfileId, ProviderKycStatus.REJECTED, body.reason);
  }

  @Post(['admin/providers/:id/kyc/hold', 'admin/partners/:id/kyc/hold'])
  @Roles(Role.ADMIN)
  holdPartnerKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewKyc(user.id, providerProfileId, ProviderKycStatus.BLOCKED, body.reason);
  }

  @Post(['admin/provider-documents/:id/approve', 'admin/partner-documents/:id/approve'])
  @Roles(Role.ADMIN)
  approveProviderDocument(@CurrentUser() user: AuthenticatedUser, @Param('id') documentId: string) {
    return this.onboarding.reviewProviderDocument(user.id, documentId, ProviderDocumentStatus.APPROVED);
  }

  @Post(['admin/provider-documents/:id/reject', 'admin/partner-documents/:id/reject'])
  @Roles(Role.ADMIN)
  rejectProviderDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') documentId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewProviderDocument(
      user.id,
      documentId,
      ProviderDocumentStatus.REJECTED,
      body.reason,
    );
  }

  @Post(['admin/provider-bank-accounts/:id/approve', 'admin/partner-bank-accounts/:id/approve'])
  @Roles(Role.ADMIN)
  approveBankAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') bankAccountId: string) {
    return this.onboarding.reviewBankAccount(user.id, bankAccountId, ProviderBankAccountStatus.APPROVED);
  }

  @Post(['admin/provider-bank-accounts/:id/reject', 'admin/partner-bank-accounts/:id/reject'])
  @Roles(Role.ADMIN)
  rejectBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bankAccountId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewBankAccount(
      user.id,
      bankAccountId,
      ProviderBankAccountStatus.REJECTED,
      body.reason,
    );
  }

  @Post('admin/providers/:id/tax-profile/approve')
  @Roles(Role.ADMIN)
  approveTaxProfile(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.onboarding.reviewTaxProfile(user.id, providerProfileId, ProviderTaxProfileStatus.APPROVED);
  }

  @Post('admin/partners/:id/tax-profile/approve')
  @Roles(Role.ADMIN)
  approvePartnerTaxProfile(@CurrentUser() user: AuthenticatedUser, @Param('id') providerProfileId: string) {
    return this.onboarding.reviewTaxProfile(user.id, providerProfileId, ProviderTaxProfileStatus.APPROVED);
  }

  @Post('admin/providers/:id/tax-profile/reject')
  @Roles(Role.ADMIN)
  rejectTaxProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewTaxProfile(
      user.id,
      providerProfileId,
      ProviderTaxProfileStatus.REJECTED,
      body.reason,
    );
  }

  @Post('admin/partners/:id/tax-profile/reject')
  @Roles(Role.ADMIN)
  rejectPartnerTaxProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') providerProfileId: string,
    @Body() body: ProviderOnboardingReasonDto,
  ) {
    return this.onboarding.reviewTaxProfile(
      user.id,
      providerProfileId,
      ProviderTaxProfileStatus.REJECTED,
      body.reason,
    );
  }
}
