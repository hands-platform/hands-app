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
});
