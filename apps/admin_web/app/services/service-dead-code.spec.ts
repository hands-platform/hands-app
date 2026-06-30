import { existsSync } from 'node:fs';
import { join } from 'node:path';

const legacyServiceEditorFiles = [
  'service-create-forms-section.tsx',
  'service-create-forms-section.spec.tsx',
  'service-group-edit-card.tsx',
  'service-group-edit-grid-section.tsx',
  'service-option-edit-form.tsx',
  'service-payout-rules-section.tsx',
  'service-payout-rules-section.spec.tsx',
] as const;

describe('service catalog dead code guard', () => {
  it('keeps the old raw-input service editor modules removed from the active admin app', () => {
    const servicesDir = join(process.cwd(), 'app/services');
    const existingLegacyFiles = legacyServiceEditorFiles.filter((fileName) =>
      existsSync(join(servicesDir, fileName)),
    );

    expect(existingLegacyFiles).toEqual([]);
  });
});
