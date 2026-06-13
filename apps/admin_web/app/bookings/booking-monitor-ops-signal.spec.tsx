import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorOpsSignal,
  bookingMonitorOpsSignalStateForBooking,
} from './booking-monitor-ops-signal';

describe('booking monitor ops signal', () => {
  it('maps booking facts into the ops signal state', () => {
    expect(
      bookingMonitorOpsSignalStateForBooking({
        id: 'open-no-supply',
        participants: [],
        status: 'OPEN_MATCHING',
      } as unknown as AdminBooking),
    ).toEqual({
      label: 'No marketplace partners yet',
      tone: 'warn',
    });
  });

  it('renders the signal class and label used by the booking list row', () => {
    expect(
      renderToStaticMarkup(
        bookingMonitorOpsSignal({
          id: 'matched-missing-chat',
          status: 'MATCHED',
        } as unknown as AdminBooking),
      ),
    ).toBe('<span class="signal signal-warn">Chat missing</span>');
  });
});
