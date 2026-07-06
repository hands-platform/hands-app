import { readFileSync } from 'node:fs';

import { CouponsTableSection, type CouponTableRow } from './coupons-table-section';

const sectionSource = readFileSync(new URL('./coupons-table-section.tsx', import.meta.url), 'utf8');

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
    expect(rendered).toContain('REVERSED');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(hrefsIn(section)).toContain('/coupons?confirm=delete&couponId=coupon-1');
    expect(elementTypesIn(section)).not.toContain('article');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['card', 'admin-filter-panel', 'admin-filter-panel-body']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['card', 'admin-card', 'coupon-management-section']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['ops-section-header', 'admin-section-header', 'admin-card-header']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-form-input', 'admin-form-checkbox', 'admin-form-control-button', 'button-primary']),
    );
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-disclosure', 'coupon-section-disclosure']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-mini-metric-strip', 'coupon-discount-summary']));
    expect(classNamesIn(section)).not.toContain('coupon-management-card');
    expect(sectionSource).toContain('AdminMiniMetricStrip');
    expect(sectionSource).toContain('AdminCard');
    expect(sectionSource).toContain('AdminCardHeader');
    expect(sectionSource).toContain('AdminDisclosure');
    expect(sectionSource).toContain('AdminTextLink');
    expect(sectionSource).not.toContain('AdminDisclosureCard');
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('className="text-link"');
    expect(sectionSource).not.toContain('<details className="admin-disclosure coupon-section-disclosure"');
    expect(sectionSource).not.toContain('coupon-active-field');
    expect(sectionSource).not.toContain('<section className={`card admin-card coupon-management-section');
    expect(sectionSource).not.toContain('<div className="coupon-management-section-header">');
    expect(sectionSource).not.toContain('<div className="coupon-discount-summary">');
    expect(sectionSource).not.toContain('<span className={row.statusClassName}>{row.statusLabel}</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-neutral">{booking.statusLabel}</span>');
    expect(sectionSource).not.toContain("booking.reversalStatusLabel === 'REVERSED' ? 'pill pill-warn' : 'pill pill-neutral'");
    expect(sectionSource).toContain('AdminTablePaginationFooter');
    expect(sectionSource).toContain('className="coupon-usage-table-footer"');
    expect(sectionSource).not.toContain('<AdminTableFooter');
    expect(sectionSource).not.toContain('Showing {pageFrom} to {pageTo} of {totalCount} entries');
    expect(JSON.stringify(section)).not.toContain('<input defaultChecked={row.active}');
  });

  it('renders empty state when no coupons exist', () => {
    const section = CouponsTableSection({
      rows: [],
      updateAction: async () => {},
      usageHrefForPage: (couponId, page) => `/coupons?usageCouponId=${couponId}&usagePage=${page}`,
      usagePage: 1,
    });

    expect(textContent(section)).toContain('No coupons in this state.');
    expect(classNamesIn(section)).toContain('empty-state');
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
        reversalStatusLabel: 'REVERSED',
        serviceLabel: 'Massage / 60 min',
        statusLabel: 'REFUNDED',
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
