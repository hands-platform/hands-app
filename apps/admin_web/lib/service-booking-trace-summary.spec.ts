import { serviceBookingTraceSummary } from './service-booking-trace-summary';

describe('service booking trace summary', () => {
  it('sums booking finance trace amounts and missing trace count', () => {
    const summary = serviceBookingTraceSummary([
      {
        booking: {
          earning: { netAmount: 700 },
          payment: { amount: 1000 },
        },
        currency: 'VND',
        platformFeeAmount: 120,
        taxWithheldAmount: 80,
        traceStatus: 'Complete',
        walletAmount: 700,
      },
      {
        booking: {
          earning: { netAmount: 500 },
          payment: { amount: 900 },
        },
        currency: 'VND',
        platformFeeAmount: 100,
        taxWithheldAmount: 40,
        traceStatus: 'Missing wallet',
        walletAmount: 0,
      },
    ]);

    expect(summary).toEqual({
      currency: 'VND',
      missingTraceCount: 1,
      paymentAmount: 1900,
      platformFeeAmount: 220,
      providerNetAmount: 1200,
      withholdingAmount: 120,
      walletAmount: 700,
    });
  });

  it('returns an empty VND summary when there are no rows', () => {
    expect(serviceBookingTraceSummary([])).toEqual({
      currency: 'VND',
      missingTraceCount: 0,
      paymentAmount: 0,
      platformFeeAmount: 0,
      providerNetAmount: 0,
      withholdingAmount: 0,
      walletAmount: 0,
    });
  });
});
