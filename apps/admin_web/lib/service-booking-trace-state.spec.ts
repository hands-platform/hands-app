import { serviceBookingTraceState } from './service-booking-trace-state';

describe('service booking trace state', () => {
  it('marks a booking trace complete when all finance records are ready', () => {
    expect(
      serviceBookingTraceState({
        earningReady: true,
        paymentReady: true,
        taxReady: true,
        walletReady: true,
      }),
    ).toEqual({
      traceStatus: 'Complete',
      traceTone: 'pill-success',
    });
  });

  it('lists missing finance trace parts in the existing order', () => {
    expect(
      serviceBookingTraceState({
        earningReady: false,
        paymentReady: true,
        taxReady: false,
        walletReady: false,
      }),
    ).toEqual({
      traceStatus: 'Missing earning/tax/wallet',
      traceTone: 'pill-warn',
    });
  });

  it('shows all missing parts when the booking has no finance trace yet', () => {
    expect(
      serviceBookingTraceState({
        earningReady: false,
        paymentReady: false,
        taxReady: false,
        walletReady: false,
      }),
    ).toEqual({
      traceStatus: 'Missing payment/earning/tax/wallet',
      traceTone: 'pill-warn',
    });
  });
});
