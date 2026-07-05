import { readFileSync } from 'node:fs';

import { PayoutInclusionAuditSection } from './payout-inclusion-audit-section';

describe('PayoutInclusionAuditSection', () => {
  it('uses the shared Vuexy empty-state atom for empty audit ranges', () => {
    const source = readFileSync('app/payouts/payout-inclusion-audit-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<strong>No unbatched earning in this range</strong>');
  });

  it('renders inclusion summary cards and audit rows', () => {
    const section = PayoutInclusionAuditSection({
      audit: {
        blockedCount: 1,
        cards: [
          {
            helper: 'Ready earnings can enter the next batch.',
            label: 'Ready earnings',
            value: '3',
          },
        ],
        readyCount: 3,
        rows: [
          {
            detail: 'Partner net is available but not yet batched.',
            href: '/earnings',
            id: 'earning-1',
            operatorRule: 'Check wallet debt before including this earning.',
            status: 'Ready',
            title: 'Foot Massage / 60 min',
          },
        ],
      },
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout inclusion audit');
    expect(rendered).toContain('ready /');
    expect(rendered).toContain('held');
    expect(rendered).toContain('Ready earnings');
    expect(rendered).toContain('Foot Massage / 60 min');
    expect(hrefsIn(section)).toContain('/earnings');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders the clear state when there are no audit rows', () => {
    const section = PayoutInclusionAuditSection({
      audit: {
        blockedCount: 0,
        cards: [],
        readyCount: 0,
        rows: [],
      },
    });

    expect(textContent(section)).toContain('No unbatched earning in this range');
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
