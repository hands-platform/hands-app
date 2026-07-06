import { readFileSync } from 'node:fs';

import {
  PARTNER_CONNECTED_RECORDS_DESCRIPTION,
  PartnerDetailConnectedRecordsSection,
} from './partner-detail-connected-records-section';
import type { PartnerDetailConnectedRecordLink } from './partner-detail-connected-records-model';

describe('PartnerDetailConnectedRecordsSection', () => {
  it('uses the shared Vuexy admin card surface for the section shell', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-connected-records-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('className="card admin-mb-16"');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('renders connected record links with counts, detail, and tones', () => {
    const section = PartnerDetailConnectedRecordsSection({
      description: 'Jump from this partner to linked records.',
      id: 'partner-connected-operations-records',
      links: buildLinks(),
      title: 'Partner connected operations records',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner connected operations records');
    expect(rendered).toContain('Jump from this partner to linked records.');
    expect(rendered).toContain('2 links');
    expect(rendered).toContain('Latest booking');
    expect(rendered).toContain('BK-1001');
    expect(rendered).toContain('First-pick gate attempts');
    expect(rendered).toContain('2 attempt(s)');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/BK-1001', '/bookings?view=blocked-create']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-info', 'pill pill-warn']));
  });

  it('describes linked records without treating bank or tax as approval gates', () => {
    expect(PARTNER_CONNECTED_RECORDS_DESCRIPTION).toBe(
      'Jump from this partner to linked booking, chat, KYC, required documents, location, wallet, payout, and operator records.',
    );
    expect(PARTNER_CONNECTED_RECORDS_DESCRIPTION).not.toContain('bank, tax');
  });

  it('uses shared badge atoms for link count and record open links', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-connected-records-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('<span className="pill pill-info">{links.length} links</span>');
    expect(source).not.toContain('<Link className={`pill ${record.tone}`} href={record.href}>');
  });
});

function buildLinks(): PartnerDetailConnectedRecordLink[] {
  return [
    {
      detail: 'MATCHED / Deep tissue',
      href: '/bookings/BK-1001',
      label: 'Latest booking',
      tone: 'pill-info',
      value: 'BK-1001',
    },
    {
      detail: 'Wallet threshold / latest 9 Jun 2026',
      href: '/bookings?view=blocked-create',
      label: 'First-pick gate attempts',
      tone: 'pill-warn',
      value: '2 attempt(s)',
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
