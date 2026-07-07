import { readFileSync } from 'node:fs';

import { PayoutReleaseBlockerQueueSection } from './payout-release-blocker-queue-section';

describe('PayoutReleaseBlockerQueueSection', () => {
  it('uses the shared Vuexy empty-state atom for clear release queues', () => {
    const source = readFileSync('app/payouts/payout-release-blocker-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminEmptyState');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<strong>No payout release blocker</strong>');
  });

  it('uses the shared Vuexy money atom for visible amounts', () => {
    const source = readFileSync('app/payouts/payout-release-blocker-queue-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).toContain('readonly detail: ReactNode;');
    expect(source).not.toContain('formatMoney(');
  });

  it('renders release blockers with provider, reason, amount, and row link', () => {
    const section = PayoutReleaseBlockerQueueSection({
      items: [
        {
          amount: 750000,
          blockingReasons: [{ label: 'Missing ref', pillClass: 'pill-danger' }],
          currency: 'VND',
          detail: 'Bank reference is required before paid status.',
          id: 'batch-1',
          label: 'Missing ref',
          providerLabel: 'Partner One',
          severity: 'Block',
          action: 'Save bank reference before release.',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Release blocker queue');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('750.000 VND');
    expect(rendered).toContain('Missing ref');
    expect(hrefsIn(section)).toContain('#batch-1');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
  });

  it('renders a clear state when no release blocker is visible', () => {
    const section = PayoutReleaseBlockerQueueSection({ items: [] });

    expect(textContent(section)).toContain('No payout release blocker');
  });

  it('does not duplicate the base pill class for release blocker reason badges', () => {
    const section = PayoutReleaseBlockerQueueSection({
      items: [
        {
          amount: 750000,
          blockingReasons: [{ label: 'Missing ref', pillClass: 'pill pill-danger' }],
          currency: 'VND',
          detail: 'Bank reference is required before paid status.',
          id: 'batch-1',
          label: 'Missing ref',
          providerLabel: 'Partner One',
          severity: 'Block',
          action: 'Save bank reference before release.',
        },
      ],
    });

    expect(classNamesIn(section)).toContain('pill pill-danger');
    expect(classNamesIn(section)).not.toContain('pill pill pill-danger');
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
