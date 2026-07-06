import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PayoutStatusLanesSection } from './payout-status-lanes-section';

describe('PayoutStatusLanesSection', () => {
  it('renders payout lanes with batch cards and row links', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 1,
      lanes: [
        {
          batches: [
            {
              amount: 900000,
              currency: 'VND',
              earningCount: 2,
              id: 'batch-123456',
              opsHint: 'Save transfer reference before paid.',
              partnerLabel: 'Partner One',
            },
          ],
          emptyText: 'No blocked payout batch.',
          pillClass: 'pill-warn',
          title: 'Needs review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Payout status lanes');
    expect(rendered).toContain('Needs review');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('900.000 VND');
    expect(hrefsIn(section)).toContain('#batch-123456');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
  });

  it('renders lane empty text when there are no lane batches', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 0,
      lanes: [
        {
          batches: [],
          emptyText: 'No paid payout batch.',
          pillClass: 'pill-success',
          title: 'Paid',
        },
      ],
    });

    expect(textContent(section)).toContain('No paid payout batch.');
  });

  it('uses the shared Vuexy empty state atom for empty payout lanes', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 0,
      lanes: [
        {
          batches: [],
          emptyText: 'No blocked payout batch.',
          pillClass: 'pill-warn',
          title: 'Needs review',
        },
      ],
    });
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-status-lanes-section.tsx'), 'utf8');

    expect(classNamesIn(section)).toContain('empty-state admin-mt-8');
    expect(textContent(section)).toContain('No blocked payout batch.');
    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<p className="muted">{lane.emptyText}</p>');
  });

  it('does not duplicate the base pill class for lane count badges', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 0,
      lanes: [
        {
          batches: [],
          emptyText: 'No blocked payout batch.',
          pillClass: 'pill pill-warn',
          title: 'Needs review',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });

  it('keeps lane headers on the shared Vuexy section header atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-status-lanes-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-section-header">');
  });

  it('uses shared money atoms for lane batch amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-status-lanes-section.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('{formatMoney(batch.amount, batch.currency)}');
  });

  it('uses the shared Vuexy detail grid for payout lane cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/payout-status-lanes-section.tsx'), 'utf8');

    expect(source).toContain('AdminDetailGrid');
    expect(source).not.toContain('<div className="detail-grid admin-mt-16">');
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
