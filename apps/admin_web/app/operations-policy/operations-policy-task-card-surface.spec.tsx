import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OPERATIONS_POLICY_TASK_CARD_FILES = [
  'operations-policy-action-gate-checklist-section.tsx',
  'operations-policy-authority-baseline-section.tsx',
  'operations-policy-change-impact-section.tsx',
  'operations-policy-drilldown-section.tsx',
  'operations-policy-enforcement-trace-section.tsx',
  'operations-policy-final-partner-choice-section.tsx',
  'operations-policy-outcome-effect-section.tsx',
  'operations-policy-owner-decision-backlog-section.tsx',
  'operations-policy-recommended-value-review-section.tsx',
] as const;

describe('operations policy Vuexy task card surfaces', () => {
  it.each(OPERATIONS_POLICY_TASK_CARD_FILES)('%s uses shared task card components', (fileName) => {
    const source = readFileSync(join(process.cwd(), 'app/operations-policy', fileName), 'utf8');

    expect(source).toMatch(/Admin(?:Action|Task)Card/);
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('className="ops-task-card');
  });
});
