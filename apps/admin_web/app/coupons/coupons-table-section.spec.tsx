import { CouponsTableSection, type CouponTableRow } from './coupons-table-section';

describe('CouponsTableSection', () => {
  it('renders coupon cards with edit fields and booking usage', () => {
    const section = CouponsTableSection({
      rows: [buildRow()],
      updateAction: async () => {},
      usageHrefForPage: (couponId, page) => `/coupons?usageCouponId=${couponId}&usagePage=${page}`,
      usagePage: 1,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Running Coupons');
    expect(rendered).toContain('WELCOME10');
    expect(rendered).toContain('10% off');
    expect(rendered).toContain('Used 1 booking(s)');
    expect(rendered).toContain('Edit coupon');
    expect(rendered).toContain('Discount %');
    expect(rendered).toContain('Booking usage');
    expect(rendered).toContain('Showing');
    expect(rendered.replace(/\s+/g, ' ')).toContain('Showing 1 to 1 of 1 entries');
    expect(rendered).toContain('Delete');
    expect(rendered).toContain('Demo Customer');
    expect(rendered).toContain('Smoke Partner');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(hrefsIn(section)).toContain('/coupons?confirm=delete&couponId=coupon-1');
    expect(elementTypesIn(section)).not.toContain('article');
    expect(classNamesIn(section)).toContain('coupon-management-section');
    expect(classNamesIn(section)).not.toContain('coupon-management-card');
  });

  it('renders empty state when no coupons exist', () => {
    const section = CouponsTableSection({
      rows: [],
      updateAction: async () => {},
      usageHrefForPage: (couponId, page) => `/coupons?usageCouponId=${couponId}&usagePage=${page}`,
      usagePage: 1,
    });

    expect(textContent(section)).toContain('No coupons in this state.');
  });
});

function buildRow(): CouponTableRow {
  return {
    active: true,
    checkoutHint: 'Checkout preview and booking payment authorization should apply this discount.',
    code: 'WELCOME10',
    description: 'Welcome campaign',
    discountLabel: '10% off',
    endsAtInputValue: '',
    id: 'coupon-1',
    lowerCode: 'welcome10',
    opsHint: 'Safe to use in customer checkout now.',
    percentValue: '10',
    startsAtInputValue: '',
    statusClassName: 'signal signal-ok',
    statusLabel: 'ACTIVE',
    usageBookingCount: 1,
    usageBookings: [
      {
        amountLabel: '270,000 VND',
        bookingHref: '/bookings/booking-1',
        bookingLabel: 'booking...',
        customerLabel: 'Demo Customer',
        discountLabel: '30,000 VND',
        partnerLabel: 'Smoke Partner',
        requestTimeLabel: '12 Jun 2026, 16:00',
        serviceLabel: 'Massage / 60 min',
        statusLabel: 'OPEN_MATCHING',
      },
    ],
    windowLabel: 'Immediate -> No end date',
    windowSignal: 'Live for booking checkout.',
    windowState: 'live',
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

function elementTypesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(elementTypesIn);
  }

  const record = readRecord(value);
  const type = typeof record?.type === 'string' ? [record.type] : [];
  const props = readRecord(record?.props);
  return [...type, ...elementTypesIn(props?.children)];
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
  const className = typeof props?.className === 'string' ? props.className.split(/\s+/).filter(Boolean) : [];
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
