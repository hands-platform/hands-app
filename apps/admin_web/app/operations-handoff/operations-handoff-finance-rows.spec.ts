import type { AdminEarning } from '../../lib/admin-api';
import { buildFinanceRows } from './operations-handoff-finance-rows';

describe('operations handoff finance rows model', () => {
  it('keeps non-paid and negative earnings with operator-facing Partner copy', () => {
    const rows = buildFinanceRows([
      earning({
        id: 'earning-negative',
        netAmount: -50000,
        providerProfile: { displayName: 'Provider Linh' },
        status: 'PAID',
      }),
      earning({
        id: 'earning-available',
        netAmount: 120000,
        providerProfile: { user: { fullName: 'Partner Mai' } },
        status: 'AVAILABLE',
      }),
      earning({
        id: 'earning-paid',
        netAmount: 100000,
        status: 'PAID',
      }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['earning-negative', 'earning-available']);
    expect(rows[0]).toMatchObject({
      partnerName: 'Partner Linh',
      reviewReason: 'Negative wallet effect creates or increases Partner receivable.',
      statusClass: 'pill pill-danger',
    });
    expect(rows[1]).toMatchObject({
      partnerName: 'Partner Mai',
      reviewReason: 'Available earning still needs payout release review.',
      statusClass: 'pill pill-info',
    });
  });

  it('uses a warning class for pending positive earnings', () => {
    expect(buildFinanceRows([earning({ netAmount: 100000, status: 'PENDING' })])[0]).toMatchObject({
      partnerName: 'Partner',
      reviewReason: 'Earning is not fully paid yet.',
      statusClass: 'pill pill-warn',
    });
  });
});

function earning(input: Partial<AdminEarning>): AdminEarning {
  return {
    bookingId: 'booking-1',
    currency: 'VND',
    grossAmount: 150000,
    id: 'earning-1',
    netAmount: 120000,
    platformFee: 20000,
    providerProfileId: 'partner-1',
    status: 'AVAILABLE',
    withholdingAmount: 10000,
    ...input,
  };
}
