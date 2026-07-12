import type { AdminAuditLog } from '../../lib/admin-api';
import { buildOperatorNotes } from './operations-handoff-operator-notes';

describe('operations history operator notes model', () => {
  it('keeps only ops notes and maps them to history rows', () => {
    const notes = buildOperatorNotes([
      auditLog({
        action: 'operations.handoff_note.add',
        actor: { fullName: 'Ops Lead' },
        metadata: { note: 'Shift remains active' },
        target: 'operations:handoff',
      }),
      auditLog({
        action: 'booking.ops_note.add',
        metadata: { note: 'Booking evidence checked' },
        target: 'booking:booking-1',
      }),
      auditLog({
        action: 'notification.retry',
        target: 'notification:notification-1',
      }),
    ]);

    expect(notes).toEqual([
      expect.objectContaining({
        area: 'History',
        actor: 'Ops Lead',
        href: '/operations-handoff',
        note: 'Shift remains active',
      }),
      expect.objectContaining({
        area: 'Booking',
        href: '/bookings/booking-1',
        note: 'Booking evidence checked',
      }),
    ]);
  });

  it('normalizes Provider copy to Partner in note text', () => {
    expect(
      buildOperatorNotes([
        auditLog({
          action: 'provider.ops_note.add',
          metadata: { note: 'Provider bank document needs review' },
          target: 'provider:partner-1',
        }),
      ])[0],
    ).toMatchObject({
      area: 'Partner',
      href: '/partners/partner-1',
      note: 'Partner bank document needs review',
    });
  });
});

function auditLog(input: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'operations.handoff_note.add',
    createdAt: '2026-06-14T00:00:00.000Z',
    id: 'audit-1',
    target: 'operations:handoff',
    ...input,
  } as AdminAuditLog;
}
