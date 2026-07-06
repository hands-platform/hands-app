import { readFileSync } from 'node:fs';

import { PartnerDetailOperatingChecklistSection } from './partner-detail-operating-checklist-section';

describe('PartnerDetailOperatingChecklistSection', () => {
  it('uses the partner detail Vuexy table panel atom for the operating checklist shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operating-checklist-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses the shared Vuexy badge atom for checklist status pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operating-checklist-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(item.tone)}`}>{item.status}</span>');
    expect(source).not.toContain('<span className={`pill ${pillClassForTone(item.tone)}`}>{item.nextAction}</span>');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operating-checklist-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders active-work checks as a Vuexy table', () => {
    const section = PartnerDetailOperatingChecklistSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      rows: [
        {
          area: 'Booking participation',
          detail: 'Partner can accept direct requests but marketplace is blocked.',
          href: '#booking-gates',
          nextAction: 'Resolve participation gate',
          status: 'Needs action',
          tone: 'blocked',
        },
        {
          area: 'App connection',
          detail: 'Latest location and push alerts are ready for dispatch.',
          href: '#app-activity',
          nextAction: 'Monitor',
          status: 'Ready',
          tone: 'done',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner active-work checklist');
    expect(rendered).toContain('2 check(s)');
    expect(rendered).toContain('Area');
    expect(rendered).toContain('Readiness');
    expect(rendered).toContain('Operator read');
    expect(rendered).toContain('Next action');
    expect(rendered).toContain('Open');
    expect(rendered).toContain('Booking participation');
    expect(rendered).toContain('Partner can accept direct requests but marketplace is blocked.');
    expect(rendered).toContain('Resolve participation gate');
    expect(rendered).toContain('App connection');
    expect(rendered).toContain('Latest location and push alerts are ready for dispatch.');
    expect(rendered).toContain('Monitor');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#booking-gates', '#app-activity']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
        'pill pill-success',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
  });

  it('renders an empty operating checklist table state', () => {
    const section = PartnerDetailOperatingChecklistSection({
      pillClassForTone: (tone) => `pill-${tone}`,
      rows: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner active-work checklist');
    expect(rendered).toContain('0 check(s)');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No partner active-work checks are currently loaded.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
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
