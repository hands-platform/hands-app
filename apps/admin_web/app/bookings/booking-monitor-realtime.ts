export const BOOKING_MONITOR_REALTIME_EVENTS = [
  'booking.opened',
  'provider.joined',
  'provider.accepted',
  'provider.rejected',
  'booking.matched',
  'booking.expired',
  'booking.cancelled',
  'service.started',
  'service.completed',
] as const;

export type BookingMonitorRealtimeState = 'connecting' | 'error' | 'live' | 'paused';

export const BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS = 750;
export const BOOKING_MONITOR_FALLBACK_REFRESH_MS = 20_000;
const BOOKING_MONITOR_REALTIME_RECONNECT_MS = 1000;

type BookingMonitorRealtimeSocket = {
  disconnect: () => void;
  on: (eventName: string, listener: () => void) => void;
};

type BookingMonitorRealtimeToken = {
  readonly socketBaseUrl: string;
  readonly token: string;
};

type StartBookingMonitorRealtimeOptions = {
  readonly connectSocket: (
    token: BookingMonitorRealtimeToken,
  ) => BookingMonitorRealtimeSocket | Promise<BookingMonitorRealtimeSocket>;
  readonly loadToken: () => Promise<BookingMonitorRealtimeToken>;
  readonly onStateChange: (state: Exclude<BookingMonitorRealtimeState, 'paused'>) => void;
  readonly refresh: () => void;
};

export const BOOKING_RECORD_VIEWS = new Set([
  'all',
  'pre-match-cancelled',
  'preferred-rejected',
  'preferred-no-response',
  'usage-unresolved',
]);

export function bookingMonitorIsRecordsView(path: string, view: string) {
  return path === '/bookings' && BOOKING_RECORD_VIEWS.has(view);
}

export function bookingMonitorUsesRealtime(path: string, view: string) {
  return path === '/bookings' && !bookingMonitorIsRecordsView(path, view);
}

export function bookingMonitorRealtimeLabel(state: BookingMonitorRealtimeState) {
  if (state === 'live') {
    return 'Realtime live';
  }

  if (state === 'paused') {
    return 'Realtime paused';
  }

  if (state === 'error') {
    return 'Realtime disconnected';
  }

  return 'Realtime connecting';
}

export function startBookingMonitorRealtime({
  connectSocket,
  loadToken,
  onStateChange,
  refresh,
}: StartBookingMonitorRealtimeOptions) {
  let closed = false;
  let currentState: Exclude<BookingMonitorRealtimeState, 'paused'> = 'connecting';
  let eventRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshLockTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshLocked = false;
  let socket: BookingMonitorRealtimeSocket | null = null;

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer !== null) globalThis.clearTimeout(timer);
  };

  const runRefresh = () => {
    if (closed || refreshLocked) return;

    refreshLocked = true;
    refresh();
    refreshLockTimer = globalThis.setTimeout(() => {
      refreshLockTimer = null;
      refreshLocked = false;
    }, BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS);
  };

  const ensureFallback = () => {
    if (closed || currentState === 'live' || fallbackTimer !== null) return;

    fallbackTimer = globalThis.setTimeout(() => {
      fallbackTimer = null;
      if (closed || currentState === 'live') return;

      if (eventRefreshTimer !== null) {
        clearTimer(eventRefreshTimer);
        eventRefreshTimer = null;
      }
      if (currentState === 'connecting') {
        currentState = 'error';
        onStateChange('error');
      }
      runRefresh();
      ensureFallback();
    }, BOOKING_MONITOR_FALLBACK_REFRESH_MS);
  };

  const setRealtimeState = (state: Exclude<BookingMonitorRealtimeState, 'paused'>) => {
    currentState = state;
    onStateChange(state);
    if (state === 'live') {
      clearTimer(fallbackTimer);
      fallbackTimer = null;
      return;
    }
    ensureFallback();
  };

  const scheduleEventRefresh = () => {
    if (closed || eventRefreshTimer !== null) return;

    eventRefreshTimer = globalThis.setTimeout(() => {
      eventRefreshTimer = null;
      runRefresh();
    }, BOOKING_MONITOR_EVENT_REFRESH_DEBOUNCE_MS);
  };

  const scheduleReconnect = (connect: () => Promise<void>) => {
    if (closed || reconnectTimer !== null) return;

    reconnectTimer = globalThis.setTimeout(() => {
      reconnectTimer = null;
      if (closed) return;
      setRealtimeState('connecting');
      void connect();
    }, BOOKING_MONITOR_REALTIME_RECONNECT_MS);
  };

  const connect = async () => {
    try {
      const token = await loadToken();
      if (closed) return;

      const nextSocket = await connectSocket(token);
      if (closed) {
        nextSocket.disconnect();
        return;
      }
      socket = nextSocket;
      socket.on('connect', () => {
        if (!closed) setRealtimeState('live');
      });
      socket.on('connect_error', () => {
        if (closed) return;
        setRealtimeState('error');
        socket?.disconnect();
        scheduleReconnect(connect);
      });
      socket.on('disconnect', () => {
        if (!closed && currentState !== 'error') setRealtimeState('connecting');
      });
      for (const eventName of BOOKING_MONITOR_REALTIME_EVENTS) {
        socket.on(eventName, scheduleEventRefresh);
      }
    } catch {
      if (!closed) {
        setRealtimeState('error');
        scheduleReconnect(connect);
      }
    }
  };

  onStateChange('connecting');
  ensureFallback();
  void connect();

  return () => {
    closed = true;
    clearTimer(eventRefreshTimer);
    clearTimer(fallbackTimer);
    clearTimer(reconnectTimer);
    clearTimer(refreshLockTimer);
    eventRefreshTimer = null;
    fallbackTimer = null;
    reconnectTimer = null;
    refreshLockTimer = null;
    socket?.disconnect();
    socket = null;
  };
}
