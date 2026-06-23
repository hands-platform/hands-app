import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReferralAudience } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const referralCodeSelect = {
  id: true,
  active: true,
  audience: true,
  code: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReferralCodeSelect;

type ReferralCodeRecord = Prisma.ReferralCodeGetPayload<{ select: typeof referralCodeSelect }>;

const referralClaimCodeSelect = {
  id: true,
  active: true,
  audience: true,
  code: true,
  ownerCustomerProfileId: true,
  ownerProviderProfileId: true,
} satisfies Prisma.ReferralCodeSelect;

const referralAttributionSelect = {
  id: true,
  audience: true,
  referralCodeId: true,
  referrerCustomerProfileId: true,
  referrerProviderProfileId: true,
  referredCustomerProfileId: true,
  referredProviderProfileId: true,
  installSource: true,
  platform: true,
  status: true,
  fraudReviewStatus: true,
  createdAt: true,
  updatedAt: true,
  referralCode: {
    select: {
      id: true,
      code: true,
    },
  },
} satisfies Prisma.ReferralAttributionSelect;

type ReferralAttributionRecord = Prisma.ReferralAttributionGetPayload<{ select: typeof referralAttributionSelect }>;

type ClaimReferralCodeInput = {
  code: string;
  installSource?: string;
  platform?: string;
};

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerReferralCode(userId: string) {
    const profile = await this.customerProfileForUser(userId);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        audience: ReferralAudience.CUSTOMER,
        ownerCustomerProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return code ? referralCodeView(code) : null;
  }

  async issueCustomerReferralCode(userId: string) {
    const existing = await this.getCustomerReferralCode(userId);
    if (existing) {
      return existing;
    }

    const profile = await this.customerProfileForUser(userId);
    const code = await this.prisma.referralCode.create({
      data: {
        audience: ReferralAudience.CUSTOMER,
        code: referralCodeForOwner(ReferralAudience.CUSTOMER, profile.id),
        ownerCustomerProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return referralCodeView(code);
  }

  async claimCustomerReferralCode(userId: string, input: ClaimReferralCodeInput) {
    const profile = await this.customerProfileForUser(userId);
    const existing = await this.prisma.referralAttribution.findFirst({
      where: {
        audience: ReferralAudience.CUSTOMER,
        referredCustomerProfileId: profile.id,
      },
      select: referralAttributionSelect,
    });
    if (existing) {
      return referralAttributionView(existing);
    }

    const claim = normalizeReferralClaim(input);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        active: true,
        audience: ReferralAudience.CUSTOMER,
        code: claim.code,
      },
      select: referralClaimCodeSelect,
    });
    if (!code?.ownerCustomerProfileId) {
      throw new BadRequestException('Referral code was not found or is inactive');
    }
    if (code.ownerCustomerProfileId === profile.id) {
      throw new BadRequestException('Customers cannot claim their own referral code');
    }

    const attribution = await this.prisma.referralAttribution.create({
      data: {
        audience: ReferralAudience.CUSTOMER,
        referralCodeId: code.id,
        referrerCustomerProfileId: code.ownerCustomerProfileId,
        referredCustomerProfileId: profile.id,
        installSource: claim.installSource,
        platform: claim.platform,
      },
      select: referralAttributionSelect,
    });

    return referralAttributionView(attribution);
  }

  async getPartnerReferralCode(userId: string) {
    const profile = await this.partnerProfileForUser(userId);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        audience: ReferralAudience.PARTNER,
        ownerProviderProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return code ? referralCodeView(code) : null;
  }

  async issuePartnerReferralCode(userId: string) {
    const existing = await this.getPartnerReferralCode(userId);
    if (existing) {
      return existing;
    }

    const profile = await this.partnerProfileForUser(userId);
    const code = await this.prisma.referralCode.create({
      data: {
        audience: ReferralAudience.PARTNER,
        code: referralCodeForOwner(ReferralAudience.PARTNER, profile.id),
        ownerProviderProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return referralCodeView(code);
  }

  async claimPartnerReferralCode(userId: string, input: ClaimReferralCodeInput) {
    const profile = await this.partnerProfileForUser(userId);
    const existing = await this.prisma.referralAttribution.findFirst({
      where: {
        audience: ReferralAudience.PARTNER,
        referredProviderProfileId: profile.id,
      },
      select: referralAttributionSelect,
    });
    if (existing) {
      return referralAttributionView(existing);
    }

    const claim = normalizeReferralClaim(input);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        active: true,
        audience: ReferralAudience.PARTNER,
        code: claim.code,
      },
      select: referralClaimCodeSelect,
    });
    if (!code?.ownerProviderProfileId) {
      throw new BadRequestException('Referral code was not found or is inactive');
    }
    if (code.ownerProviderProfileId === profile.id) {
      throw new BadRequestException('Partners cannot claim their own referral code');
    }

    const attribution = await this.prisma.referralAttribution.create({
      data: {
        audience: ReferralAudience.PARTNER,
        referralCodeId: code.id,
        referrerProviderProfileId: code.ownerProviderProfileId,
        referredProviderProfileId: profile.id,
        installSource: claim.installSource,
        platform: claim.platform,
      },
      select: referralAttributionSelect,
    });

    return referralAttributionView(attribution);
  }

  private async customerProfileForUser(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile was not found');
    }

    return profile;
  }

  private async partnerProfileForUser(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Partner profile was not found');
    }

    return profile;
  }
}

function referralCodeView(code: ReferralCodeRecord) {
  const audienceSlug = code.audience === ReferralAudience.PARTNER ? 'partner' : 'customer';

  return {
    ...code,
    sharePath: `/r/${audienceSlug}/${encodeURIComponent(code.code)}`,
  };
}

function referralAttributionView(attribution: ReferralAttributionRecord) {
  return attribution;
}

function normalizeReferralClaim(input: ClaimReferralCodeInput) {
  const code = normalizeRequiredText(input.code).toUpperCase();

  return {
    code,
    installSource: normalizeOptionalText(input.installSource),
    platform: normalizeOptionalText(input.platform),
  };
}

function normalizeRequiredText(value: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new BadRequestException('Referral code is required');
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function referralCodeForOwner(audience: ReferralAudience, ownerProfileId: string) {
  const prefix = audience === ReferralAudience.PARTNER ? 'HP' : 'HC';
  const digest = createHash('sha256')
    .update(`${audience}:${ownerProfileId}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  return `${prefix}${digest}`;
}
