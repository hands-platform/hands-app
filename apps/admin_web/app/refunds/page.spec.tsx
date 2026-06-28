import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminRefund } from '../../lib/admin-api';
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

    mockedAdminGet.mockResolvedValue([serverRefund]);

    const page = await RefundsPage({
      searchParams: Promise.resolve({ range: 'today', review: 'requested' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/refunds?range=today&take=100&review=requested',
      [],
    );
    expect(markup).toContain('Server Trusted Refund');
  });
});
