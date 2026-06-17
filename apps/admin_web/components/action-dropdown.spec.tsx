import { Eye, ReceiptText } from 'lucide-react';

import { ActionDropdown } from './action-dropdown';

describe('ActionDropdown', () => {
  it('renders reusable details-based action menus with icons', () => {
    const dropdown = ActionDropdown({
      actions: [
        {
          ariaLabel: 'Open customer',
          href: '/customers/customer-1',
          icon: Eye,
          label: 'View profile',
        },
        {
          href: '/payments?customer=customer-1',
          icon: ReceiptText,
          label: 'Payment records',
        },
      ],
      className: 'customer-actions',
      itemClassName: 'customer-action-item',
      label: 'More actions for Customer One',
      menuClassName: 'customer-action-menu',
      triggerClassName: 'customer-action-trigger',
    });

    expect(dropdown.type).toBe('details');
    expect(dropdown.props.className).toBe('admin-action-dropdown customer-actions');
    expect(classNamesIn(dropdown)).toEqual(
      expect.arrayContaining([
        'admin-action-trigger customer-action-trigger',
        'admin-action-menu customer-action-menu',
        'admin-action-item customer-action-item',
      ]),
    );
    expect(hrefsIn(dropdown)).toEqual(
      expect.arrayContaining(['/customers/customer-1', '/payments?customer=customer-1']),
    );
    expect(textContent(dropdown)).toContain('View profile');
    expect(textContent(dropdown)).toContain('Payment records');
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

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
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
