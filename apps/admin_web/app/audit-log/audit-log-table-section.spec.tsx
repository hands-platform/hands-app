import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AdminAuditEventView } from '../../lib/admin-api';
import { AuditLogTableSection } from './audit-log-table-section';

describe('AuditLogTableSection', () => {
  it('renders the normalized five-column investigation contract', () => {
    const section = AuditLogTableSection({
      evidenceHref: (eventId) => `/audit-log?event=${eventId}`,
      items: [buildEvent()],
    });
    const rendered = textContent(section);

    expect(rendered).toContain('Time & actor');
    expect(rendered).toContain('Event / outcome');
    expect(rendered).toContain('Object');
    expect(rendered).toContain('Change summary');
    expect(rendered).toContain('Open');
    expect(rendered).toContain('Operator One');
    expect(rendered).toContain('Human');
    expect(rendered).toContain('Booking completed');
    expect(rendered).toContain('SUCCEEDED');
    expect(rendered).toContain('NOTICE');
    expect(rendered).toContain('BOOKING');
    expect(rendered).toContain('Booking booking-1');
    expect(rendered).toContain('Status changed from MATCHED to COMPLETED');
    expect(rendered).toContain('Evidence');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining([
      '/audit-log?event=event-1',
      '/bookings/booking-1',
    ]));
  });

  it('distinguishes system attribution and legacy uncertainty', () => {
    const section = AuditLogTableSection({
      evidenceHref: (eventId) => `/audit-log?event=${eventId}`,
      items: [
        buildEvent({
          actor: {
            attribution: 'LEGACY_INFERRED',
            id: null,
            key: 'system:background-jobs',
            labelSnapshot: 'Background jobs',
            type: 'SYSTEM',
          },
        }),
      ],
    });

    const rendered = textContent(section);
    expect(rendered).toContain('Background jobs');
    expect(rendered).toContain('System');
    expect(rendered).toContain('Legacy attribution uncertain');
  });

  it('renders an explicit filtered empty state', () => {
    const section = AuditLogTableSection({ evidenceHref: () => '/audit-log', items: [] });
    expect(textContent(section)).toContain('No events match these filters.');
  });

  it('keeps raw payload out of the list and opens evidence separately', () => {
    const source = readFileSync(join(process.cwd(), 'app/audit-log/audit-log-table-section.tsx'), 'utf8');

    expect(source).toContain("headers={['Time & actor', 'Event / outcome', 'Object', 'Change summary', 'Open']}");
    expect(source).toContain('evidenceHref(event.id)');
    expect(source).toContain('event.related.href');
    expect(source).not.toContain('JSON.stringify');
    expect(source).not.toContain('<pre');
    expect(source).not.toContain('event.payload');
  });

  it('uses shared time, table, link and status primitives', () => {
    const source = readFileSync(join(process.cwd(), 'app/audit-log/audit-log-table-section.tsx'), 'utf8');

    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('AdminDataTable');
    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('DateTimeText');
    expect(source).toContain('StatusBadge');
  });
});

function buildEvent(overrides: Partial<AdminAuditEventView> = {}): AdminAuditEventView {
  return {
    actor: {
      attribution: 'RECORDED',
      id: 'operator-1',
      key: 'admin:operator-1',
      labelSnapshot: 'Operator One',
      type: 'HUMAN',
    },
    area: 'BOOKING',
    change: { before: { status: 'MATCHED' }, after: { status: 'COMPLETED' }, changedFields: ['status'] },
    changeSummary: 'Status changed from MATCHED to COMPLETED',
    context: {
      correlationId: 'correlation-123456789',
      requestId: 'request-1',
      routeTemplate: '/admin/bookings/:id',
      source: 'admin_api',
    },
    eventLabel: 'Booking completed',
    eventType: 'booking.completed',
    id: 'event-1',
    integrity: 'HASHED',
    object: { id: 'booking-1', labelSnapshot: 'Booking booking-1', type: 'booking' },
    occurredAt: '2026-06-09T03:00:00.000Z',
    outcome: 'SUCCEEDED',
    payload: { status: 'COMPLETED' },
    payloadHash: 'hash-1',
    recordedAt: '2026-06-09T03:00:01.000Z',
    related: { href: '/bookings/booking-1', label: 'Booking detail' },
    schemaVersion: 2,
    severity: 'NOTICE',
    tags: ['booking'],
    ...overrides,
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');

  const record = readRecord(value);
  return textContent(readRecord(record?.props)?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(hrefsIn);

  const props = readRecord(readRecord(value)?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
