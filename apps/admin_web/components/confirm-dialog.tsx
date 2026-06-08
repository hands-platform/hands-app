import Link from 'next/link';
import type { ReactNode } from 'react';

import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

type FormAction = string | ((formData: FormData) => void | Promise<void>);

type ConfirmDialogHiddenInput = {
  readonly name: string;
  readonly value: boolean | number | string;
};

type ConfirmDialogProps = {
  readonly action: FormAction;
  readonly cancelHref: string;
  readonly cancelLabel?: string;
  readonly confirmLabel: string;
  readonly description: ReactNode;
  readonly hiddenInputs?: readonly ConfirmDialogHiddenInput[];
  readonly id: string;
  readonly title: string;
  readonly tone?: StatusBadgeTone;
};

export function confirmDialogButtonClassName(tone: StatusBadgeTone = 'danger') {
  return statusBadgeClassName(tone);
}

export function ConfirmDialog({
  action,
  cancelHref,
  cancelLabel = 'Cancel',
  confirmLabel,
  description,
  hiddenInputs = [],
  id,
  title,
  tone = 'danger',
}: ConfirmDialogProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <section aria-describedby={descriptionId} aria-labelledby={titleId} className="card" role="alertdialog">
      <div className="ops-section-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="muted" id={descriptionId}>
            {description}
          </p>
        </div>
        <span className={statusBadgeClassName(tone)}>Review</span>
      </div>
      <div className="actions" style={{ marginTop: 12 }}>
        <form action={action} style={{ display: 'inline' }}>
          {hiddenInputs.map((input) => (
            <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
          ))}
          <button className={confirmDialogButtonClassName(tone)} type="submit">
            {confirmLabel}
          </button>
        </form>
        <Link className={statusBadgeClassName('neutral')} href={cancelHref}>
          {cancelLabel}
        </Link>
      </div>
    </section>
  );
}
