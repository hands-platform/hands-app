'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, EyeOff, Flag, Pencil, Save, Star, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { ClientActionDropdown, type ClientActionDropdownItem } from '../../components/client-action-dropdown';
import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminCard, AdminDrawerSurface } from '../../components/admin-surface';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';
import { moderateReview } from './actions';
import { safeReviewReturnTo } from './review-action-confirmation';
import type { ReviewActionItem } from './review-page-actions';

type ReviewEditModel = {
  readonly canEdit: boolean;
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
  'Needs review': Flag,
  Hide: EyeOff,
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
  const returnTo = reviewListReturnTo(pathname, search);
  const contextualActions = visibleReviewActionItems(actions).map((action) => ({
    ...action,
    href: reviewActionHrefWithReturnTo(action.href, returnTo),
  }));
  const visibleActions = reviewRowActionDropdownItems(
    contextualActions,
    editReview.canEdit,
    () => setEditing(true),
  );

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
        <ReviewEditDrawer
          editReview={editReview}
          onClose={() => setEditing(false)}
          returnTo={returnTo}
        />
      ) : null}
    </>
  );
}

export function visibleReviewActionItems(actions: readonly ReviewActionItem[]) {
  return actions.filter((action) => !action.disabled);
}

function reviewRowActionDropdownItems(
  actions: readonly ReviewActionItem[],
  canEdit: boolean,
  onEdit: () => void,
): readonly ClientActionDropdownItem[] {
  return [
    ...(canEdit
      ? [{
          description: 'Edit this admin-created review copy and rating.',
          icon: Pencil,
          label: 'Edit Review',
          onSelect: onEdit,
          tone: 'info' as const,
        }]
      : []),
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
  const drawerRef = useRef<HTMLElement>(null);
  useAdminModalFocus(drawerRef, onClose);

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
        surfaceRef={drawerRef}
        tabIndex={-1}
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
              <AdminFormInput
                className="admin-form-control-fluid admin-grid-span-2"
                label="Edit reason"
                labelVisibility="visible"
                maxLength={1000}
                minLength={3}
                name="reason"
                placeholder="Explain why this admin-created review is being changed."
                required={true}
              />
            </AdminCard>
            <AdminDrawerActionFooter className="review-edit-drawer-footer">
              <ReviewEditSubmitButton />
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

function ReviewEditSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AdminFormControlButton className="button-primary" disabled={pending} type="submit">
      <Save aria-hidden="true" size={16} />
      {pending ? 'Saving...' : 'Save admin-created review'}
    </AdminFormControlButton>
  );
}

export function reviewListReturnTo(pathname: string, search: string) {
  const safePathname = pathname === '/reviews' ? pathname : '/reviews';
  return safeReviewListReturnTo(`${safePathname}${search ? `?${search}` : ''}`);
}

export function reviewActionHrefWithReturnTo(href: string, returnTo: string) {
  const url = new URL(href, 'http://admin.local');
  const safeReturnTo = safeReviewListReturnTo(returnTo);
  const returnUrl = new URL(safeReturnTo, 'http://admin.local');
  for (const key of REVIEW_LIST_QUERY_KEYS) {
    const value = returnUrl.searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set('returnTo', safeReturnTo);
  return `${url.pathname}${url.search}`;
}

const REVIEW_LIST_QUERY_KEYS = [
  'q',
  'page',
  'pageSize',
  'review',
  'dateRange',
  'dateFrom',
  'dateTo',
  'sort',
] as const;

function safeReviewListReturnTo(value: string) {
  const safeReturnTo = safeReviewReturnTo(value);
  const url = new URL(safeReturnTo, 'http://admin.local');
  const params = new URLSearchParams();
  for (const key of REVIEW_LIST_QUERY_KEYS) {
    const param = url.searchParams.get(key);
    if (param) params.set(key, param);
  }
  const query = params.toString();
  return `/reviews${query ? `?${query}` : ''}`;
}
