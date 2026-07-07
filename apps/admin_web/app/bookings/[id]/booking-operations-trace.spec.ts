import type { AdminAuditLog, AdminBookingDetail } from '../../../lib/admin-api';
import { bookingOperationsTrace } from './booking-operations-trace';

describe('bookingOperationsTrace', () => {
  it('surfaces first-pick match source audit rows for operator review', () => {
    const trace = bookingOperationsTrace(booking(), [
      auditLog({
        action: 'booking.matched.first_pick_accepted',
        metadata: {
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
        },
      }),
    ]);

    expect(trace.rows[0]).toMatchObject({
      detail: 'API matched the first-pick Partner before customer fallback selection was needed.',
      signal: 'Match',
      signalClass: 'signal-ok',
      title: 'First-pick accepted first / System',
    });
    expect(trace.rows[0]?.meta).toContain('Partner partner-1');
  });

  it('uses operator-facing policy wording for saved booking policy records', () => {
    const trace = bookingOperationsTrace(booking(), []);

    expect(trace).toMatchObject({
      status: 'Policy saved',
      title: 'Booking has its own matching policy record',
    });
    expect(trace.metrics.find((metric) => metric.label === 'Policy basis')).toMatchObject({
      value: 'Saved policy',
    });
    expect(JSON.stringify(trace)).not.toMatch(/Saved snapshot|booking snapshot|policy snapshot/i);
  });
});

function booking(): AdminBookingDetail {
  return {
    createdAt: '2026-06-10T00:00:00.000Z',
    id: 'booking-1',
    metadata: {
      matchingPolicy: {
        providerResponseWindowMinutes: 10,
      },
    },
    status: 'MATCHED',
  } as AdminBookingDetail;
}

function auditLog(overrides: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'booking.matched.customer_selected',
    createdAt: '2026-06-10T01:00:00.000Z',
    id: 'audit-1',
    target: 'booking:booking-1',
    ...overrides,
  };
}
