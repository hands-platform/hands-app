import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import type { AdminChatArchiveMessage } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import ChatArchivePage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});
vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRedirect = vi.mocked(redirect);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');
const chatArchiveCss = globalCss.slice(
  globalCss.indexOf('.chat-archive-page {'),
  globalCss.indexOf('.audit-log-page,', globalCss.indexOf('.chat-archive-page {')),
);

describe('ChatArchivePage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRedirect.mockClear();
  });

  it('renders one result per matching message without phone or fake presence data', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/chat-archive/summary')) {
        return {
          data: {
            generatedAt: '2026-08-06T01:30:00.000Z',
            latestMessageAt: '2026-08-06T01:20:00.000Z',
            matchingMessages: 12,
            roomsRepresented: 4,
          },
          ok: true,
          status: 200,
        };
      }
      if (href.startsWith('/admin/chat-archive')) {
        return { data: [chatArchiveMessage()], ok: true, status: 200 };
      }
      return { data: fallback, ok: false, status: 404 };
    });

    const page = await ChatArchivePage({
      searchParams: Promise.resolve({ q: 'late', range: '7d', sender: 'partner' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Restricted internal evidence · Read only');
    expect(markup).toContain('12 messages · 4 rooms');
    expect(markup).toContain('I am on the way.');
    expect(markup).toContain('Attachment 1');
    expect(markup).toContain('>booking-prod<');
    expect(markup).toContain('aria-label="Booking booking-production-1"');
    expect(markup).toContain('returnTo=%2Fchat-archive%3Fq%3Dlate%26sender%3Dpartner%26range%3D7d');
    expect(markup).toContain('Open transcript');
    expect((markup.match(/href="\/bookings\/booking-production-1\?/gu) ?? [])).toHaveLength(1);
    expect(markup).not.toContain('messages shown');
    expect(markup).not.toContain('+8490000');
    expect(markup).not.toContain('Export page preview CSV');
    expect(markup).not.toContain('Rooms loaded');
    expect(markup).not.toContain('avatar-status');
  });

  it('keeps a valid message list visible when summary loading fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href) =>
      href.startsWith('/admin/chat-archive/summary')
        ? { data: {}, ok: false, status: 503 }
        : { data: [chatArchiveMessage()], ok: true, status: 200 },
    );

    const page = await ChatArchivePage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Summary unavailable');
    expect(markup).toContain('I am on the way.');
    expect(markup).not.toContain('0 matching messages');
  });

  it('renders API failure separately from a true empty result', async () => {
    mockedAdminGetResult.mockImplementation(async (href) =>
      href.startsWith('/admin/chat-archive/summary')
        ? { data: { matchingMessages: 0, roomsRepresented: 0 }, ok: true, status: 200 }
        : { data: [], ok: false, status: 503 },
    );

    const page = await ChatArchivePage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Chat evidence could not be loaded');
    expect(markup).toContain('Retry search');
    expect(markup).not.toContain('No retained messages yet');
  });

  it('does not call either API for an invalid custom range', async () => {
    const page = await ChatArchivePage({
      searchParams: Promise.resolve({ from: '2026-08-06', range: 'custom' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGetResult).not.toHaveBeenCalled();
    expect(markup).toContain('Custom date range requires valid From and To dates.');
    expect(markup).toContain('No API request was sent.');
    expect(markup).toContain('Search not run');
    expect(markup).not.toContain('No matching messages');
  });

  it('keeps all active filters visible and clear returns to all dates', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: [], ok: true, status: 200 });

    const page = await ChatArchivePage({
      searchParams: Promise.resolve({
        q: 'booking-1',
        range: '30d',
        sender: 'customer',
        sort: 'oldest',
        status: 'completed',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Sent: Last 30 days');
    expect(markup).toContain('Sort: Oldest first');
    expect(markup).toContain('Search: booking-1');
    expect(markup).toContain('Booking: Completed');
    expect(markup).toContain('Sender: Customer');
    expect(markup).toContain('href="/chat-archive"');
  });

  it('does not render default date and sort chips', async () => {
    mockedAdminGetResult.mockImplementation(async (href) =>
      href.startsWith('/admin/chat-archive/summary')
        ? { data: { matchingMessages: 0, roomsRepresented: 0 }, ok: true, status: 200 }
        : { data: [], ok: true, status: 200 },
    );

    const page = await ChatArchivePage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('Sent: All dates');
    expect(markup).not.toContain('Sort: Newest first');
  });

  it.each([
    [{}, 'No retained booking messages are available in this scope.', 'No retained messages'],
    [
      { q: '__no_match__' },
      'No messages match the current search and filters.',
      'No matching messages',
    ],
  ])('keeps retained-empty and filtered-empty copy distinct %#', async (searchParams, copy, title) => {
    mockedAdminGetResult.mockImplementation(async (href) =>
      href.startsWith('/admin/chat-archive/summary')
        ? { data: { matchingMessages: 0, roomsRepresented: 0 }, ok: true, status: 200 }
        : { data: [], ok: true, status: 200 },
    );

    const page = await ChatArchivePage({ searchParams: Promise.resolve(searchParams) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(copy);
    expect(markup).toContain(title);
    expect(markup).toContain('A missing result does not confirm that no conversation occurred.');
  });

  it.each([
    ['way.', '<mark>way.</mark>'],
    ['Minh', '<mark>Minh</mark> Anh'],
    ['booking-prod', '<mark>booking-prod</mark>'],
    ['Deep Tissue', '<mark>Deep Tissue</mark>'],
  ])('safely highlights the visible %s match', async (q, expected) => {
    mockedAdminGetResult.mockImplementation(async (href) =>
      href.startsWith('/admin/chat-archive/summary')
        ? { data: { matchingMessages: 1, roomsRepresented: 1 }, ok: true, status: 200 }
        : { data: [chatArchiveMessage()], ok: true, status: 200 },
    );

    const page = await ChatArchivePage({ searchParams: Promise.resolve({ q }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(expected);
  });

  it('canonicalizes unknown filters before any evidence API request', async () => {
    await expect(
      ChatArchivePage({
        searchParams: Promise.resolve({ q: 'late', status: 'missing-room' }),
      }),
    ).rejects.toThrow('REDIRECT:/chat-archive?q=late');

    expect(mockedAdminGetResult).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith('/chat-archive?q=late');
  });

  it('canonicalizes an out-of-range page to the last message page', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { matchingMessages: 12, roomsRepresented: 4 },
      ok: true,
      status: 200,
    });

    await expect(ChatArchivePage({
      searchParams: Promise.resolve({ page: '999', q: 'late', range: '7d', sender: 'partner' }),
    })).rejects.toThrow('REDIRECT:/chat-archive?q=late&sender=partner&range=7d&page=2');
    expect(mockedRedirect).toHaveBeenCalledWith('/chat-archive?q=late&sender=partner&range=7d&page=2');
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
  });

  it('keeps full transcripts in Booking Activity and removes nested scrolling contracts', () => {
    expect(pageSource).toContain('?overview=activity&returnTo=');
    expect(pageSource).not.toContain('AdminChatWindow');
    expect(pageSource).not.toContain('AdminDataTable');
    expect(pageSource).not.toContain('buildCsvDataHref');
    expect(pageSource).not.toContain('phone');
    expect(chatArchiveCss).not.toContain('.chat-archive-page .admin-table-scroll .table');
    expect(chatArchiveCss).not.toContain('min-width: 1180px');
    expect(chatArchiveCss).not.toContain('.chat-archive-page > .card {\n  max-height:');
    expect(chatArchiveCss).toContain('@media (max-width: 1399px)');
  });
});

function chatArchiveMessage(): AdminChatArchiveMessage {
  return {
    attachmentCount: 1,
    body: 'I am on the way.',
    chatRoom: {
      booking: {
        customerProfile: { id: 'customer-1', user: { fullName: 'Demo Customer' } },
        customerProfileId: 'customer-1',
        id: 'booking-production-1',
        selectedProvider: {
          displayName: 'Minh Anh',
          id: 'partner-1',
          user: { fullName: 'Minh Anh' },
        },
        services: [{ service: { durationMin: 60, name: 'Deep Tissue' } }],
        status: 'IN_SERVICE',
      },
      id: 'chat-room-1',
    },
    createdAt: '2026-08-06T01:20:00.000Z',
    id: 'message-1',
    sender: { fullName: 'Minh Anh', id: 'partner-user-1', roles: ['PROVIDER'] },
  };
}
