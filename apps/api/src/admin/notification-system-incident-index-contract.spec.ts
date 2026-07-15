import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260714074000_add_notification_system_incident_index/migration.sql',
  ),
  'utf8',
);

describe('Notification system incident query index contract', () => {
  it('documents the migration-only partial index next to the Prisma model', () => {
    const block = schemaSource.match(/model Notification\s+\{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(block).toContain('partial index for Admin system incident date queries');
    expect(block).toContain('20260714074000 because Prisma 6 cannot express partial-index predicates');
  });

  it('ships the matching non-destructive database index migration', () => {
    expect(migrationSource).toContain('CREATE INDEX "Notification_systemIncident_createdAt_idx"');
    expect(migrationSource).toContain('ON "Notification"("createdAt")');
    expect(migrationSource).toContain(`WHERE "type" LIKE 'admin.system.%'`);
    expect(migrationSource).toContain('Prisma 6 cannot represent partial-index predicates');
    expect(migrationSource).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migrationSource).not.toContain('DELETE FROM');
  });
});
