import { OperationsPolicyActionGateChecklistSection } from './operations-policy-action-gate-checklist-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyActionGateChecklistSection', () => {
  it('renders policy checklist summary and action cards', () => {
    const section = OperationsPolicyActionGateChecklistSection({
      checklist: {
        alignedCount: 1,
        totalCount: 2,
        summary: [
          {
            label: 'Recommended posture',
            value: '1/2',
            helper: 'Policies aligned with current MVP operating rules.',
          },
        ],
        cards: [
          {
            className: 'ops-task-warning',
            current: 'Owner selected batch',
            detail: 'Positive partner earnings should move through payout batches.',
            href: '/operations-policy#policy-payout-batch-cycle-policy',
            operatorAction: 'Use payout batches with transfer references.',
            pillClass: 'pill-warn',
            status: 'Owner override',
            title: 'Payout batch cycle',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Action gate policy checklist');
    expect(rendered).toContain('1 / 2 recommended');
    expect(rendered).toContain('Payout batch cycle');
    expect(rendered).toContain('Current: Owner selected batch');
    expect(hrefsIn(section)).toContain('/operations-policy#policy-payout-batch-cycle-policy');
  });
});
