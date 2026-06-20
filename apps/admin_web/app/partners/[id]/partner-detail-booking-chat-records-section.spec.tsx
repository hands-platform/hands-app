import { PartnerDetailBookingChatRecordsSection } from './partner-detail-booking-chat-records-section';

describe('PartnerDetailBookingChatRecordsSection', () => {
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
              createdLabel: '20 Jun 2026, 10:15',
              id: 'message-1',
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
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings', '/bookings/booking-1', '/customers/customer-1', '/chat-archive?bookingId=booking-1']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
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
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
      ]),
    );
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
