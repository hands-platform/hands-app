import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import {
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderTaxProfileStatus,
  Role,
  TaxPolicyStatus,
  TaxRuleScope,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProviderOnboardingService } from './provider-onboarding.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProviderOnboardingController {
  constructor(private readonly onboarding: ProviderOnboardingService) {}

  @Get('provider/onboarding')
  @Roles(Role.PROVIDER)
  snapshot(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getSnapshot(user.id);
  }

  @Patch('provider/onboarding/basic-profile')
  @Roles(Role.PROVIDER)
  updateBasicProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
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
    return this.onboarding.updateBasicProfile(user.id, body);
  }

  @Post('provider/onboarding/kyc/submit')
  @Roles(Role.PROVIDER)
  submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      cccdNumber?: string;
      documents?: Array<{ fileId: string; type: string }>;
    },
  ) {
    return this.onboarding.submitKyc(user.id, body);
  }

  @Post('provider/onboarding/bank-accounts')
  @Roles(Role.PROVIDER)
  createBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      bankName: string;
      accountNumber?: string;
      accountHolderName: string;
      qrBankingInfo?: unknown;
      status?: ProviderBankAccountStatus;
    },
  ) {
    return this.onboarding.createBankAccount(user.id, body);
  }

  @Post('provider/onboarding/tax-profile')
  @Roles(Role.PROVIDER)
  upsertTaxProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      taxCode?: string;
      legalName: string;
      registeredAddress: string;
      status?: ProviderTaxProfileStatus;
    },
  ) {
    return this.onboarding.upsertTaxProfile(user.id, body);
  }

  @Post('provider/onboarding/agreements')
  @Roles(Role.PROVIDER)
  acceptAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: { ip?: string },
    @Body() body: { type: ProviderAgreementType; version: string; deviceId?: string },
  ) {
    return this.onboarding.acceptAgreement(user.id, {
      ...body,
      ipAddress: request.ip,
    });
  }

  @Get('admin/tax-policy-versions')
  @Roles(Role.ADMIN)
  taxPolicyVersions() {
    return this.onboarding.listTaxPolicyVersions();
  }

  @Post('admin/tax-policy-versions')
  @Roles(Role.ADMIN)
  createTaxPolicyVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      status?: TaxPolicyStatus;
      effectiveFrom: string;
      effectiveTo?: string | null;
      notes?: string;
    },
  ) {
    return this.onboarding.createTaxPolicyVersion(user.id, body);
  }

  @Patch('admin/tax-policy-versions/:id')
  @Roles(Role.ADMIN)
  updateTaxPolicyVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      status?: TaxPolicyStatus;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      notes?: string | null;
    },
  ) {
    return this.onboarding.updateTaxPolicyVersion(user.id, id, body);
  }

  @Post('admin/tax-policy-versions/:id/rules')
  @Roles(Role.ADMIN)
  createTaxRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') policyVersionId: string,
    @Body()
    body: {
      scope?: TaxRuleScope;
      serviceType?: string;
      minGrossAmount?: number;
      maxGrossAmount?: number;
      rateBps?: number;
      fixedAmount?: number;
      active?: boolean;
    },
  ) {
    return this.onboarding.createTaxRule(user.id, policyVersionId, body);
  }
}
