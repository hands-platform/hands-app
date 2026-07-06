import { readFileSync } from 'node:fs';

import {
  CustomerDetailSectionBand,
  CustomerDetailShortcutStrip,
  type CustomerDetailShortcut,
} from './customer-detail-section-shell';

describe('CustomerDetailSectionShell', () => {
  it('uses the shared Vuexy badge atom for shortcut lane counts', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-section-shell.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminRowLink');
    expect(source).not.toContain('<span className="pill pill-info">{items.length} lanes</span>');
    expect(source).not.toContain('<a className="customer-detail-shortcut-link" href={item.href} key={item.label}>');
  });

  it('renders customer shortcut lanes with hrefs and values', () => {
    const section = CustomerDetailShortcutStrip({
      items: [
        {
          href: '#customer-operations-digest',
          label: 'Operations',
          value: '6 lanes',
          detail: 'Dispatch, linked records, gate attempts, journey, and command queue.',
        },
        {
          href: '#customer-activity',
          label: 'Activity timeline',
          value: '18 events',
          detail: 'Cross-surface events grouped by date filter and record type.',
        },
      ] satisfies readonly CustomerDetailShortcut[],
    });

    const rendered = textContent(section).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer workspace');
    expect(rendered).toContain('Operations');
    expect(rendered).toContain('18 events');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['#customer-operations-digest', '#customer-activity']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'customer-detail-shortcut-strip admin-mb-16',
        'customer-detail-shortcut-grid admin-mt-14',
        'admin-row-link customer-detail-shortcut-link',
      ]),
    );
  });

  it('renders section band heading and children', () => {
    const band = CustomerDetailSectionBand({
      children: 'Band body',
      description: 'Grouped customer archive content.',
      eyebrow: 'Records',
      id: 'customer-record-band',
      status: 'Historical archive',
      title: 'Bookings, chat, and audit record',
    });

    const rendered = textContent(band).replace(/\s+/g, ' ');

    expect(rendered).toContain('Records');
    expect(rendered).toContain('Bookings, chat, and audit record');
    expect(rendered).toContain('Band body');
    expect(classNamesIn(band)).toEqual(
      expect.arrayContaining([
        'card admin-section customer-detail-section-band admin-mb-16',
        'ops-section-header admin-section-header customer-detail-section-band-header',
        'admin-section-body customer-detail-section-band-body',
      ]),
    );
  });

  it('builds customer section bands on the shared Vuexy AdminSection surface', () => {
    const source = readFileSync('app/customers/[id]/customer-detail-section-shell.tsx', 'utf8');

    expect(source).toContain("import { AdminRowLink, AdminSection } from '../../../components/admin-surface';");
    expect(source).toContain('<AdminSection');
    expect(source).toContain('bodyClassName="customer-detail-section-band-body"');
    expect(source).toContain('headerClassName="customer-detail-section-band-header"');
    expect(source).not.toContain('<section className="customer-detail-section-band admin-mb-16"');
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
