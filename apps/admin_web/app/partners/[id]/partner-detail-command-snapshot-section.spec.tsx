import { PartnerDetailCommandSnapshotSection } from './partner-detail-command-snapshot-section';
import { readFileSync } from 'node:fs';

describe('PartnerDetailCommandSnapshotSection', () => {
  it('renders command snapshot fact groups with links', () => {
    const section = PartnerDetailCommandSnapshotSection({
      items: [
        {
          helper: '4 completed bookings in this filter.',
          href: '#booking-chat-records',
          label: 'Completed work',
          value: '4',
        },
        {
          helper: 'Latest retained chat and staff records.',
          href: '#app-activity',
          label: 'Timeline',
          value: '12',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner command snapshot');
    expect(rendered).toContain('Filter-aware facts for this partner');
    expect(rendered).toContain('2 fact groups');
    expect(rendered).toContain('Completed work');
    expect(rendered).toContain('4 completed bookings in this filter.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#booking-chat-records', '#app-activity']));
  });

  it('renders a zero count when no command facts are available', () => {
    const section = PartnerDetailCommandSnapshotSection({ items: [] });

    expect(normalizedText(section)).toContain('0 fact groups');
  });

  it('uses a shared badge atom for the command fact count', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-command-snapshot-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{items.length} fact groups</span>');
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
