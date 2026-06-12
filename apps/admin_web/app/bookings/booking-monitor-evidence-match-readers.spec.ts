import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorEvidenceMatchReadersFromBooking,
  type BookingMonitorEvidenceOpsReaders,
} from './booking-monitor-evidence-match-readers';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    ...overrides,
  } as AdminBooking;
}

function opsReaders(
  overrides: Partial<Record<keyof BookingMonitorEvidenceOpsReaders, boolean>> = {},
): BookingMonitorEvidenceOpsReaders {
  return {
    addressNeedsOps: () => overrides.addressNeedsOps ?? false,
    alertEvidenceNeedsOps: () => overrides.alertEvidenceNeedsOps ?? false,
    cashDebtNeedsOps: () => overrides.cashDebtNeedsOps ?? false,
    closeoutNeedsOps: () => overrides.closeoutNeedsOps ?? false,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
  };
}

describe('bookingMonitorEvidenceMatchReadersFromBooking', () => {
  it('maps booking state into evidence readers', () => {
    const readers = bookingMonitorEvidenceMatchReadersFromBooking(
      booking({
        status: 'PROVIDER_ON_THE_WAY',
        chatRoom: { id: 'chat-1', messages: [] } as AdminBooking['chatRoom'],
        selectedProvider: {
          currentLat: '10.7769',
          currentLng: '106.7009',
        } as AdminBooking['selectedProvider'],
      }),
      opsReaders({ paymentNeedsOps: true }),
    );

    expect(readers.activeStatus()).toBe(true);
    expect(readers.chatLive()).toBe(true);
    expect(readers.chatRepairNeedsOps()).toBe(false);
    expect(readers.hasFinalPartner()).toBe(true);
    expect(readers.hasProviderLocation()).toBe(true);
    expect(readers.paymentNeedsOps()).toBe(true);
    expect(readers.status()).toBe('PROVIDER_ON_THE_WAY');
    expect(readers.terminalStatus()).toBe(false);
  });

  it('marks terminal bookings and chat repair state from booking facts', () => {
    const readers = bookingMonitorEvidenceMatchReadersFromBooking(
      booking({ status: 'NO_SHOW' }),
      opsReaders(),
    );

    expect(readers.activeStatus()).toBe(false);
    expect(readers.chatLive()).toBe(false);
    expect(readers.chatRepairNeedsOps()).toBe(false);
    expect(readers.terminalStatus()).toBe(true);
  });
});
