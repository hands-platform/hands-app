import { CouponsTableSection, type CouponTableRow } from './coupons-table-section';

describe('CouponsTableSection', () => {
  it('renders coupon rows with status, hints, and action links', () => {
    const section = CouponsTableSection({
      liveCount: 1,
      pausedCount: 0,
      reviewCount: 1,
      rows: [buildRow()],
      scheduledCount: 0,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Checkout Campaigns');
    expect(rendered).toContain('WELCOME10');
    expect(rendered).toContain('Customer can enter');
    expect(rendered).toContain('welcome10');
    expect(rendered).toContain('10% off');
    expect(rendered).toContain('Pause');
    expect(hrefsIn(section)).toContain('/coupons?confirm=toggle&couponId=coupon-1');
  });

  it('renders empty state when no coupons exist', () => {
    const section = CouponsTableSection({
      liveCount: 0,
      pausedCount: 0,
      reviewCount: 0,
      rows: [],
      scheduledCount: 0,
    });

    expect(textContent(section)).toContain('No coupons loaded.');
  });
});

function buildRow(): CouponTableRow {
  return {
    actions: [
      {
        description: 'Review before removing this code from checkout.',
        href: '/coupons?confirm=toggle&couponId=coupon-1',
        kind: 'link',
        label: 'Pause',
        tone: 'danger',
      },
    ],
    checkoutHint: 'Checkout preview and booking payment authorization should apply this discount.',
    code: 'WELCOME10',
    description: 'Welcome campaign',
    discountLabel: '10% off',
    id: 'coupon-1',
    lowerCode: 'welcome10',
    opsHint: 'Safe to use in customer checkout now.',
    statusClassName: 'signal signal-ok',
    statusLabel: 'ACTIVE',
    windowLabel: 'Immediate -> No end date',
    windowSignal: 'Live for booking checkout.',
  };
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
