import { PayoutReleaseBlockerQueueSection } from './payout-release-blocker-queue-section';

describe('PayoutReleaseBlockerQueueSection', () => {
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

    expect(section.type).toBe('div');
    expect(rendered).toContain('Release blocker queue');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('750.000 VND');
    expect(rendered).toContain('Missing ref');
    expect(hrefsIn(section)).toContain('#batch-1');
  });

  it('renders a clear state when no release blocker is visible', () => {
    const section = PayoutReleaseBlockerQueueSection({ items: [] });

    expect(textContent(section)).toContain('No payout release blocker');
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
