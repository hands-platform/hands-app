import {
  reviewActionHrefWithReturnTo,
  reviewListReturnTo,
  visibleReviewActionItems,
} from './review-row-actions';
import type { ReviewActionItem } from './review-page-actions';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('visibleReviewActionItems', () => {
  it('keeps only actionable review menu items', () => {
    const actions: ReviewActionItem[] = [
      action({ disabled: true, label: 'Publish' }),
      action({ disabled: false, label: 'Hold' }),
      action({ disabled: false, label: 'Needs review' }),
    ];

    expect(visibleReviewActionItems(actions).map((item) => item.label)).toEqual(['Hold', 'Needs review']);
  });

  it('uses shared form atoms for the edit review drawer fields', () => {
    const source = readFileSync(join(process.cwd(), 'app/reviews/review-row-actions.tsx'), 'utf8');

    expect(source).toContain('AdminFormSelect');
    expect(source).toContain('AdminFormTextarea');
    expect(source).toContain('AdminFormControlButton');
    expect(source).toContain('AdminDrawerFormGrid');
    expect(source).toContain('admin-form-control-fluid');
    expect(source).toContain('admin-grid-span-2');
    expect(source).not.toContain('review-edit-form-field');
    expect(source).not.toContain('<form action={moderateReview} className="calendar-form-grid review-edit-drawer-form">');
    expect(source).not.toContain('<select defaultValue={String(editReview.rating)} name="rating">');
    expect(source).not.toContain('<textarea');
    expect(source).not.toContain('<button className="button button-primary" type="submit">');
    expect(source).not.toContain('<button className="button button-secondary" onClick={onClose} type="button">');
  });

  it('preserves list filters while removing action-only query fields', () => {
    const returnTo = reviewListReturnTo(
      '/reviews',
      'dateRange=30d&page=2&q=mai&sort=oldest&confirm=moderate&reviewId=review-1&notice=failed',
    );

    expect(returnTo).toBe('/reviews?dateRange=30d&page=2&q=mai&sort=oldest');
    expect(reviewActionHrefWithReturnTo(
      '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN',
      returnTo,
    )).toBe(
      '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN&returnTo=%2Freviews%3FdateRange%3D30d%26page%3D2%26q%3Dmai%26sort%3Doldest',
    );
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
