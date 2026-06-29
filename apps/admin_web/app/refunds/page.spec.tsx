import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminRefund, AdminRefundSummary } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import RefundsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('RefundsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server refund rows without applying a second local filter', async () => {
    const summary: AdminRefundSummary = {
      totalCount: 42,
      requestedCount: 17,
      refundedBookingCount: 8,
      needsUpdateCount: 6,
      completedCount: 9,
      openCount: 24,
      outcomeLinkedCount: 12,
    };
    const serverRefund = {
      amount: 150000,
      booking: {
        customerProfile: {
          user: {
            fullName: 'Server Trusted Refund',
            phone: '+84900004444',
          },
        },
        selectedProvider: {
          displayName: 'Refund Partner',
        },
        status: 'COMPLETED',
      },
      bookingId: 'server-refund-booking',
      createdAt: '2026-06-28T09:00:00.000Z',
      id: 'server-refund-row',
      payment: {
        currency: 'VND',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'server-payment-row',
      status: 'COMPLETED',
    } as AdminRefund;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/refunds?range=today&take=10&review=requested') {
        return [serverRefund];
      }
      if (href === '/admin/refunds/summary?range=today&review=requested') {
        return summary;
      }
      return fallback;
    });

    const page = await RefundsPage({
      searchParams: Promise.resolve({ range: 'today', review: 'requested' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/refunds?range=today&take=10&review=requested',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/refunds/summary?range=today&review=requested',
      expect.objectContaining({ totalCount: 0 }),
    );
    expect(markup).toContain('Server Trusted Refund');
    expect(markup).toContain('42');
    expect(markup).toContain('Showing 1 to 1 of 42 entries');
  });

  it('requests the correct refund page from the server and renders rounded pagination', async () => {
    const summary: AdminRefundSummary = {
      totalCount: 42,
      requestedCount: 17,
      refundedBookingCount: 8,
      needsUpdateCount: 6,
      completedCount: 9,
      openCount: 24,
      outcomeLinkedCount: 12,
    };
    const serverRefund = {
      amount: 150000,
      booking: {
        customerProfile: {
          user: {
            fullName: 'Paged Refund Customer',
            phone: '+84900005555',
          },
        },
        selectedProvider: {
          displayName: 'Paged Refund Partner',
        },
        status: 'COMPLETED',
      },
      bookingId: 'paged-refund-booking',
      createdAt: '2026-06-28T09:00:00.000Z',
      id: 'paged-refund-row',
      payment: {
        currency: 'VND',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'paged-payment-row',
      status: 'COMPLETED',
    } as AdminRefund;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/refunds?range=today&take=10&review=requested&skip=20') {
        return [serverRefund];
      }
      if (href === '/admin/refunds/summary?range=today&review=requested') {
        return summary;
      }
      return fallback;
    });

    const page = await RefundsPage({
      searchParams: Promise.resolve({ page: '3', range: 'today', review: 'requested' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/refunds?range=today&take=10&review=requested&skip=20',
      [],
    );
    expect(markup).toContain('Paged Refund Customer');
    expect(markup).toContain('Showing 21 to 21 of 42 entries');
    expect(markup).toContain('aria-label="Refund pagination"');
    expect(markup).toContain('/refunds?range=today&amp;review=requested&amp;page=4');
  });
});
