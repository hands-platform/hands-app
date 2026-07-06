import { readFileSync } from 'node:fs';

import {
  PartnerDetailOperationsDigestSection,
  type PartnerOperationsDigestRow,
} from './partner-detail-operations-digest-section';

describe('PartnerDetailOperationsDigestSection', () => {
  it('uses the shared Vuexy badge atom for digest evidence pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operations-digest-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}');
    expect(source).not.toContain('formatLatestAt');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-operations-digest-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders digest lanes with evidence, links, and latest dates', () => {
    const section = PartnerDetailOperationsDigestSection({
      description: 'One-screen factual digest for partner operations.',
      id: 'partner-operations-digest',
      rows: buildRows(),
      title: 'Partner operations digest',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operations digest');
    expect(rendered).toContain('One-screen factual digest for partner operations.');
    expect(rendered).toContain('2 lanes');
    expect(rendered).toContain('Lane');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Latest');
    expect(rendered).toContain('Identity');
    expect(rendered).toContain('Verified');
    expect(rendered).toContain('KYC approved');
    expect(rendered).toContain('Chat');
    expect(rendered).toContain('No date');
    expect(rendered).toContain('9 Jun 2026, 11:00');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#identity', '#chat']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-success',
        'pill pill-neutral',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 2 of 2 entries');
  });

  it('renders an empty operations digest table state', () => {
    const section = PartnerDetailOperationsDigestSection({
      description: 'One-screen factual digest for partner operations.',
      id: 'partner-operations-digest',
      rows: [],
      title: 'Partner operations digest',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner operations digest');
    expect(rendered).toContain('0 lanes');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No partner operations digest lanes are currently loaded.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
  });

  it('prefers shared detail nodes over fallback operations digest detail text', () => {
    const section = PartnerDetailOperationsDigestSection({
      description: 'One-screen factual digest for partner operations.',
      id: 'partner-operations-digest',
      rows: [
        {
          detail: 'Fallback operations digest date',
          detailNode: <span>Shared operations digest date marker</span>,
          evidence: ['1 session'],
          href: '#app-activity',
          lane: 'App reachability',
          status: 'Push-ready',
          tone: 'pill-success',
        },
      ],
      title: 'Partner operations digest',
    });
    const rendered = normalizeSpaces(textContent(section));
    const sectionSource = readFileSync('app/partners/[id]/partner-detail-operations-digest-section.tsx', 'utf8');
    const modelSource = readFileSync('app/partners/[id]/partner-detail-operations-digest-model.ts', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared operations digest date marker');
    expect(rendered).not.toContain('Fallback operations digest date');
    expect(sectionSource).toContain('row.detailNode ?? row.detail');
    expect(modelSource).toContain('readonly detailNode?: ReactNode;');
    expect(pageSource).toContain(
      '<DateTimeText fallback="Missing" value={partnerOperationsDigestLatestAccessAt} />',
    );
  });
});

function buildRows(): PartnerOperationsDigestRow[] {
  return [
    {
      detail: 'Partner profile is ready for marketplace operations.',
      evidence: ['KYC approved', 'Bank approved'],
      href: '#identity',
      lane: 'Identity',
      latestAt: '2026-06-09T04:00:00.000Z',
      status: 'Verified',
      tone: 'pill-success',
    },
    {
      detail: 'No retained chat room loaded for this date filter.',
      evidence: ['0 room(s)'],
      href: '#chat',
      lane: 'Chat',
      status: 'No room',
      tone: 'pill-neutral',
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
