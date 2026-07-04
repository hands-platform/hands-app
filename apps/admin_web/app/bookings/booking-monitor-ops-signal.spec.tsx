import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorOpsSignal,
  bookingMonitorOpsSignalStateForBooking,
} from './booking-monitor-ops-signal';

describe('booking monitor ops signal', () => {
  it('uses the shared AdminSignal atom for row signal chips', () => {
    const source = readFileSync(new URL('./booking-monitor-ops-signal.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain('<span className={`signal signal-${tone}`}>');
  });

  it('maps booking facts into the ops signal state', () => {
    expect(
      bookingMonitorOpsSignalStateForBooking({
        id: 'open-no-supply',
        participants: [],
        status: 'OPEN_MATCHING',
      } as unknown as AdminBooking),
    ).toEqual({
      label: 'No marketplace Partners yet',
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
