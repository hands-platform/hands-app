import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const apiRoot = resolve(__dirname, '../..');

describe('partner wallet withdrawal idempotency contract', () => {
  it('keeps the Partner-scoped request key unique at the database boundary', () => {
    const schema = readFileSync(resolve(apiRoot, 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(
      resolve(
        apiRoot,
        'prisma/migrations/20260816163000_add_provider_withdrawal_idempotency/migration.sql',
      ),
      'utf8',
    );

    expect(schema).toContain('@@unique([providerProfileId, idempotencyKey])');
    expect(migration).toContain(
      'ON "ProviderWalletWithdrawalRequest"("providerProfileId", "idempotencyKey")',
    );
  });
});
