import { ActionMenu, actionMenuItemClassName, readActionMenuTitle } from './action-menu';

describe('ActionMenu', () => {
  it('maps disabled and danger actions to stable pill classes', () => {
    expect(actionMenuItemClassName({ disabled: true, tone: 'danger' })).toBe('pill pill-neutral');
    expect(actionMenuItemClassName({ tone: 'danger' })).toBe('pill pill-danger');
    expect(actionMenuItemClassName({})).toBe('pill pill-info');
  });

  it('uses string descriptions as native titles only', () => {
    expect(readActionMenuTitle('Review booking')).toBe('Review booking');
    expect(readActionMenuTitle(<span>Review booking</span>)).toBeUndefined();
    expect(readActionMenuTitle(undefined)).toBeUndefined();
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

  it('can render link and submit actions as a Vuexy-style dropdown', () => {
    const menu = ActionMenu({
      actions: [
        {
          href: '/notifications?confirm=retry&notificationId=notification-1',
          kind: 'link',
          label: 'Retry send',
        },
        {
          action: '/notifications/review',
          disabled: true,
          hiddenInputs: [{ name: 'notificationId', value: 'notification-1' }],
          kind: 'submit',
          label: 'Request review',
          tone: 'warning',
        },
      ],
      label: 'Notification row actions',
      variant: 'dropdown',
    });

    expect(menu.type).toBe('details');
    expect(menu.props.className).toBe('admin-action-dropdown action-menu-dropdown');
    expect(classNamesIn(menu)).toEqual(
      expect.arrayContaining([
        'admin-action-trigger action-menu-trigger',
        'admin-action-menu action-menu-panel',
        'admin-action-item',
        'admin-action-form',
        'admin-action-item admin-action-button',
      ]),
    );
  });
});

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
