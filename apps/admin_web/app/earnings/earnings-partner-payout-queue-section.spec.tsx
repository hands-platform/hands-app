import { EarningsPartnerPayoutQueueSection } from './earnings-partner-payout-queue-section';

describe('EarningsPartnerPayoutQueueSection', () => {
  it('renders Partner payout queue rows and review action', () => {
    const section = EarningsPartnerPayoutQueueSection({
      groups: [
        {
          activeBatchSummary: null,
          canBatch: true,
          cashDebtAmount: 0,
          currency: 'VND',
          nextAction: 'Create payout batch after review.',
          providerHref: '/partners/partner-1',
          providerName: 'Partner One',
          providerProfileId: 'partner-1',
          status: 'READY',
          transferRef: 'HANDS-partner-1',
          unbatchedCount: 2,
          unbatchedNet: 900000,
          walletBalance: 0,
          withholdingAmount: 50000,
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Partner payout queue');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('900.000 VND');
    expect(rendered).toContain('Review payout batch');
    expect(classNamesIn(section)).toContain('admin-form-control-button btn btn-primary');
    expect(hrefsIn(section)).toContain('/partners/partner-1');
  });

  it('renders empty state when there are no payout queue groups', () => {
    const section = EarningsPartnerPayoutQueueSection({ groups: [] });

    expect(textContent(section)).toContain('No Partner has unpaid earnings in the current admin result window.');
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
