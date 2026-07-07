import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AuditLogCommandBoardSection,
  type AuditCommandBoardItem,
} from './audit-log-command-board-section';

describe('AuditLogCommandBoardSection', () => {
  it('renders audit command cards with review count and preview logs', () => {
    const section = AuditLogCommandBoardSection({
      items: buildCommandItems(),
    });

    const rendered = normalizedText(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'ops-task-grid',
      className: 'admin-mb-16',
      title: 'Audit command board',
    });
    expect(rendered).toContain('Audit command board');
    expect(rendered).toContain('High-impact admin changes grouped by policy');
    expect(rendered).toContain('notifications');
    expect(rendered).toContain('2 audit record(s)');
    expect(rendered).toContain('Policy and pricing changes');
    expect(rendered).toContain('Review before/after metadata');
    expect(rendered).toContain('Review');
    expect(rendered).toContain('Service / Update / service:abc12345 / Updated just now');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/audit-log?bucket=Service%2FPricing']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn', 'signal signal-warn']));
  });

  it('renders a clear status when no warning records are present', () => {
    const section = AuditLogCommandBoardSection({
      items: [
        {
          detail: 'No high-priority audit items.',
          href: '/audit-log',
          logs: [],
          operatorAction: 'Keep monitoring audit events.',
          status: 'Clear',
          title: 'Quiet trail',
          tone: 'ok',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 audit record(s)');
    expect(rendered).toContain('Quiet trail');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success', 'signal signal-ok']));
  });

  it('uses shared badge atoms for audit command status chips', () => {
    const source = readFileSync(join(process.cwd(), 'app/audit-log/audit-log-command-board-section.tsx'), 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="participant-list">');
    expect(source).not.toContain('<span className={`pill ${hasWarningLogs ?');
    expect(source).not.toContain('<span className="pill">{item.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.logs.length} event(s)</span>');
  });
});

function buildCommandItems(): AuditCommandBoardItem[] {
  return [
    {
      detail: 'Service price edits have downstream effects on bookings.',
      href: '/audit-log?bucket=Service%2FPricing',
      logs: [
        {
          actionLabel: 'Service / Update',
          id: 'audit-1',
          relativeTimeLabel: 'Updated just now',
          shortTargetLabel: 'service:abc12345',
        },
        {
          actionLabel: 'Tax / Update',
          id: 'audit-2',
          relativeTimeLabel: '5 minutes ago',
          shortTargetLabel: 'tax:vietnam',
        },
      ],
      operatorAction: 'Review before/after metadata and confirm the change was intentional.',
      status: 'Policy',
      title: 'Policy and pricing changes',
      tone: 'warn',
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
