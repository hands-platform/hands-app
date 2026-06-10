import type { AdminAuditLog } from './admin-api';
import {
  bookingMatchAuditDetail,
  bookingMatchAuditHighlights,
  bookingMatchAuditSource,
  bookingMatchAuditSummary,
} from './booking-match-audit';

describe('booking match audit display', () => {
  it('labels first-pick acceptance as the API winner path', () => {
    const log = auditLog({
      action: 'booking.matched.first_pick_accepted',
      metadata: {
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
      },
    });

    expect(bookingMatchAuditSource(log)).toEqual({
      className: 'pill pill-success',
      detail: 'API matched the first-pick Partner before customer fallback selection was needed.',
      label: 'First-pick accepted first',
      source: 'FIRST_PICK_ACCEPTED_FIRST',
    });
    expect(bookingMatchAuditSummary(log)).toBe(
      'First-pick accepted first / Partner partner-1 / booking booking-1',
    );
    expect(bookingMatchAuditDetail(log)).toContain('first-pick Partner won the race');
  });

  it('labels customer fallback selection as customer-selected Partner', () => {
    const log = auditLog({
      action: 'booking.matched.customer_selected',
      metadata: {
        bookingId: 'booking-2',
        providerProfileId: 'partner-2',
        matchSource: 'CUSTOMER_SELECTED_PARTNER',
      },
    });

    expect(bookingMatchAuditHighlights(log)).toEqual([
      { className: 'pill pill-info', label: 'Customer selected Partner' },
      { className: 'pill pill-info', label: 'Partner partner-2' },
    ]);
    expect(bookingMatchAuditDetail(log)).toContain('customer selected from participating Partners');
  });

  it('ignores unrelated audit rows', () => {
    expect(bookingMatchAuditSource(auditLog({ action: 'payment.release' }))).toBeNull();
    expect(bookingMatchAuditHighlights(auditLog({ action: 'payment.release' }))).toEqual([]);
    expect(bookingMatchAuditSummary(auditLog({ action: 'payment.release' }))).toBe('');
  });
});

function auditLog(overrides: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'booking.matched.customer_selected',
    createdAt: '2026-06-10T01:00:00.000Z',
    id: 'audit-1',
    target: 'booking:booking-1',
    ...overrides,
  };
}
