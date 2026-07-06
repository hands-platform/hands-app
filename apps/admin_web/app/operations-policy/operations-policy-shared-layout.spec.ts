import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OPERATIONS_POLICY_SECTION_FILES = [
  'operations-policy-action-gate-checklist-section.tsx',
  'operations-policy-booking-create-gate-section.tsx',
  'operations-policy-drilldown-section.tsx',
  'operations-policy-enforcement-trace-section.tsx',
  'operations-policy-final-partner-choice-section.tsx',
  'operations-policy-live-simulator-section.tsx',
  'operations-policy-owner-decision-backlog-section.tsx',
  'operations-policy-outcome-effect-section.tsx',
  'operations-policy-recommended-value-review-section.tsx',
] as const;

describe('operations policy shared layout usage', () => {
  it('keeps task-card collections behind the shared Vuexy task grid', () => {
    const filesWithRawTaskGrid = OPERATIONS_POLICY_SECTION_FILES.filter((fileName) =>
      readOperationsPolicySection(fileName).includes('<div className="ops-task-grid admin-mt-14">'),
    );

    expect(filesWithRawTaskGrid).toEqual([]);
  });
});

function readOperationsPolicySection(fileName: string) {
  return readFileSync(join('app/operations-policy', fileName), 'utf8');
}
