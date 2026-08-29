import {
  BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS,
  BOOKING_MONITOR_FALLBACK_REFRESH_MS,
  BOOKING_MONITOR_REALTIME_EVENTS,
  startBookingMonitorRealtime,
  bookingMonitorUsesRealtime,
} from './booking-monitor-realtime';

describe('booking monitor realtime context', () => {
  it('keeps historical records and non-live workspaces off the realtime token path', () => {
    expect(bookingMonitorUsesRealtime('/bookings', 'active')).toBe(true);
    expect(bookingMonitorUsesRealtime('/bookings', 'all')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'pre-match-cancelled')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'preferred-rejected')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'preferred-no-response')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'usage-unresolved')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings/completed', 'closeout')).toBe(false);
  });

  it('keeps fallback polling off while the socket is live', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket();
    const refresh = vi.fn();
    const stop = startBookingMonitorRealtime({
      connectSocket: vi.fn(async () => socket),
      loadToken: tokenLoader(),
      onStateChange: vi.fn(),
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);

    socket.emit('connect');
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS * 2);

    expect(refresh).not.toHaveBeenCalled();
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('uses bounded fallback refresh while connecting and stops it after recovery', async () => {
    vi.useFakeTimers();
    const firstSocket = fakeSocket();
    const recoveredSocket = fakeSocket();
    const connectSocket = vi
      .fn()
      .mockResolvedValueOnce(firstSocket)
      .mockResolvedValueOnce(recoveredSocket);
    const onStateChange = vi.fn();
    const refresh = vi.fn();
    const stop = startBookingMonitorRealtime({
      connectSocket,
      loadToken: tokenLoader(),
      onStateChange,
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS);
    expect(refresh).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenCalledWith('error');

    firstSocket.emit('connect_error');
    await vi.advanceTimersByTimeAsync(1000);
    expect(connectSocket).toHaveBeenCalledTimes(2);
    recoveredSocket.emit('connect');
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS * 2);
    expect(refresh).toHaveBeenCalledOnce();

    stop();
    expect(firstSocket.disconnect).toHaveBeenCalledOnce();
    expect(recoveredSocket.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('uses fallback after connect_error and cancels it when the retry connects', async () => {
    vi.useFakeTimers();
    const failedSocket = fakeSocket();
    const recoveredSocket = fakeSocket();
    const refresh = vi.fn();
    const stop = startBookingMonitorRealtime({
      connectSocket: vi
        .fn()
        .mockResolvedValueOnce(failedSocket)
        .mockResolvedValueOnce(recoveredSocket),
      loadToken: tokenLoader(),
      onStateChange: vi.fn(),
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);

    failedSocket.emit('connect_error');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS - 1000);
    expect(refresh).toHaveBeenCalledOnce();

    recoveredSocket.emit('connect');
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS * 2);
    expect(refresh).toHaveBeenCalledOnce();

    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('keeps the 750ms event debounce and deduplicates an overlapping fallback', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket();
    const refresh = vi.fn();
    const stop = startBookingMonitorRealtime({
      connectSocket: vi.fn(async () => socket),
      loadToken: tokenLoader(),
      onStateChange: vi.fn(),
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(
      BOOKING_MONITOR_FALLBACK_REFRESH_MS - BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS,
    );
    socket.emit(BOOKING_MONITOR_REALTIME_EVENTS[0]);
    socket.emit(BOOKING_MONITOR_REALTIME_EVENTS[1]);
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS);

    expect(refresh).toHaveBeenCalledOnce();
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('cleans up socket and pending timers when live updates are paused or unmounted', async () => {
    vi.useFakeTimers();
    const socket = fakeSocket();
    const refresh = vi.fn();
    const stop = startBookingMonitorRealtime({
      connectSocket: vi.fn(async () => socket),
      loadToken: tokenLoader(),
      onStateChange: vi.fn(),
      refresh,
    });
    await vi.advanceTimersByTimeAsync(0);
    socket.emit(BOOKING_MONITOR_REALTIME_EVENTS[0]);

    stop();
    await vi.advanceTimersByTimeAsync(BOOKING_MONITOR_FALLBACK_REFRESH_MS * 2);

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

function tokenLoader() {
  return vi.fn(async () => ({ socketBaseUrl: 'http://localhost:3000', token: 'test-token' }));
}

function fakeSocket() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    disconnect: vi.fn(),
    emit(eventName: string) {
      for (const listener of listeners.get(eventName) ?? []) listener();
    },
    on: vi.fn((eventName: string, listener: () => void) => {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
    }),
  };
}
