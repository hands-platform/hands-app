import { readFileSync } from 'node:fs';
import path from 'node:path';

const standardEmptyStateFiles = [
  'partner-detail-acceptance-unblock-playbook-section.tsx',
  'partner-detail-booking-gate-decision-section.tsx',
  'partner-detail-booking-gate-evidence-section.tsx',
  'partner-detail-cash-debt-origin-section.tsx',
  'partner-detail-operating-checklist-section.tsx',
  'partner-detail-operations-digest-section.tsx',
] as const;

describe('partner detail standard empty-state manifest', () => {
  it('keeps standard table empty states on the shared AdminEmptyState component', () => {
    const localEmptyStateFunctions = standardEmptyStateFiles.flatMap((fileName) => {
      const source = readFileSync(path.join(__dirname, fileName), 'utf8');
      const matches = source.match(/function\s+\w*EmptyState\s*\(/gu) ?? [];

      return matches.map((match) => `${fileName}: ${match}`);
    });

    expect(localEmptyStateFunctions).toEqual([]);
  });
});
