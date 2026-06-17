'use client';

import { CheckCircle2, EyeOff, Flag } from 'lucide-react';

import { ClientActionDropdown, type ClientActionDropdownItem } from '../../components/client-action-dropdown';
import type { ReviewActionItem } from './review-page-actions';

type ReviewActionDropdownProps = {
  readonly actions: readonly ReviewActionItem[];
  readonly label: string;
};

const actionIcons = {
  'Follow-up': Flag,
  Hold: EyeOff,
  Publish: CheckCircle2,
} as const;

export function ReviewActionDropdown({ actions, label }: ReviewActionDropdownProps) {
  return (
    <ClientActionDropdown
      actions={actions.map(readReviewClientAction)}
      className="vuexy-review-action-dropdown"
      itemClassName={(item) => `vuexy-review-action-item is-${item.tone}`}
      label={label}
      menuClassName="vuexy-review-action-menu"
      triggerClassName="vuexy-review-action-trigger"
    />
  );
}

function readReviewClientAction(action: ReviewActionItem): ClientActionDropdownItem {
  return {
    description: action.description,
    disabled: action.disabled,
    href: action.href,
    icon: actionIcons[action.label as keyof typeof actionIcons] ?? Flag,
    label: action.label,
    tone: action.tone,
  };
}
