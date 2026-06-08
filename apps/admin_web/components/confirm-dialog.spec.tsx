import { ConfirmDialog, confirmDialogButtonClassName } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('maps confirm tone to stable pill classes', () => {
    expect(confirmDialogButtonClassName()).toBe('pill pill-danger');
    expect(confirmDialogButtonClassName('warning')).toBe('pill pill-warn');
    expect(confirmDialogButtonClassName('success')).toBe('pill pill-success');
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
});
