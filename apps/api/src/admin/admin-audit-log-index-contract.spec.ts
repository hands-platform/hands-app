import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260714025000_add_admin_audit_log_action_created_at_index/migration.sql',
  ),
  'utf8',
);
const hardeningMigrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260812103000_harden_admin_audit_log/migration.sql',
  ),
  'utf8',
);
const adminServiceSource = readFileSync(resolve(root, 'apps/api/src/admin/admin.service.ts'), 'utf8');

describe('Admin audit log query index contract', () => {
  it('keeps the action and createdAt index in the Prisma source of truth', () => {
    const block = schemaSource.match(/model AdminAuditLog\s+\{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(block).toContain('@@index([action, createdAt])');
  });

  it('ships the matching non-destructive database index migration', () => {
    expect(migrationSource).toContain('CREATE INDEX "AdminAuditLog_action_createdAt_idx"');
    expect(migrationSource).toContain('ON "AdminAuditLog"("action", "createdAt")');
    expect(migrationSource).not.toContain('DROP TABLE');
  });

  it('enforces insert preparation, recursive redaction, hashing and append-only storage', () => {
    expect(hardeningMigrationSource).toContain('CREATE OR REPLACE FUNCTION hands_audit_redact_jsonb');
    expect(hardeningMigrationSource).toContain("THEN to_jsonb('[REDACTED]'::TEXT)");
    expect(hardeningMigrationSource).toContain('CREATE TRIGGER "AdminAuditLog_prepare_insert"');
    expect(hardeningMigrationSource).toContain("digest(convert_to(normalized_payload::TEXT, 'UTF8'), 'sha256')");
    expect(hardeningMigrationSource).toContain('BEFORE UPDATE OR DELETE ON "AdminAuditLog"');
    expect(hardeningMigrationSource).toContain('write a correction event instead');
    expect(hardeningMigrationSource).toContain('GENERATED ALWAYS AS (COALESCE("occurredAt", "createdAt")) STORED');
    expect(hardeningMigrationSource).toContain('CREATE INDEX "AdminAuditLog_timelineAt_id_idx"');
    expect(hardeningMigrationSource).not.toContain('UPDATE "AdminAuditLog"');
    expect(hardeningMigrationSource).not.toContain('DELETE FROM "AdminAuditLog"');
  });

  it('keeps application code free from audit-row update and delete paths', () => {
    expect(adminServiceSource).not.toMatch(/adminAuditLog\.(?:update|updateMany|delete|deleteMany)\s*\(/);
    expect(schemaSource).toContain('correctionOfEventId');
    expect(schemaSource).toContain('payloadHash');
  });
});
