import { EarningsFinanceQueueSection } from './earnings-finance-queue-section';

describe('EarningsFinanceQueueSection', () => {
  it('renders finance queue signals and payout link', () => {
    const section = EarningsFinanceQueueSection({
      signals: [
        {
          action: 'Create Partner payout batch after review.',
          className: 'ops-task-pending',
          detail: 'Two Partners have ready earnings.',
          pillClass: 'pill-info',
          status: '2 ready',
          title: 'Payout ready',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Finance queue');
    expect(rendered).toContain('Payout ready');
    expect(rendered).toContain('Create Partner payout batch after review.');
    expect(hrefsIn(section)).toContain('/payouts');
  });

  it('renders stable heading when no signals are provided', () => {
    const section = EarningsFinanceQueueSection({ signals: [] });

    expect(textContent(section)).toContain('Finance queue');
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
