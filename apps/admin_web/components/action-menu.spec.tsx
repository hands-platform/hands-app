import { ActionMenu, actionMenuItemClassName } from './action-menu';

describe('ActionMenu', () => {
  it('maps disabled and danger actions to stable pill classes', () => {
    expect(actionMenuItemClassName({ disabled: true, tone: 'danger' })).toBe('pill pill-neutral');
    expect(actionMenuItemClassName({ tone: 'danger' })).toBe('pill pill-danger');
    expect(actionMenuItemClassName({})).toBe('pill pill-info');
  });

  it('renders link and submit actions without deciding business behavior', () => {
    const menu = ActionMenu({
      actions: [
        {
          href: '/partners/partner-1',
          kind: 'link',
          label: 'Open Partner',
        },
        {
          action: '/bookings/booking-1/review',
          hiddenInputs: [{ name: 'bookingId', value: 'booking-1' }],
          kind: 'submit',
          label: 'Request API review',
          tone: 'warning',
        },
      ],
      label: 'Partner row actions',
      title: 'Actions',
    });

    expect(menu.type).toBe('nav');
    expect(menu.props).toMatchObject({
      'aria-label': 'Partner row actions',
      className: 'action-menu',
    });
    expect(menu.props.children).toHaveLength(2);
  });
});
