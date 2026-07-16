import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type { AdminChatArchiveBooking } from '../../lib/admin-api';
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

  it('keeps chat repair in the booking operations queue instead of duplicating it', () => {
    expect(pageSource).toContain('/bookings?view=chat-repair');
    expect(pageSource).not.toContain('AdminTraceSummary');
    expect(pageSource).not.toContain('Chat integrity repair queue');
  });

  it('renders retained chat totals separately from the latest-message list preview', async () => {
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
    expect(markup).toContain('<span class="metric-card-scope is-record">All loaded records</span>');
    expect(markup).toContain('<span class="metric-card-scope is-live">Current open</span>');
    expect(markup).toContain('<span class="metric-card-scope is-risk">Needs action</span>');
    expect(markup).not.toContain('Chat window previews');
    expect(markup).toContain('/bookings/booking-1?overview=activity#booking-chat-history');
    expect(markup).toContain('Export page preview CSV');
    expect(markup).toContain('admin-section');
    expect(markup).toContain('Chat evidence index');
    expect(markup).not.toContain('admin-chat-transcript-disclosure');
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
    expect(markup).toContain('Sender: Partner messages');
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

    expect(markup).toContain('admin-form-search');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('calendar-datepicker-field');
    expect(markup).toContain('card admin-filter-panel chat-archive-filter-panel admin-mb-16 admin-section');
    expect(markup).toContain('admin-form-search admin-directory-filter-search');
    expect(markup).toContain('admin-form-select admin-form-control-labeled admin-directory-filter-select');
    expect(markup).toContain(
      'react-datepicker-wrapper admin-form-control-fluid calendar-datepicker-field',
    );
    expect(markup).toContain(
      'admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled calendar-datepicker-input',
    );
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('admin-form-control-link');
    expect(markup).toContain('admin-filter-summary');
    expect(markup).toContain('Active chat evidence filters');
    expect(markup).toContain('Date: All loaded records');
    expect(markup).not.toContain('calendar-field');
    expect(markup).not.toContain('<div class="calendar-field"><span>Search</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Booking status</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>From</span>');
    expect(markup).not.toContain('<label>Search<input');
    expect(markup).not.toContain('<label>Booking status<select');
  });

  it('summarizes active chat evidence filters for operators', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive')) {
        return [chatArchiveBooking()];
      }

      if (href.startsWith('/admin/bookings')) {
        return [];
      }

      return fallback;
    });

    const page = await ChatArchivePage({
      searchParams: Promise.resolve({
        q: 'booking-1',
        range: 'all',
        sender: 'partner',
        status: 'completed',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Date: All loaded records');
    expect(markup).toContain('Search: booking-1');
    expect(markup).toContain('Status: Completed');
    expect(markup).toContain('Sender: Partner messages');
  });

  it('uses the shared AdminFormControlLink atom for button-style archive actions', () => {
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('AdminDisclosureCard');
    expect(pageSource).not.toContain('AdminStageList');
    expect(pageSource).not.toContain('<div className="setup-stage-list');
    expect(pageSource).not.toContain('<Link className="button button-secondary"');
    expect(pageSource).not.toContain('className="button button-secondary chat-inline-action"');
    expect(pageSource).not.toContain('<details className="card admin-disclosure');
  });

  it('keeps visible chat status chips on shared badge atoms', () => {
    expect(pageSource).toContain('AdminEmptyState');
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

  it('keeps full transcript rendering in the booking activity workspace', () => {
    expect(pageSource).toContain('?overview=activity#booking-chat-history');
    expect(pageSource).not.toContain('AdminChatWindow');
    expect(pageSource).not.toContain('chatArchiveWindowMessages');
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
} = {}): AdminChatArchiveBooking {
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
        fullName: 'Demo Customer',
        phone: '+84900001111',
      },
    },
    id: 'booking-1',
    selectedProvider: {
      id: 'provider-1',
      displayName: 'Smoke Partner',
      user: {
        fullName: 'Smoke Partner',
        phone: '+84900002222',
      },
    },
    services: [
      {
        service: {
          name: 'Deep Tissue',
          durationMin: 60,
        },
      },
    ],
    status: 'IN_SERVICE',
    updatedAt: '2026-06-29T01:12:00.000Z',
  };
}
