import { readFileSync } from 'node:fs';

import { ActionMenu, ActionMenuDropdownSurface, actionMenuItemClassName, readActionMenuTitle } from './action-menu';

const source = readFileSync('components/action-menu.tsx', 'utf8');

describe('ActionMenu', () => {
  it('maps disabled and danger actions to stable pill classes', () => {
    expect(actionMenuItemClassName({ disabled: true, tone: 'danger' })).toBe('pill pill-neutral');
    expect(actionMenuItemClassName({ tone: 'danger' })).toBe('pill pill-danger');
    expect(actionMenuItemClassName({})).toBe('pill pill-info');
  });

  it('renders pill-list actions through shared status badge atoms', () => {
    expect(source).toContain('StatusBadgeButton');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('<Link className={actionMenuItemClassName(item)}');
    expect(source).not.toContain('<button className={actionMenuItemClassName(item)}');
  });

  it('renders dropdown submit actions through the shared Vuexy button atom', () => {
    const menu = ActionMenu({
      actions: [
        {
          action: '/notifications/review',
          hiddenInputs: [{ name: 'notificationId', value: 'notification-1' }],
          kind: 'submit',
          label: 'Request review',
        },
      ],
      label: 'Notification row actions',
      variant: 'dropdown',
    });

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n        aria-label={item.ariaLabel}');
    expect(classNamesIn(menu)).toContain(
      'admin-form-control-button button button-secondary admin-action-item admin-action-button',
    );
  });

  it('renders header button-list actions through shared Vuexy button atoms', () => {
    const menu = ActionMenu({
      actions: [
        {
          href: '/finance-tax',
          kind: 'link',
          label: 'Tax Overview',
        },
        {
          href: '/finance-tax/payment-clearing',
          kind: 'link',
          label: 'Payment Clearing',
        },
      ],
      label: 'Finance workflow actions',
      variant: 'button-list',
    });

    expect(menu.props).toMatchObject({
      'aria-label': 'Finance workflow actions',
      className: 'action-menu action-menu-button-list',
    });
    expect(classNamesIn(menu)).toEqual(
      expect.arrayContaining([
        'action-menu-button-list-items',
        'admin-form-control-link button button-secondary',
      ]),
    );
    expect(classNamesIn(menu)).not.toContain('participant-list');
    expect(classNamesIn(menu).some((className) => className.startsWith('pill '))).toBe(false);
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
        'admin-form-control-button button button-secondary admin-action-item admin-action-button',
      ]),
    );
  });

  it('keeps duplicate action labels and hidden input names on unique React keys', () => {
    expect(source).toContain('actions.map((item, itemIndex) => (');
    expect(source).toContain('key={`${item.kind}:${item.label}:${itemIndex}`}');
    expect(source).toContain('item.hiddenInputs?.map((input, inputIndex) => (');
    expect(source).toContain('key={`${input.name}-${inputIndex}`}');
    expect(source).not.toContain('actions.map((item) => (');
    expect(source).not.toContain('key={`${item.kind}:${item.label}`}');
    expect(source).not.toContain('item.hiddenInputs?.map((input) => (');
    expect(source).not.toContain('key={input.name}');
  });

  it('dedupes repeated Vuexy dropdown class tokens from page hooks', () => {
    const dropdown = ActionMenuDropdownSurface({
      children: null,
      className: 'admin-action-dropdown payout-actions',
      label: 'Payout actions',
      menuClassName: 'admin-action-menu payout-menu',
      triggerClassName: 'admin-action-trigger payout-trigger',
    });

    expect(dropdown.props.className).toBe('admin-action-dropdown payout-actions');
    expect(classNamesIn(dropdown)).toEqual(
      expect.arrayContaining([
        'admin-action-trigger payout-trigger',
        'admin-action-menu payout-menu',
      ]),
    );
  });

  it('exposes the shared Vuexy dropdown surface for custom action forms', () => {
    const dropdown = ActionMenuDropdownSurface({
      children: <form className="custom-action-form" role="none" />,
      className: 'referral-reward-action-dropdown',
      label: 'Referral reward actions for reward-1',
      menuClassName: 'referral-reward-action-panel',
      title: 'Reward actions',
    });

    expect(dropdown.type).toBe('details');
    expect(dropdown.props.className).toBe('admin-action-dropdown referral-reward-action-dropdown');
    expect(classNamesIn(dropdown)).toEqual(
      expect.arrayContaining([
        'admin-action-trigger action-menu-trigger',
        'admin-action-menu referral-reward-action-panel',
        'custom-action-form',
      ]),
    );
    expect(textContent(dropdown)).toContain('Reward actions');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

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
