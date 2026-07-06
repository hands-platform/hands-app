'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, EyeOff, Flag, Pencil, Save, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ClientActionDropdown, type ClientActionDropdownItem } from '../../components/client-action-dropdown';
import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminCard, AdminDrawerSurface } from '../../components/admin-surface';
import { moderateReview } from './actions';
import type { ReviewActionItem } from './review-page-actions';

type ReviewEditModel = {
  readonly commentLabel: string;
  readonly commentValue: string;
  readonly rating: number;
  readonly ratingLabel: string;
  readonly reportReasonValue: string;
  readonly reviewId: string;
  readonly status: string;
};

type ReviewRowActionsProps = {
  readonly actions: readonly ReviewActionItem[];
  readonly editReview: ReviewEditModel;
  readonly label: string;
};

const actionIcons = {
  'Follow-up': Flag,
  Hold: EyeOff,
  Publish: CheckCircle2,
} as const;

const reviewRatingOptions = [5, 4, 3, 2, 1].map((rating) => ({
  label: `${rating} star${rating === 1 ? '' : 's'}`,
  value: String(rating),
}));

export function ReviewRowActions({ actions, editReview, label }: ReviewRowActionsProps) {
  const [editing, setEditing] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const returnTo = `${pathname}${search ? `?${search}` : ''}`;
  const visibleActions = reviewRowActionDropdownItems(visibleReviewActionItems(actions), () => setEditing(true));

  return (
    <>
      <ClientActionDropdown
        actions={visibleActions}
        className="vuexy-review-action-dropdown"
        itemClassName={reviewRowActionDropdownItemClassName}
        label={label}
        menuClassName="vuexy-review-action-menu"
        triggerClassName="vuexy-review-action-trigger"
      />

      {editing ? (
        <ReviewEditDrawer editReview={editReview} onClose={() => setEditing(false)} returnTo={returnTo} />
      ) : null}
    </>
  );
}

export function visibleReviewActionItems(actions: readonly ReviewActionItem[]) {
  return actions.filter((action) => !action.disabled);
}

function reviewRowActionDropdownItems(
  actions: readonly ReviewActionItem[],
  onEdit: () => void,
): readonly ClientActionDropdownItem[] {
  return [
    {
      description: 'Edit retained review copy and rating.',
      icon: Pencil,
      label: 'Edit Review',
      onSelect: onEdit,
      tone: 'info',
    },
    ...actions.map((action) => ({
      description: action.description,
      href: action.href,
      icon: actionIcons[action.label as keyof typeof actionIcons] ?? Flag,
      label: action.label,
      tone: action.tone,
    })),
  ];
}

function reviewRowActionDropdownItemClassName(item: ClientActionDropdownItem) {
  return [
    'vuexy-review-action-item',
    item.tone ? `is-${item.tone}` : undefined,
    item.label === 'Edit Review' ? 'vuexy-review-edit-action' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

function ReviewEditDrawer({
  editReview,
  onClose,
  returnTo,
}: {
  readonly editReview: ReviewEditModel;
  readonly onClose: () => void;
  readonly returnTo: string;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const titleId = `review-edit-title-${editReview.reviewId}`;

  return (
    <>
      <AdminDrawerBackdropButton
        aria-label="Close review editor"
        className="review-edit-drawer-backdrop"
        onClick={onClose}
      />
      <AdminDrawerSurface
        ariaLabel="Review editor"
        ariaLabelledBy={titleId}
        ariaModal={true}
        className="calendar-drawer review-edit-drawer"
        role="dialog"
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Review moderation</span>
            <h2 id={titleId}>Edit Review</h2>
          </div>
          <AdminFormControlButton
            aria-label="Close review editor"
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            title="Close review editor"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlButton>
        </div>

        <div className="calendar-drawer-body review-edit-drawer-body">
          <AdminCard ariaLabel="Original review" className="review-edit-original-card">
            <div className="review-edit-original-header">
              <div>
                <span className="calendar-drawer-eyebrow">Original review</span>
                <strong>Current app copy</strong>
              </div>
              <div aria-label={`Original rating ${editReview.ratingLabel}`} className="vuexy-review-stars">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    aria-hidden="true"
                    className={index < editReview.rating ? 'is-filled' : ''}
                    key={`${editReview.reviewId}-original-star-${index}`}
                    size={16}
                  />
                ))}
              </div>
            </div>
            <blockquote className="review-edit-original-copy">{editReview.commentLabel}</blockquote>
          </AdminCard>

          <AdminDrawerFormGrid action={moderateReview} className="review-edit-drawer-form">
            <input name="reviewId" type="hidden" value={editReview.reviewId} />
            <input name="status" type="hidden" value={editReview.status} />
            <input name="reportReason" type="hidden" value={editReview.reportReasonValue} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <AdminCard ariaLabel="Revised review" className="review-edit-form-card">
              <div className="review-edit-section-heading">
                <span className="calendar-drawer-eyebrow">Replacement</span>
                <strong>Edited review</strong>
              </div>
              <AdminFormSelect
                className="admin-form-control-fluid"
                defaultValue={String(editReview.rating)}
                label="Revised rating"
                labelVisibility="visible"
                name="rating"
                options={reviewRatingOptions}
              />
              <AdminFormTextarea
                className="admin-form-control-fluid admin-grid-span-2"
                defaultValue={editReview.commentValue}
                label="Revised review content"
                labelVisibility="visible"
                name="comment"
                placeholder="Write the review copy that should be shown across the admin and app surfaces."
                rows={7}
              />
            </AdminCard>
            <AdminDrawerActionFooter className="review-edit-drawer-footer">
              <AdminFormControlButton className="button-primary" type="submit">
                <Save aria-hidden="true" size={16} />
                Save review
              </AdminFormControlButton>
              <AdminFormControlButton className="button-secondary" onClick={onClose} type="button">
                Cancel
              </AdminFormControlButton>
            </AdminDrawerActionFooter>
          </AdminDrawerFormGrid>
        </div>
      </AdminDrawerSurface>
    </>
  );
}
