import { Prisma } from '@prisma/client';

export const DEFAULT_PROVIDER_WALLET_CURRENCY = 'VND';

export async function lockProviderWalletLedger(
  client: Prisma.TransactionClient,
  providerProfileId: string,
  currency = DEFAULT_PROVIDER_WALLET_CURRENCY,
) {
  await client.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${providerProfileId}:${currency}`}, 0))::text AS "lockResult"`,
  );
}
