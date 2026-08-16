import type { Prisma } from '@prisma/client';

export const REFERRAL_ADMIN_SMOKE_MARKER = 'referral-admin';

const referralAdminSmokeJsonFilter = {
  path: ['smoke'],
  equals: REFERRAL_ADMIN_SMOKE_MARKER,
} as const;

export const referralAdminFixtureAttributionWhere = {
  OR: [
    { metadata: referralAdminSmokeJsonFilter },
    { referralCode: { metadata: referralAdminSmokeJsonFilter } },
  ],
} satisfies Prisma.ReferralAttributionWhereInput;

export const referralAdminFixtureRewardWhere = {
  OR: [
    { metadata: referralAdminSmokeJsonFilter },
    { attribution: referralAdminFixtureAttributionWhere },
  ],
} satisfies Prisma.ReferralRewardWhereInput;

export function isReferralAdminFixtureMetadata(metadata: Prisma.JsonValue | null | undefined) {
  return (
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    metadata.smoke === REFERRAL_ADMIN_SMOKE_MARKER
  );
}

export function isReferralRewardFixture(reward: {
  metadata?: Prisma.JsonValue | null;
  attribution?: {
    metadata?: Prisma.JsonValue | null;
    referralCode?: { metadata?: Prisma.JsonValue | null } | null;
  } | null;
}) {
  return (
    isReferralAdminFixtureMetadata(reward.metadata) ||
    isReferralAdminFixtureMetadata(reward.attribution?.metadata) ||
    isReferralAdminFixtureMetadata(reward.attribution?.referralCode?.metadata)
  );
}
