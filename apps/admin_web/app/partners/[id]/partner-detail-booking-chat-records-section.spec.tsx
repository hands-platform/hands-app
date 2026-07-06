import { readFileSync } from 'node:fs';
import { PartnerDetailBookingChatRecordsSection } from './partner-detail-booking-chat-records-section';

const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

describe('PartnerDetailBookingChatRecordsSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No booking records matched this date filter</strong>');
    expect(pageSource).not.toContain('createdLabel: formatDate(message.createdAt)');
    expect(pageSource).toContain('createdDateTime: message.createdAt');
  });

  it('uses shared Vuexy badge atoms instead of raw chat record pill spans', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-10">');
    expect(source).not.toContain('<span className={`pill ${row.hasChatRoom ? \'pill-success\' : \'pill-danger\'}`}>');
    expect(source).not.toContain('<span className="pill pill-info">{row.chatMessages.length} message(s)</span>');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('uses the partner detail Vuexy table panel atom for the booking chat surface', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(source).toContain('PartnerDetailVuexyTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain('partnerDetailReviewCardClassName');
  });

  it('renders booking chat records as a Vuexy table', () => {
    const section = PartnerDetailBookingChatRecordsSection({
      openBookingsHref: '/bookings',
      rows: [
        {
          bookingHref: '/bookings/booking-1',
          chatHref: '/chat-archive?bookingId=booking-1',
          chatLine: 'Chat room has 2 stored message(s).',
          chatMessages: [
            {
              body: 'I am arriving in 10 minutes.',
              createdDateTime: '2026-06-20T10:15:00.000Z',
              id: 'message-1',
              role: 'PROVIDER',
              senderLabel: 'Partner',
            },
          ],
          closureLine: 'Completed 20 Jun 2026, 11:30.',
          customerHref: '/customers/customer-1',
          customerLine: 'Customer Linh Nguyen / +84 865 907 184',
          hasChatRoom: true,
          heading: 'Booking booking-1',
          key: 'booking-1',
          paymentLine: 'Paid 400,000 VND.',
          relation: 'MATCHED',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Booking and chat records');
    expect(rendered).toContain('Open bookings');
    expect(rendered).toContain('Relation');
    expect(rendered).toContain('Booking');
    expect(rendered).toContain('Payment');
    expect(rendered).toContain('Chat archive');
    expect(rendered).toContain('MATCHED');
    expect(rendered).toContain('Booking booking-1');
    expect(rendered).toContain('Customer Linh Nguyen');
    expect(rendered).toContain('Paid 400,000 VND.');
    expect(rendered).toContain('Admin chat archive');
    expect(rendered).toContain('I am arriving in 10 minutes.');
    expect(rendered).toContain('20 Jun 2026, 17:15');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings', '/bookings/booking-1', '/customers/customer-1', '/chat-archive?bookingId=booking-1']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'admin-disclosure admin-chat-transcript-disclosure partner-chat-window-disclosure admin-mt-10',
        'pill pill-success',
      ]),
    );
  });

  it('renders missing chat rooms and empty state inside the table', () => {
    const missingChatSection = PartnerDetailBookingChatRecordsSection({
      openBookingsHref: '/bookings',
      rows: [
        {
          bookingHref: '/bookings/booking-2',
          chatLine: 'No chat room is linked.',
          chatMessages: [],
          customerLine: 'Customer Minh Tran',
          hasChatRoom: false,
          heading: 'Booking booking-2',
          key: 'booking-2',
          paymentLine: 'Payment pending.',
          relation: 'MISSING',
        },
      ],
    });
    const emptySection = PartnerDetailBookingChatRecordsSection({ openBookingsHref: '/bookings', rows: [] });

    const missingChatRendered = normalizeSpaces(textContent(missingChatSection));
    const emptyRendered = normalizeSpaces(textContent(emptySection));

    expect(missingChatRendered).toContain('Chat room missing');
    expect(missingChatRendered).toContain('A matched booking should create a chat room.');
    expect(emptyRendered).toContain('No booking records matched this date filter');
    expect(emptyRendered).toContain('Clear the date filter or choose a wider range');
    expect(classNamesIn(missingChatSection)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
      ]),
    );
  });

  it('prefers shared payment nodes over fallback booking chat payment text', () => {
    const rowsWithPaymentNode = [
      {
        bookingHref: '/bookings/booking-3',
        chatLine: 'No chat room is linked.',
        chatMessages: [],
        customerLine: 'Customer Minh Tran',
        hasChatRoom: false,
        heading: 'Booking booking-3',
        key: 'booking-3',
        paymentLine: 'Fallback money string',
        paymentLineNode: <span>Shared money atom marker</span>,
        relation: 'MISSING',
      },
    ] as unknown as Parameters<typeof PartnerDetailBookingChatRecordsSection>[0]['rows'];
    const section = PartnerDetailBookingChatRecordsSection({
      openBookingsHref: '/bookings',
      rows: rowsWithPaymentNode,
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(rendered).toContain('Shared money atom marker');
    expect(rendered).not.toContain('Fallback money string');
    expect(source).toContain('readonly paymentLineNode?: ReactNode;');
    expect(source).toContain('{row.paymentLineNode ?? row.paymentLine}');
  });

  it('prefers shared date nodes over fallback booking chat date text', () => {
    const rowsWithDateNodes = [
      {
        bookingHref: '/bookings/booking-4',
        chatLine: 'No chat room is linked.',
        chatMessages: [],
        closureLine: 'Fallback closed date',
        closureLineNode: <span>Shared closure date atom marker</span>,
        customerLine: 'Fallback customer requested date',
        customerLineNode: <span>Shared customer date atom marker</span>,
        hasChatRoom: false,
        heading: 'Booking booking-4',
        key: 'booking-4',
        paymentLine: 'Payment pending.',
        relation: 'MISSING',
      },
    ] as unknown as Parameters<typeof PartnerDetailBookingChatRecordsSection>[0]['rows'];
    const section = PartnerDetailBookingChatRecordsSection({
      openBookingsHref: '/bookings',
      rows: rowsWithDateNodes,
    });
    const rendered = normalizeSpaces(textContent(section));
    const source = readFileSync('app/partners/[id]/partner-detail-booking-chat-records-section.tsx', 'utf8');

    expect(rendered).toContain('Shared customer date atom marker');
    expect(rendered).toContain('Shared closure date atom marker');
    expect(rendered).not.toContain('Fallback customer requested date');
    expect(rendered).not.toContain('Fallback closed date');
    expect(source).toContain('readonly customerLineNode?: ReactNode;');
    expect(source).toContain('readonly closureLineNode?: ReactNode;');
    expect(source).toContain('{row.customerLineNode ?? row.customerLine}');
    expect(source).toContain('{row.closureLineNode ?? row.closureLine}');
    expect(pageSource).toContain('closureLineNode: isClosedPartnerBooking(booking) ? (');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={booking.closedAt} />');
    expect(pageSource).toContain('customerLineNode: (');
    expect(pageSource).toContain('<DateTimeText fallback="Missing" value={bookingRequestOpenedAt(booking)} />');
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
