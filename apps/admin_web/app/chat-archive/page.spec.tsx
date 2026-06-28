import { renderToStaticMarkup } from 'react-dom/server';
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

describe('ChatArchivePage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders retained chat totals separately from bounded preview messages', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive')) {
        return [chatArchiveBooking()];
      }

      if (href.startsWith('/admin/bookings')) {
        return [];
      }

      return fallback;
    });

    const page = await ChatArchivePage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1 room(s), 42 message(s)');
    expect(markup).toContain('Chat window previews');
    expect(markup).toContain('2 shown / 42 total');
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

    const page = await ChatArchivePage({ searchParams: Promise.resolve({ sender: 'partner' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('1 room(s), 42 message(s)');
    expect(markup).toContain('1 shown / 42 total');
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
