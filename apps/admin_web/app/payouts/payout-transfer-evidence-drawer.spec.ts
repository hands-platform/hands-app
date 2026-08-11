import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('payout transfer evidence drawer', () => {
  const drawerSource = readFileSync(
    join(process.cwd(), 'app/payouts/payout-transfer-evidence-drawer.tsx'),
    'utf8',
  );
  const listSource = readFileSync(
    join(process.cwd(), 'app/payouts/payout-batch-list-section.tsx'),
    'utf8',
  );
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

  it('uses the shared accessible drawer contract and preserves scroll on close', () => {
    expect(drawerSource).toContain("'use client'");
    expect(drawerSource).toContain('AdminDrawerBackdropButton');
    expect(drawerSource).toContain('AdminDrawerSurface');
    expect(drawerSource).toContain('useAdminModalFocus(drawerRef, onClose)');
    expect(drawerSource).toContain("router.replace(closeHref, { scroll: false })");
    expect(drawerSource).toContain('ariaModal');
  });

  it('keeps one evidence form with immutable context and full-id reconfirmation', () => {
    expect(drawerSource.match(/<AdminDrawerFormGrid/g)).toHaveLength(1);
    expect(drawerSource).toContain('Selected payout transfer context');
    expect(drawerSource).toContain('name="expectedStatus"');
    expect(drawerSource).toContain('name="expectedTransferRef"');
    expect(drawerSource).toContain('name="expectedNotes"');
    expect(drawerSource).toContain('name="confirmationPayoutBatchId"');
    expect(drawerSource).toContain('minLength={10}');
  });

  it('removes the old inline editor and keeps compact table widths', () => {
    expect(listSource).toContain('PayoutTransferEvidenceDrawer');
    expect(listSource).not.toContain('Selected payout transfer');
    expect(listSource).not.toContain('AdminTraceSummary');
    expect(css).toContain('min-width: 980px;');
    expect(css).toContain('min-width: 940px;');
    expect(css).not.toContain('.payout-batch-list-card .admin-table-scroll .table {\n  min-width: 1380px;');
  });
});
