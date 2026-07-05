import { readFileSync } from 'node:fs';

import { PartnerDetailBookingEvidenceBundlesSection } from './partner-detail-booking-evidence-bundles-section';

describe('PartnerDetailBookingEvidenceBundlesSection', () => {
  it('uses the shared Vuexy badge atom for booking status', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-evidence-bundles-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>');
  });

  it('renders booking evidence bundles with shared table styling and links', () => {
    const section = PartnerDetailBookingEvidenceBundlesSection({
      rows: [
        {
          bookingLabel: 'BK-2001 / 10 Jun 2026',
          chatDetail: '12 retained messages',
          chatHref: '/chat-archive?q=BK-2001',
          chatStatus: 'Archive retained',
          customerDetail: 'Service address saved on booking',
          customerHref: '/customers/customer-1',
          customerStatus: 'Customer snapshot',
          id: 'BK-2001',
          moneyDetail: 'Cash payment and Partner earning linked',
          moneyStatus: 'Money trace linked',
          opsDetail: 'Admin closeout evidence retained',
          opsStatus: 'Ops reviewed',
          relation: 'Selected',
          roleDetail: 'Partner accepted and completed service',
          roleStatus: 'Selected Partner',
          serviceLabel: 'Aromatherapy',
          status: 'COMPLETED',
        },
      ],
      statusPillClass: (status) => (status === 'COMPLETED' ? 'pill-success' : 'pill-neutral'),
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Partner booking evidence bundles');
    expect(rendered).toContain('1 booking bundle(s)');
    expect(rendered).toContain('BK-2001 / 10 Jun 2026');
    expect(rendered).toContain('Selected Partner');
    expect(rendered).toContain('Customer snapshot');
    expect(rendered).toContain('Archive retained');
    expect(rendered).toContain('Money trace linked');
    expect(rendered).toContain('Ops reviewed');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings/BK-2001', '/customers/customer-1', '/chat-archive?q=BK-2001']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'text-link admin-ml-10',
        'pill pill-success',
      ]),
    );
  });

  it('renders the existing empty message outside the table', () => {
    const section = PartnerDetailBookingEvidenceBundlesSection({
      rows: [],
      statusPillClass: () => 'pill-neutral',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('0 booking bundle(s)');
    expect(rendered).toContain('No partner booking bundle matched this date filter.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
  });

  it('prefers shared money nodes over fallback booking evidence amount text', () => {
    const rowsWithMoneyNodes = [
      {
        bookingLabel: 'BK-2002 / 10 Jun 2026',
        chatDetail: 'No chat room',
        chatStatus: 'No chat room',
        customerDetail: 'Service address saved on booking',
        customerStatus: 'Customer snapshot',
        id: 'BK-2002',
        moneyDetail: 'Fallback money detail',
        moneyDetailNode: <span>Shared money detail marker</span>,
        moneyStatus: 'Money trace linked',
        opsDetail: 'Admin closeout evidence retained',
        opsStatus: 'Ops reviewed',
        relation: 'Selected',
        roleDetail: 'Partner accepted and completed service',
        roleStatus: 'Selected Partner',
        serviceLabel: 'Fallback service money',
        serviceLabelNode: <span>Shared service money marker</span>,
        status: 'COMPLETED',
      },
    ] as unknown as Parameters<typeof PartnerDetailBookingEvidenceBundlesSection>[0]['rows'];
    const section = PartnerDetailBookingEvidenceBundlesSection({
      rows: rowsWithMoneyNodes,
      statusPillClass: () => 'pill-success',
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-evidence-bundles-section.tsx', 'utf8');

    expect(rendered).toContain('Shared service money marker');
    expect(rendered).toContain('Shared money detail marker');
    expect(rendered).not.toContain('Fallback service money');
    expect(rendered).not.toContain('Fallback money detail');
    expect(source).toContain('readonly serviceLabelNode?: ReactNode;');
    expect(source).toContain('readonly moneyDetailNode?: ReactNode;');
    expect(source).toContain('{row.serviceLabelNode ?? row.serviceLabel}');
    expect(source).toContain('{row.moneyDetailNode ?? row.moneyDetail}');
  });

  it('prefers shared date nodes over fallback booking evidence date text', () => {
    const rowsWithDateNodes = [
      {
        bookingLabel: 'Fallback booking date',
        bookingLabelNode: <span>Shared booking date marker</span>,
        chatDetail: 'No chat room',
        chatStatus: 'No chat room',
        customerDetail: 'Service address saved on booking',
        customerStatus: 'Customer snapshot',
        id: 'BK-2003',
        moneyDetail: 'Cash payment and Partner earning linked',
        moneyStatus: 'Money trace linked',
        opsDetail: 'Fallback ops date detail',
        opsDetailNode: <span>Shared ops date marker</span>,
        opsStatus: 'Ops reviewed',
        relation: 'Selected',
        roleDetail: 'Partner accepted and completed service',
        roleStatus: 'Selected Partner',
        serviceLabel: 'Aromatherapy',
        status: 'COMPLETED',
      },
    ] as unknown as Parameters<typeof PartnerDetailBookingEvidenceBundlesSection>[0]['rows'];
    const section = PartnerDetailBookingEvidenceBundlesSection({
      rows: rowsWithDateNodes,
      statusPillClass: () => 'pill-success',
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-evidence-bundles-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(rendered).toContain('Shared booking date marker');
    expect(rendered).toContain('Shared ops date marker');
    expect(rendered).not.toContain('Fallback booking date');
    expect(rendered).not.toContain('Fallback ops date detail');
    expect(source).toContain('readonly bookingLabelNode?: ReactNode;');
    expect(source).toContain('readonly opsDetailNode?: ReactNode;');
    expect(source).toContain('{row.bookingLabelNode ?? row.bookingLabel}');
    expect(source).toContain('{row.opsDetailNode ?? row.opsDetail}');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={bookingRecordCreatedAt(booking)} />');
    expect(pageSource).toContain('participated <DateTimeText fallback="Missing" value={participant.joinedAt} />');
    expect(pageSource).toContain('responded <DateTimeText fallback="Missing" value={participant.respondedAt} />');
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
