import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { ConfirmDialog, confirmDialogButtonClassName, confirmDialogButtonState } from './confirm-dialog';

const source = readFileSync('components/confirm-dialog.tsx', 'utf8');
const focusBoundarySource = readFileSync('components/confirm-dialog-focus-boundary.tsx', 'utf8');
const modalFocusSource = readFileSync('components/use-admin-modal-focus.ts', 'utf8');
const rootShellSource = readFileSync('components/admin-root-shell.tsx', 'utf8');

describe('ConfirmDialog', () => {
  it('maps confirm tone to stable pill classes', () => {
    expect(confirmDialogButtonClassName()).toBe('pill pill-danger');
    expect(confirmDialogButtonClassName('warning')).toBe('pill pill-warn');
    expect(confirmDialogButtonClassName('success')).toBe('pill pill-success');
    expect(confirmDialogButtonClassName('danger', { disabled: true })).toBe('pill pill-neutral');
    expect(confirmDialogButtonClassName('danger', { loading: true })).toBe('pill pill-neutral');
  });

  it('derives confirm button disabled state and label from loading state', () => {
    expect(confirmDialogButtonState({ confirmLabel: 'Confirm' })).toEqual({
      disabled: false,
      label: 'Confirm',
    });
    expect(confirmDialogButtonState({ confirmLabel: 'Confirm', disabled: true })).toEqual({
      disabled: true,
      label: 'Confirm',
    });
    expect(
      confirmDialogButtonState({ confirmLabel: 'Confirm', loading: true, loadingLabel: 'Saving...' }),
    ).toEqual({
      disabled: true,
      label: 'Saving...',
    });
  });

  it('renders a confirm form and cancel link without deciding business behavior', () => {
    const dialog = ConfirmDialog({
      action: '/bookings/booking-1/cancel',
      cancelHref: '/bookings/booking-1',
      confirmLabel: 'Confirm cancellation',
      description: 'The API will validate whether this booking can be cancelled.',
      hiddenInputs: [{ name: 'bookingId', value: 'booking-1' }],
      id: 'booking-cancel',
      supportingLinks: [
        {
          description: 'Open the audit trail before confirming.',
          href: '/audit-log?q=booking-1',
          label: 'Audit trail',
        },
      ],
      title: 'Cancel booking?',
      tone: 'warning',
    });

    const markup = renderToStaticMarkup(dialog);
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-describedby="booking-cancel-description"');
    expect(markup).toContain('aria-labelledby="booking-cancel-title"');
    expect(markup).toContain('id="booking-cancel-title"');
    expect(markup).toContain('class="muted confirm-dialog-description" id="booking-cancel-description"');
    expect(markup).toContain('href="/audit-log?q=booking-1"');
    expect(markup).toContain('title="Open the audit trail before confirming."');
    expect(markup).not.toContain('<p class="muted" id="booking-cancel-description"');
    expect(markup.indexOf('href="/bookings/booking-1"')).toBeLessThan(markup.indexOf('<form'));
  });

  it('uses the shared focus boundary and modal accessibility contract', () => {
    expect(source).toContain('ConfirmDialogFocusBoundary');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeButton');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('className="card admin-dialog-card"');
    expect(source).not.toContain('actions={<span className={statusBadgeClassName(tone)}>Review</span>}');
    expect(source).not.toContain('<Link className={statusBadgeClassName');
    expect(source).not.toContain('<button\\n            className={confirmDialogButtonClassName');
    expect(source).not.toContain('<div className="ops-section-header"');
    expect(focusBoundarySource).toContain('useAdminModalFocus');
    expect(focusBoundarySource).toContain('AdminDrawerBackdropButton');
    expect(focusBoundarySource).toContain('confirm-dialog-backdrop');
    expect(focusBoundarySource).toContain('ariaModal');
    expect(focusBoundarySource).toContain("window.sessionStorage.getItem('hands-admin-confirmation-return-focus')");
    expect(focusBoundarySource).toContain('window.history.back()');
    expect(focusBoundarySource).toContain('onClickCapture={handleCancelClick}');
    expect(focusBoundarySource).toContain('window.location.assign(cancelHref)');
    expect(modalFocusSource).toContain("event.key === 'Escape'");
    expect(modalFocusSource).toContain('disableModalBackground');
    expect(modalFocusSource).toContain('sibling.inert = true');
    expect(modalFocusSource).toContain('returnFocus?.focus()');
    expect(rootShellSource).toContain('rememberConfirmationTrigger');
    expect(rootShellSource).toContain(
      "link?.closest('details')?.querySelector<HTMLElement>(':scope > summary')",
    );
  });

  it('disables the confirm action while loading without changing the form action', () => {
    const dialog = ConfirmDialog({
      action: '/partners/partner-1/delete',
      cancelHref: '/partners/partner-1',
      confirmLabel: 'Delete Partner',
      description: 'This destructive action must still be validated by the API.',
      disabled: true,
      id: 'partner-delete',
      loading: true,
      loadingLabel: 'Deleting...',
      title: 'Delete Partner?',
    });

    const markup = renderToStaticMarkup(dialog);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('class="confirm-dialog-form"');
    expect(markup).toContain('action="/partners/partner-1/delete"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Deleting...');
    expect(markup).toContain('class="pill pill-neutral"');
  });

  it('renders optional text inputs inside the confirm form', () => {
    const dialog = ConfirmDialog({
      action: '/partners/partner-1/reject',
      cancelHref: '/partners',
      confirmLabel: 'Reject Partner',
      description: 'The API will validate the rejection reason.',
      id: 'partner-reject',
      textInputs: [
        {
          label: 'Reason',
          maxLength: 500,
          minLength: 12,
          name: 'reason',
          placeholder: 'Partner rejection reason',
          required: true,
        },
      ],
      title: 'Reject Partner?',
    });

    const markup = renderToStaticMarkup(dialog);

    expect(markup).toContain('class="admin-form-input admin-form-control-labeled confirm-dialog-label"');
    expect(markup).toContain('class="admin-form-label">Reason</span>');
    expect(markup).toContain('maxLength="500"');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('name="reason"');
    expect(markup).toContain('placeholder="Partner rejection reason"');
    expect(markup).toContain('required=""');
  });

  it('uses a validity-aware submit for evidence-gated confirmations', () => {
    const dialog = ConfirmDialog({
      action: '/notifications/review',
      cancelHref: '/notifications',
      confirmLabel: 'Mark reviewed',
      description: 'Evidence is required.',
      id: 'notification-review',
      requireValidForm: true,
      textInputs: [{ label: 'Evidence', minLength: 12, name: 'reason', required: true }],
      title: 'Mark notification reviewed?',
    });

    const markup = renderToStaticMarkup(dialog);
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('required=""');
    expect(source).toContain('ConfirmDialogValidSubmit');
    expect(source).toContain('requireValidForm ?');
  });

  it('renders optional shared select inputs inside the confirm form', () => {
    const dialog = ConfirmDialog({
      action: '/finance/reassign',
      cancelHref: '/notifications',
      confirmLabel: 'Reassign owner',
      description: 'The API validates Finance assignment authority.',
      id: 'finance-reassign',
      selectInputs: [
        {
          defaultValue: 'owner-2',
          label: 'Review owner',
          name: 'assigneeAdminId',
          options: [
            { label: 'Finance One', value: 'owner-1' },
            { label: 'Finance Two', value: 'owner-2' },
          ],
          required: true,
        },
      ],
      title: 'Reassign Finance review?',
    });

    const markup = renderToStaticMarkup(dialog);
    expect(markup).toContain('class="admin-form-select admin-form-control-labeled confirm-dialog-label"');
    expect(markup).toContain('name="assigneeAdminId"');
    expect(markup).toContain('<option value="owner-2" selected="">Finance Two</option>');
  });
});
