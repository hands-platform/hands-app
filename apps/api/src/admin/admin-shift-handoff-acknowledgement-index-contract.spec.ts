import { readFileSync } from 'node:fs';

const migrationSource = readFileSync(
  new URL(
    '../../prisma/migrations/20260807190000_add_shift_handoff_acknowledgement_uniqueness/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('Shift handoff acknowledgement uniqueness contract', () => {
  it('keeps one acknowledgement target unique at the database boundary', () => {
    expect(migrationSource).toContain(
      'CREATE UNIQUE INDEX "AdminAuditLog_shift_handoff_acknowledgement_target_key"',
    );
    expect(migrationSource).toContain('ON "AdminAuditLog" ("target")');
    expect(migrationSource).toContain(
      "WHERE \"action\" = 'operations.shift_handoff.acknowledge'",
    );
  });
});
