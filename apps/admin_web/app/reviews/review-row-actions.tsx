'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, EyeOff, Flag, MoreVertical, Pencil, Save, Star, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminCard } from '../../components/admin-surface';
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
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const search = searchParams.toString();
  const returnTo = `${pathname}${search ? `?${search}` : ''}`;
  const visibleActions = visibleReviewActionItems(actions);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <div className="admin-action-dropdown vuexy-review-action-dropdown" ref={rootRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          className="admin-action-trigger vuexy-review-action-trigger"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <MoreVertical aria-hidden="true" size={20} />
        </button>
        {open ? (
          <div className="admin-action-menu vuexy-review-action-menu" role="menu">
            <button
              className="admin-action-item vuexy-review-action-item is-info vuexy-review-edit-action"
              onClick={() => {
                setEditing(true);
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <Pencil aria-hidden="true" size={16} />
              <span>Edit Review</span>
            </button>
            {visibleActions.map((action) => (
              <ReviewActionLink action={action} key={action.label} onSelect={() => setOpen(false)} />
            ))}
          </div>
        ) : null}
      </div>

      {editing ? (
        <ReviewEditDrawer editReview={editReview} onClose={() => setEditing(false)} returnTo={returnTo} />
      ) : null}
    </>
  );
}

export function visibleReviewActionItems(actions: readonly ReviewActionItem[]) {
  return actions.filter((action) => !action.disabled);
}

function ReviewActionLink({
  action,
  onSelect,
}: {
  readonly action: ReviewActionItem;
  readonly onSelect: () => void;
}) {
  const Icon = actionIcons[action.label as keyof typeof actionIcons] ?? Flag;

  return (
    <Link
      className={`admin-action-item vuexy-review-action-item is-${action.tone}`}
      href={action.href}
      onClick={onSelect}
      role="menuitem"
      title={action.description}
    >
      <Icon aria-hidden="true" size={16} />
      <span>{action.label}</span>
    </Link>
  );
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
      <button
        aria-label="Close review editor"
        className="calendar-drawer-backdrop review-edit-drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="calendar-drawer review-edit-drawer"
        role="dialog"
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Review moderation</span>
            <h2 id={titleId}>Edit Review</h2>
          </div>
          <button
            aria-label="Close review editor"
            className="button-secondary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
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
                className="review-edit-form-field"
                defaultValue={String(editReview.rating)}
                label="Revised rating"
                labelVisibility="visible"
                name="rating"
                options={reviewRatingOptions}
              />
              <AdminFormTextarea
                className="review-edit-form-field review-edit-form-field-wide"
                defaultValue={editReview.commentValue}
                label="Revised review content"
                labelVisibility="visible"
                name="comment"
                placeholder="Write the review copy that should be shown across the admin and app surfaces."
                rows={7}
              />
            </AdminCard>
            <div className="calendar-drawer-footer review-edit-drawer-footer">
              <AdminFormControlButton className="button-primary" type="submit">
                <Save aria-hidden="true" size={16} />
                Save review
              </AdminFormControlButton>
              <AdminFormControlButton className="button-secondary" onClick={onClose} type="button">
                Cancel
              </AdminFormControlButton>
            </div>
          </AdminDrawerFormGrid>
        </div>
      </aside>
    </>
  );
}
