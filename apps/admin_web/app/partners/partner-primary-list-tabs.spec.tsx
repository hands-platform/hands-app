import { readFileSync } from 'node:fs';

import { PartnerPrimaryListTabs } from './partner-primary-list-tabs';

const source = readFileSync(new URL('./partner-primary-list-tabs.tsx', import.meta.url), 'utf8');
const globalsCss = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('PartnerPrimaryListTabs', () => {
  it('renders the three primary partner pages with one active tab', () => {
    const tabs = PartnerPrimaryListTabs({ activeMode: 'unapproved' });

    const rendered = normalizedText(tabs);

    expect(rendered).toContain('Partners');
    expect(rendered).toContain('Unapproved Partners');
    expect(rendered).toContain('Unsettled Partners');
    expect(hrefsIn(tabs)).toEqual(['/partners', '/partners?review=unapproved', '/partners?review=unsettled']);
    expect(classNamesIn(tabs)).toEqual(
      expect.arrayContaining([
        'booking-date-filter-buttons partner-primary-list-tabs',
        'booking-date-filter-button is-active',
        'booking-date-filter-button',
      ]),
    );
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('<Link');
    expect(globalsCss).toContain('.partner-primary-list-tabs {');
    expect(globalsCss).not.toMatch(/\.partner-primary-list-tab(?:[\s:{.,]|$)/);
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
