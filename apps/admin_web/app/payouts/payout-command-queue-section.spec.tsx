import { PayoutCommandQueueSection } from './payout-command-queue-section';

describe('PayoutCommandQueueSection', () => {
  it('renders command signals with finance queue copy and earnings link', () => {
    const section = PayoutCommandQueueSection({
      signals: [
        {
          action: 'Review failed bank transfer evidence.',
          className: 'ops-task-pending',
          detail: 'Failed payout batches need transfer failure evidence before retry.',
          pillClass: 'pill-warn',
          status: '1 FAILED',
          title: 'Failed transfer review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Payout command queue');
    expect(rendered).toContain('Failed transfer review');
    expect(rendered).toContain('1 FAILED');
    expect(rendered).toContain('Review failed bank transfer evidence.');
    expect(hrefsIn(section)).toContain('/earnings');
  });

  it('renders an empty state when there are no payout command signals', () => {
    const section = PayoutCommandQueueSection({ signals: [] });

    expect(textContent(section)).toContain('No payout command signal is visible for this range.');
  });
});

function textContent(value: unknown): string {
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
