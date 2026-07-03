import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuditLogTableSection, type AuditLogTableRow } from './audit-log-table-section';

describe('AuditLogTableSection', () => {
  it('renders audit rows with related board and metadata evidence', () => {
    const section = AuditLogTableSection({
      emptyMessage: 'No audit logs loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('2026-06-09 10:00');
    expect(rendered).toContain('Updated just now');
    expect(rendered).toContain('Booking / Ops status updated');
    expect(rendered).toContain('Dispatch');
    expect(rendered).toContain('Operator One');
    expect(rendered).toContain('booking:bookin');
    expect(rendered).toContain('Booking detail');
    expect(rendered).toContain('Trace related flow');
    expect(rendered).toContain('Structured booking handling status was updated by an operator.');
    expect(rendered).toContain('Changed status');
    expect(rendered).toContain('"status": "MATCHED"');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1']));
  });

  it('renders the empty state when no audit rows match', () => {
    const section = AuditLogTableSection({
      emptyMessage: 'No audit logs loaded.',
      rows: [],
    });

    expect(textContent(section)).toContain('No audit logs loaded.');
  });

  it('uses shared action and badge atoms for audit row links and metadata chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/audit-log/audit-log-table-section.tsx'), 'utf8');

    expect(source).toContain('ActionMenu');
    expect(source).toContain('PillClassBadge');
    expect(source).not.toContain('<Link className="pill pill-info" href={row.relatedBoardHref}>');
    expect(source).not.toContain('<span className={item.className} key={`${item.label}-${index}`}>');
  });
});

function buildRow(): AuditLogTableRow {
  return {
    actionLabel: 'Booking / Ops status updated',
    actorLabel: 'Operator One',
    bucketClassName: 'signal signal-info',
    bucketLabel: 'Dispatch',
    createdAtLabel: '2026-06-09 10:00',
    id: 'audit-1',
    metadataHighlights: [{ className: 'pill pill-info', label: 'Changed status' }],
    metadataPreview: '{\n  "status": "MATCHED"\n}',
    opsDetail: 'Use the status to see which handoff checks are done, pending, or blocked.',
    opsHint: 'Structured booking handling status was updated by an operator.',
    priorityLabel: 'Trace related flow',
    relatedBoardHref: '/bookings/booking-1',
    relatedBoardLabel: 'Booking detail',
    relativeTimeLabel: 'Updated just now',
    shortTargetLabel: 'booking:bookin',
    targetLabel: 'booking:booking-1',
  };
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
