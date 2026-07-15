import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260714111500_prevent_duplicate_payment_refunds/migration.sql',
  ),
  'utf8',
);

describe('payment refund uniqueness contract', () => {
  it('keeps one full refund row per payment in Prisma', () => {
    const refundModel = schemaSource.match(/model Refund\s+\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(refundModel).toMatch(/paymentId\s+String\s+@unique/);
    expect(refundModel).not.toContain('@@index([paymentId, createdAt])');
  });

  it('fails closed on legacy duplicates before creating the unique index', () => {
    expect(migrationSource).toContain('HAVING COUNT(*) > 1');
    expect(migrationSource).toContain('RAISE EXCEPTION');
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "Refund_paymentId_key"');
    expect(migrationSource).not.toMatch(/DELETE\s+FROM\s+"Refund"/i);
  });
});
