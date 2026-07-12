import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type { AdminBookingDetail } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import ChatArchivePage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

describe('ChatArchivePage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('uses the shared Vuexy trace summary atom for repair queue metrics', () => {
    expect(pageSource).toContain('AdminTraceSummary');
    expect(pageSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('renders retained chat totals separately from bounded preview messages', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive/summary')) {
        return {
          activeRooms: 12,
          completedRooms: 25,
          customerMessages: 800,
          emptyRooms: 3,
          generatedAt: '2026-06-29T01:30:00.000Z',
          latestMessageAt: '2026-06-29T01:20:00.000Z',
          messageCount: 1234,
          partnerMessages: 434,
          totalCount: 99,
        };
      }

      if (href.startsWith('/admin/chat-archive')) {
        return [chatArchiveBooking()];
      }

      if (href.startsWith('/admin/bookings')) {
        return [];
      }

      return fallback;
    });

    const page = await ChatArchivePage({ searchParams: Promise.resolve({ range: 'all' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1 room(s), 1234 message(s)');
    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('99');
    expect(markup).toContain('800 customer / 434 Partner');
    expect(markup).toContain('Chat window previews');
    expect(markup).toContain('2 shown / 42 total');
    expect(markup).toContain('admin-section');
    expect(markup).toContain('Chat integrity repair queue');
    expect(markup).toContain('Chat evidence index');
    expect(markup).toContain('class="card admin-card admin-disclosure chat-transcript-room admin-chat-transcript-disclosure"');
    expect(markup).toContain('vuexy-booking-table-card vuexy-booking-table-group admin-mb-16');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table');
  });

  it('trusts server sender filtering when the bounded preview does not include that sender', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive')) {
        return [chatArchiveBooking({ previewIncludesPartner: false })];
      }

      if (href.startsWith('/admin/bookings')) {
        return [];
      }

      return fallback;
    });

    const page = await ChatArchivePage({ searchParams: Promise.resolve({ range: 'all', sender: 'partner' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1 room(s), 42 message(s)');
    expect(markup).toContain('1 shown / 42 total');
  });

  it('keeps audit filters on shared AdminForm atoms', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive')) {
        return [chatArchiveBooking()];
      }

      if (href.startsWith('/admin/bookings')) {
        return [];
      }

      return fallback;
    });

    const page = await ChatArchivePage({ searchParams: Promise.resolve({ range: 'all' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-date');
    expect(markup).toContain('admin-form-input admin-form-control-labeled admin-directory-filter-search');
    expect(markup).toContain('admin-form-select admin-form-control-labeled admin-directory-filter-select');
    expect(markup).toContain(
      'admin-form-date admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled admin-form-control-fluid',
    );
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('admin-form-control-link');
    expect(markup).not.toContain('calendar-field');
    expect(markup).not.toContain('<div class="calendar-field"><span>Search</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Booking status</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>From</span>');
    expect(markup).not.toContain('<label>Search<input');
    expect(markup).not.toContain('<label>Booking status<select');
  });

  it('uses the shared AdminFormControlLink atom for button-style archive actions', () => {
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).toContain('AdminDisclosureCard');
    expect(pageSource).toContain('AdminStageList');
    expect(pageSource).not.toContain('<div className="setup-stage-list');
    expect(pageSource).not.toContain('<Link className="button button-secondary"');
    expect(pageSource).not.toContain('className="button button-secondary chat-inline-action"');
    expect(pageSource).not.toContain('<details className="card admin-disclosure');
  });

  it('keeps visible chat status chips on shared badge atoms', () => {
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('StatusBadgeFromPillClass');
    expect(pageSource).not.toContain('statusBadgeToneFromPillClass');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).not.toContain('<strong>No chat rooms found</strong>');
    expect(pageSource).not.toContain('<span className={`pill ${row.pillClass}`}>{row.issue}</span>');
    expect(pageSource).not.toContain('<span className={`pill ${statusPillClass(room.booking.status)}`}>');
  });

  it('uses the shared DateTimeText atom for visible chat archive table timestamps', () => {
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).toContain('valueDateTimeFallback: \'None\'');
    expect(pageSource).toContain('valueDateTimeValue: summary.latestMessageAt');
    expect(pageSource).not.toContain('value: <DateTimeText fallback="None" value={summary.latestMessageAt} />');
    expect(pageSource).not.toContain(
      '<p className="muted">{formatDate(row.booking.updatedAt ?? row.booking.createdAt)}</p>',
    );
    expect(pageSource).not.toContain(
      "<td>{room.latestMessageAt ? formatDate(room.latestMessageAt) : 'No message'}</td>",
    );
    expect(pageSource).not.toContain('formatDateTime as formatDate');
    expect(pageSource).not.toContain('latestMessageAt: latestMessageAt ? formatDate(latestMessageAt)');
  });

  it('passes raw retained chat timestamps to the shared date atom instead of formatting locally', () => {
    expect(pageSource).toContain('createdDateTime: message.createdAt');
    expect(pageSource).not.toContain('createdLabel: formatDate(message.createdAt)');
  });

  it('uses the shared table pagination footer for the chat evidence index', () => {
    expect(pageSource).toContain('AdminTableSection');
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel="Chat evidence pages"');
    expect(pageSource).not.toContain('className="admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('scopes chat archive headers to direct cards and removes stale transcript selectors', () => {
    expect(globalCss).toContain('.chat-archive-page > .card > .ops-section-header {');
    expect(globalCss).not.toContain('.chat-archive-page .ops-section-header {');
    expect(globalCss).not.toContain('.chat-transcript-room .ops-section-header');
  });
});

function chatArchiveBooking({
  previewIncludesPartner = true,
}: {
  readonly previewIncludesPartner?: boolean;
} = {}): AdminBookingDetail {
  const previewMessages = previewIncludesPartner
    ? [
        {
          body: 'I am on the way.',
          createdAt: '2026-06-29T01:10:00.000Z',
          id: 'message-1',
          sender: {
            id: 'provider-user-1',
            fullName: 'Smoke Partner',
            phone: '+84900002222',
            roles: ['PROVIDER'],
          },
        },
        {
          body: 'Please meet me at reception.',
          createdAt: '2026-06-29T01:12:00.000Z',
          id: 'message-2',
          sender: {
            id: 'customer-user-1',
            fullName: 'Demo Customer',
            phone: '+84900001111',
            roles: ['CUSTOMER'],
          },
        },
      ]
    : [
        {
          body: 'Please meet me at reception.',
          createdAt: '2026-06-29T01:12:00.000Z',
          id: 'message-2',
          sender: {
            id: 'customer-user-1',
            fullName: 'Demo Customer',
            phone: '+84900001111',
            roles: ['CUSTOMER'],
          },
        },
      ];

  return {
    chatRoom: {
      id: 'chat-room-1',
      _count: { messages: 42 },
      messages: previewMessages,
    },
    createdAt: '2026-06-29T01:00:00.000Z',
    customerProfileId: 'customer-1',
    customerProfile: {
      id: 'customer-1',
      user: {
        id: 'customer-user-1',
        fullName: 'Demo Customer',
        phone: '+84900001111',
        roles: ['CUSTOMER'],
      },
    },
    id: 'booking-1',
    participants: [],
    preferredProviderId: null,
    selectedProviderId: 'provider-1',
    selectedProvider: {
      id: 'provider-1',
      displayName: 'Smoke Partner',
      status: 'ONLINE_BUSY',
      user: {
        fullName: 'Smoke Partner',
        phone: '+84900002222',
      },
    },
    services: [
      {
        price: 400000,
        quantity: 1,
        service: {
          name: 'Deep Tissue',
          durationMin: 60,
        },
      },
    ],
    status: 'IN_SERVICE',
    updatedAt: '2026-06-29T01:12:00.000Z',
  } as AdminBookingDetail;
}
