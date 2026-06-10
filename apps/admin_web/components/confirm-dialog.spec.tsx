import { ConfirmDialog, confirmDialogButtonClassName } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('maps confirm tone to stable pill classes', () => {
    expect(confirmDialogButtonClassName()).toBe('pill pill-danger');
    expect(confirmDialogButtonClassName('warning')).toBe('pill pill-warn');
    expect(confirmDialogButtonClassName('success')).toBe('pill pill-success');
    expect(confirmDialogButtonClassName('danger', { disabled: true })).toBe('pill pill-neutral');
    expect(confirmDialogButtonClassName('danger', { loading: true })).toBe('pill pill-neutral');
  });

  it('renders a confirm form and cancel link without deciding business behavior', () => {
    const dialog = ConfirmDialog({
      action: '/bookings/booking-1/cancel',
      cancelHref: '/bookings/booking-1',
      confirmLabel: 'Confirm cancellation',
      description: 'The API will validate whether this booking can be cancelled.',
      hiddenInputs: [{ name: 'bookingId', value: 'booking-1' }],
      id: 'booking-cancel',
      title: 'Cancel booking?',
      tone: 'warning',
    });

    expect(dialog.type).toBe('section');
    expect(dialog.props).toMatchObject({
      'aria-describedby': 'booking-cancel-description',
      'aria-labelledby': 'booking-cancel-title',
      className: 'card',
      role: 'alertdialog',
    });
    expect(dialog.props.children).toHaveLength(2);
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

    expect(dialog.props).toMatchObject({
      'aria-busy': true,
    });

    const actions = dialog.props.children[1];
    const form = actions.props.children[0];
    const button = form.props.children[2];

    expect(form.props.action).toBe('/partners/partner-1/delete');
    expect(button.props).toMatchObject({
      className: 'pill pill-neutral',
      disabled: true,
      type: 'submit',
    });
    expect(button.props.children).toBe('Deleting...');
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

    const actions = dialog.props.children[1];
    const form = actions.props.children[0];
    const textInputLabels = form.props.children[1];
    const input = textInputLabels[0].props.children[1];

    expect(input.props).toMatchObject({
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Partner rejection reason',
      required: true,
    });
  });
});
