import { MatchingService } from './matching.service';

describe('MatchingService booking timeout queue', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules booking timeout jobs with the shared queue descriptor', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));
    const queue = { add: jest.fn() };
    const service = new MatchingService({} as never, {} as never, {} as never, queue as never);

    await service.scheduleBookingTimeout('booking-1', new Date('2026-06-11T00:10:00.000Z'));

    expect(queue.add).toHaveBeenCalledWith(
      'booking-timeout',
      { bookingId: 'booking-1' },
      {
        delay: 600_000,
        jobId: 'booking-timeout-booking-1',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });
});
