import { visibleReviewActionItems } from './review-row-actions';
import type { ReviewActionItem } from './review-page-actions';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('visibleReviewActionItems', () => {
  it('keeps only actionable review menu items', () => {
    const actions: ReviewActionItem[] = [
      action({ disabled: true, label: 'Publish' }),
      action({ disabled: false, label: 'Hold' }),
      action({ disabled: false, label: 'Follow-up' }),
    ];

    expect(visibleReviewActionItems(actions).map((item) => item.label)).toEqual(['Hold', 'Follow-up']);
  });

  it('uses shared form atoms for the edit review drawer fields', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('AdminFormSelect');
    expect(source).toContain('AdminFormTextarea');
    expect(source).toContain('AdminFormControlButton');
    expect(source).toContain('AdminDrawerFormGrid');
    expect(source).not.toContain('<form action={moderateReview} className="calendar-form-grid review-edit-drawer-form">');
    expect(source).not.toContain('<select defaultValue={String(editReview.rating)} name="rating">');
    expect(source).not.toContain('<textarea');
    expect(source).not.toContain('<button className="button button-primary" type="submit">');
    expect(source).not.toContain('<button className="button button-secondary" onClick={onClose} type="button">');
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
