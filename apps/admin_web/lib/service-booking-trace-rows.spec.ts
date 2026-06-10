import type { AdminServiceCatalogItem } from './admin-api';
import { serviceBookingTraceRows } from './service-booking-trace-rows';

describe('service booking trace rows', () => {
  it('builds sorted booking trace rows with finance totals and readiness state', () => {
    const rows = serviceBookingTraceRows([
      serviceFixture({
        bookingCreatedAt: '2026-01-01T10:00:00.000Z',
        name: 'Foot massage',
        walletAmount: 700,
      }),
      serviceFixture({
        bookingCreatedAt: '2026-01-02T10:00:00.000Z',
        includeEarning: false,
        name: 'Thai massage',
        walletAmount: 0,
      }),
    ]);

    expect(
      rows.map((row) => ({
        currency: row.currency,
        platformFeeAmount: row.platformFeeAmount,
        serviceName: row.service.name,
        taxWithheldAmount: row.taxWithheldAmount,
        traceStatus: row.traceStatus,
        traceTone: row.traceTone,
        walletAmount: row.walletAmount,
        walletEntryCount: row.walletEntryCount,
      })),
    ).toEqual([
      {
        currency: 'VND',
        platformFeeAmount: 150,
        serviceName: 'Thai massage',
        taxWithheldAmount: 80,
        traceStatus: 'Missing earning/wallet',
        traceTone: 'pill-warn',
        walletAmount: 0,
        walletEntryCount: 0,
      },
      {
        currency: 'VND',
        platformFeeAmount: 150,
        serviceName: 'Foot massage',
        taxWithheldAmount: 80,
        traceStatus: 'Complete',
        traceTone: 'pill-success',
        walletAmount: 700,
        walletEntryCount: 1,
      },
    ]);
  });

  it('limits trace rows for large catalogs', () => {
    const rows = serviceBookingTraceRows(
      Array.from({ length: 30 }, (_, index) =>
        serviceFixture({
          bookingCreatedAt: `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
          name: `Service ${index + 1}`,
          walletAmount: 100,
        }),
      ),
    );

    expect(rows).toHaveLength(24);
    expect(rows[0]?.service.name).toBe('Service 30');
  });
});

function serviceFixture({
  bookingCreatedAt,
  includeEarning = true,
  name,
  walletAmount,
}: {
  readonly bookingCreatedAt: string;
  readonly includeEarning?: boolean;
  readonly name: string;
  readonly walletAmount: number;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 1000,
    bookings: [
      {
        bookingId: `${name}-booking`,
        id: `${name}-booking-service`,
        price: 1000,
        quantity: 1,
        serviceId: `${name}-service`,
        booking: {
          createdAt: bookingCreatedAt,
          id: `${name}-booking`,
          status: 'COMPLETED',
          earning: includeEarning
            ? {
                currency: 'VND',
                grossAmount: 1000,
                id: `${name}-earning`,
                netAmount: 700,
                platformFee: 150,
                status: 'READY',
                withholdingAmount: 80,
              }
            : null,
          payment: {
            amount: 1000,
            currency: 'VND',
            method: 'CASH',
            status: 'PAID',
          },
          platformFeeLogs: [
            {
              currency: 'VND',
              id: `${name}-platform-fee`,
              platformFeeAmount: 150,
            },
          ],
          taxLogs: [
            {
              currency: 'VND',
              id: `${name}-tax`,
              taxableAmount: 1000,
              withholdingAmount: 80,
            },
          ],
          walletLedgerEntries:
            walletAmount > 0
              ? [
                  {
                    amount: walletAmount,
                    currency: 'VND',
                    id: `${name}-wallet`,
                    type: 'CREDIT',
                  },
                ]
              : [],
        },
      },
    ],
    displayOrder: 0,
    durationMin: 60,
    id: `${name}-service`,
    name,
    priceStep: 100,
  };
}
