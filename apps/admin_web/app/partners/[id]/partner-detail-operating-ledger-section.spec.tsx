import { readFileSync } from 'node:fs';

import { PartnerDetailOperatingLedgerSection } from './partner-detail-operating-ledger-section';

describe('PartnerDetailOperatingLedgerSection', () => {
  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operating-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders operating ledger rows with shared table styling and links', () => {
    const section = PartnerDetailOperatingLedgerSection({
      rows: [
        {
          area: 'Identity',
          evidence: 'Linh Legal / 0865907184 / Da Nang',
          href: '/partners/partner-1?section=full#partner-master-facts',
          status: 'Profile linked',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operating ledger');
    expect(rendered).toContain('1 record areas');
    expect(rendered).toContain('Identity');
    expect(rendered).toContain('Profile linked');
    expect(rendered).toContain('Linh Legal / 0865907184 / Da Nang');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/partners/partner-1?section=full#partner-master-facts']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
