import { MatchingService } from './matching.service';

describe('MatchingService booking timeout queue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules booking timeout jobs with the shared queue descriptor', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));
    const queue = { add: vi.fn() };
    const service = new MatchingService({} as never, {} as never, {} as never, queue as never);

    await service.scheduleBookingTimeout('booking-1', new Date('2026-06-11T00:10:00.000Z'));

    expect(queue.add).toHaveBeenCalledWith(
      'booking-timeout',
      { bookingId: 'booking-1' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        delay: 600_000,
        jobId: 'booking-timeout-booking-1',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  });

  it('returns the current booking status after matching activates service', () => {
    const service = new MatchingService({} as never, {} as never, {} as never, {} as never);

    expect(service.selectFinalProvider('booking-1', { id: 'booking-1', status: 'IN_SERVICE' })).toEqual(
      expect.objectContaining({ status: 'IN_SERVICE' }),
    );
  });
});
