import { visibleReviewActionItems } from './review-row-actions';
import type { ReviewActionItem } from './review-page-actions';

describe('visibleReviewActionItems', () => {
  it('keeps only actionable review menu items', () => {
    const actions: ReviewActionItem[] = [
      action({ disabled: true, label: 'Publish' }),
      action({ disabled: false, label: 'Hold' }),
      action({ disabled: false, label: 'Follow-up' }),
    ];

    expect(visibleReviewActionItems(actions).map((item) => item.label)).toEqual(['Hold', 'Follow-up']);
  });
});

function action(input: Pick<ReviewActionItem, 'disabled' | 'label'>): ReviewActionItem {
  return {
    description: `${input.label} action`,
    disabled: input.disabled,
    href: `/reviews?action=${input.label}`,
    kind: 'link',
    label: input.label,
    tone: 'info',
  };
}
