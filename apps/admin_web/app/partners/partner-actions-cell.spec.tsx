import type { ActionMenuItem } from '../../components/action-menu';
import { PartnerActionsCell } from './partner-actions-cell';

describe('PartnerActionsCell', () => {
  it('renders account action menu labels for the selected Partner', () => {
    const cell = PartnerActionsCell({
      actions: buildActions(),
      partnerName: 'Linh Wellness',
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('Approve');
    expect(rendered).toContain('Sync role');
    expect(rendered).toContain('Open detail');
    expect(ariaLabelsIn(cell)).toEqual(
      expect.arrayContaining(['Partner account actions for Linh Wellness']),
    );
    expect(hrefsIn(cell)).toEqual(
      expect.arrayContaining(['/partners/partner-1/confirm?kind=approve', '/partners/partner-1']),
    );
    expect(classNamesIn(cell)).toEqual(
      expect.arrayContaining([
        'admin-action-dropdown action-menu-dropdown',
        'admin-action-menu action-menu-panel',
        'admin-action-item',
        'admin-action-item is-disabled',
      ]),
    );
  });
});

function buildActions(): ActionMenuItem[] {
  return [
    {
      href: '/partners/partner-1/confirm?kind=approve',
      kind: 'link',
      label: 'Approve',
      tone: 'success',
    },
    {
      disabled: true,
      href: '/partners/partner-1/confirm?kind=sync-role',
      kind: 'link',
      label: 'Sync role',
      tone: 'info',
    },
    {
      href: '/partners/partner-1',
      kind: 'link',
      label: 'Open detail',
      tone: 'neutral',
    },
  ];
}

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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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

function ariaLabelsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaLabelsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const label = typeof props?.['aria-label'] === 'string' ? [props['aria-label']] : [];
  return [...label, ...ariaLabelsIn(props?.children)];
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
