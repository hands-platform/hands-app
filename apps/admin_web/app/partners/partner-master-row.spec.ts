import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerMasterRow } from './partner-master-row';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    createdAt: '2026-06-01T01:00:00.000Z',
    updatedAt: '2026-06-01T01:10:00.000Z',
    services: [{ price: 450000, service: { name: 'Swedish Massage', durationMin: 60 } }],
    ...input,
  } as AdminBooking;
}

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-1',
    displayName: 'Linh Wellness',
    legalName: 'Linh Wellness Legal',
    status: 'ONLINE_AVAILABLE',
    level: 'LEVEL_2_ACTIVE',
    gender: 'FEMALE',
    reviewCount: 14,
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date().toISOString(),
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    selectedBookings: [
      booking({
        id: 'booking-completed',
        status: 'COMPLETED',
        updatedAt: '2026-06-01T02:00:00.000Z',
      }),
      booking({
        id: 'booking-cancelled',
        status: 'CANCELLED',
        closedByRole: 'CUSTOMER',
        updatedAt: '2026-06-01T03:00:00.000Z',
      }),
    ],
    preferredBookings: [
      booking({
        id: 'booking-no-show',
        status: 'NO_SHOW',
        closedByRole: 'ADMIN',
        updatedAt: '2026-06-01T04:00:00.000Z',
      }),
    ],
    participants: [
      {
        id: 'participant-1',
        status: 'REJECTED',
        booking: booking({
          id: 'booking-refunded',
          status: 'REFUNDED',
          closedByRole: 'PROVIDER',
          updatedAt: '2026-06-01T05:00:00.000Z',
        }),
      },
    ],
    sessions: [
      {
        id: 'session-1',
        deviceId: 'android-device-123456789',
        ipAddress: '203.0.113.7',
        appVersion: '0.4.0',
        loggedInAt: '2026-06-01T06:00:00.000Z',
        lastSeenAt: '2026-06-01T06:30:00.000Z',
        suspicious: false,
      },
    ],
    devices: [
      {
        id: 'device-1',
        deviceId: 'android-device-123456789',
        platform: 'android',
        appVersion: '0.3.9',
        enabled: true,
        lastSeenAt: '2026-06-01T06:15:00.000Z',
      },
    ],
    earnings: [
      {
        id: 'earning-1',
        providerProfileId: 'partner-1',
        bookingId: 'booking-completed',
        grossAmount: 450000,
        platformFee: 12000,
        withholdingAmount: 0,
        netAmount: 380000,
        currency: 'VND',
        status: 'AVAILABLE',
      },
    ],
    auditLogCount: 7,
    auditLogs: [
      {
        id: 'audit-newer',
        action: 'provider.status.update',
        target: 'partner-1',
        metadata: { status: 'ONLINE_AVAILABLE' },
        createdAt: '2026-06-01T07:00:00.000Z',
      },
      {
        id: 'audit-note',
        action: 'provider.ops_note.add',
        target: 'partner-1',
        metadata: { memo: 'Bring copied CCCD document for manual review.' },
        createdAt: '2026-06-01T06:45:00.000Z',
      },
    ],
    user: {
      id: 'user-1',
      fullName: 'Linh Wellness User',
      phone: '0865907184',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    ...input,
  } as AdminProvider;
}

describe('partner master row', () => {
  it('builds neutral operations facts for the partner list row', () => {
    const row = buildPartnerMasterRow(partner(), DEFAULT_PROVIDER_OPS_POLICY, {
      displayName: (item: AdminProvider) => item.displayName ?? item.id,
    });

    expect(row.initials).toBe('LW');
    expect(row.displayName).toBe('Linh Wellness');
    expect(row.phone).toBe('0865907184');
    expect(row.online).toBe(true);
    expect(row.avatarStatus).toBe('online');
    expect(row.level).toBe('LEVEL_2_ACTIVE');
    expect(row.kycStatus).toBe('APPROVED');
    expect(row.locationState).toBe('recent');
    expect(row.bookingCount).toBe(4);
    expect(row.completedCount).toBe(1);
    expect(row.closedCount).toBe(3);
    expect(row.customerClosedCount).toBe(1);
    expect(row.adminClosedCount).toBe(1);
    expect(row.partnerClosedCount).toBe(1);
    expect(row.noShowCount).toBe(1);
    expect(row.reviewCount).toBe(14);
    expect(row.grossRevenue).toBe(450000);
    expect(row.platformFee).toBe(12000);
    expect(row.pendingPayout).toBe(380000);
    expect(row.availablePayout).toBe(380000);
    expect(row.auditLogCount).toBe(7);
    expect(row.latestAuditTitle).toBe('partner.ops_note.add');
    expect(row.latestAuditDetail).toContain('manual review');
    expect(row.latestSessionDevice).toContain('android / v0.4.0');
    expect(row.latestSessionIp).toBe('203.0.113.7');
    expect(row.accountBlocked).toBe(false);
    expect(row.accountNote).toBe('Normal account');
  });

  it('shows account block facts without producing numeric person ranking', () => {
    const row = buildPartnerMasterRow(
      partner({
        blockedAt: '2026-06-02T01:00:00.000Z',
        blockedReason: 'Manual operations hold',
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
      { displayName: (item: AdminProvider) => item.displayName ?? item.id },
    );

    expect(row.accountBlocked).toBe(true);
    expect(row.accountNote).toBe('Manual operations hold');
    expect(Object.keys(row)).not.toContain('riskScore');
  });
});
