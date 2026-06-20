'use client';

import Link from 'next/link';
import { CheckCircle2, EyeOff, Flag, MoreVertical, Pencil, Save, Star, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { moderateReview } from './actions';
import type { ReviewActionItem } from './review-page-actions';

type ReviewEditModel = {
  readonly bookingHref: string | null;
  readonly bookingLabel: string;
  readonly commentLabel: string;
  readonly commentValue: string;
  readonly customerLabel: string;
  readonly partnerLabel: string;
  readonly rating: number;
  readonly ratingLabel: string;
  readonly reportReasonValue: string;
  readonly requestTimeLabel: string;
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
  const rootRef = useRef<HTMLDivElement>(null);

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
            {actions.map((action) => (
              <ReviewActionLink action={action} key={action.label} onSelect={() => setOpen(false)} />
            ))}
          </div>
        ) : null}
      </div>

      {editing ? <ReviewEditDrawer editReview={editReview} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function ReviewActionLink({
  action,
  onSelect,
}: {
  readonly action: ReviewActionItem;
  readonly onSelect: () => void;
}) {
  const Icon = actionIcons[action.label as keyof typeof actionIcons] ?? Flag;
  const className = `admin-action-item vuexy-review-action-item is-${action.tone}${
    action.disabled ? ' is-disabled' : ''
  }`;
  const content = (
    <>
      <Icon aria-hidden="true" size={16} />
      <span>{action.label}</span>
    </>
  );

  if (action.disabled) {
    return (
      <span aria-disabled="true" className={className} role="menuitem" title={action.description}>
        {content}
      </span>
    );
  }

  return (
    <Link className={className} href={action.href} onClick={onSelect} role="menuitem" title={action.description}>
      {content}
    </Link>
  );
}

function ReviewEditDrawer({
  editReview,
  onClose,
}: {
  readonly editReview: ReviewEditModel;
  readonly onClose: () => void;
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
      <aside aria-labelledby={titleId} aria-modal="true" className="calendar-drawer review-edit-drawer" role="dialog">
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Review moderation</span>
            <h2 id={titleId}>Edit Review</h2>
          </div>
          <button aria-label="Close review editor" className="button button-secondary" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="calendar-drawer-body review-edit-drawer-body">
          <section className="review-edit-original-card" aria-label="Original review">
            <div className="review-edit-original-header">
              <span className="pill pill-info">Original review</span>
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
            <p>{editReview.commentLabel}</p>
            <dl className="review-edit-original-meta">
              <div>
                <dt>Booking</dt>
                <dd>
                  {editReview.bookingHref ? (
                    <Link href={editReview.bookingHref}>{editReview.bookingLabel}</Link>
                  ) : (
                    editReview.bookingLabel
                  )}
                </dd>
              </div>
              <div>
                <dt>Request Time</dt>
                <dd>{editReview.requestTimeLabel}</dd>
              </div>
              <div>
                <dt>Partner</dt>
                <dd>{editReview.partnerLabel}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{editReview.customerLabel}</dd>
              </div>
            </dl>
          </section>

          <form action={moderateReview} className="calendar-form-grid review-edit-drawer-form">
            <input name="reviewId" type="hidden" value={editReview.reviewId} />
            <input name="status" type="hidden" value={editReview.status} />
            <input name="reportReason" type="hidden" value={editReview.reportReasonValue} />
            <label className="calendar-field">
              <span>Revised rating</span>
              <select defaultValue={String(editReview.rating)} name="rating">
                {reviewRatingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="calendar-field calendar-field-wide">
              <span>Revised review content</span>
              <textarea
                defaultValue={editReview.commentValue}
                name="comment"
                placeholder="Write the review copy that should be shown across the admin and app surfaces."
                rows={6}
              />
            </label>
            <div className="calendar-drawer-footer review-edit-drawer-footer">
              <button className="button button-primary" type="submit">
                <Save aria-hidden="true" size={16} />
                Save review
              </button>
              <button className="button button-secondary" onClick={onClose} type="button">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
