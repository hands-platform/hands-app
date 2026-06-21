import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerOpsBadges, partnerOpsBadgePillClass } from './partner-ops-badges';

function approvedDocuments(): NonNullable<AdminProvider['documents']> {
  return [
    { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
    { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
    { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
  ];
}

function booking(input: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    createdAt: '2026-06-01T01:00:00.000Z',
    updatedAt: '2026-06-01T01:10:00.000Z',
    ...input,
  } as AdminBooking;
}

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-1',
    displayName: 'Linh Wellness',
    legalName: 'Linh Wellness Legal',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date().toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: approvedDocuments(),
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'Vietcombank',
        accountHolderName: 'Linh Wellness',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    selectedBookings: [booking()],
    sessions: [{ id: 'session-1', suspicious: false, lastSeenAt: '2026-06-01T01:15:00.000Z' }],
    devices: [{ id: 'device-1', deviceId: 'device-1', platform: 'android', enabled: true }],
    user: {
      id: 'user-1',
      phone: '0865907184',
      supabaseUserId: 'supabase-user-1',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true, createdAt: '2026-06-01T01:00:00.000Z' }],
    },
    earnings: [
      {
        id: 'cash-debt',
        providerProfileId: 'partner-1',
        bookingId: 'booking-cash',
        grossAmount: 450000,
        platformFee: 12000,
        withholdingAmount: 0,
        netAmount: -12000,
        currency: 'VND',
        status: 'PENDING',
      },
    ],
    ...input,
  } as AdminProvider;
}

describe('partner ops badges', () => {
  it('shows direct request and marketplace status as separate operations badges', () => {
    const badges = buildPartnerOpsBadges(partner(), DEFAULT_PROVIDER_OPS_POLICY, {
      canAcceptBookingNow: () => true,
    });

    expect(badges.map((badge: { label: string }) => badge.label)).toEqual([
      'Direct request ready',
      'Dispatch repair',
      'Cash debt',
      'KYC ok',
      'Withdrawal details ready',
      'Location recent',
      'Push ready',
      'Supabase linked',
      'Device clear',
    ]);
    expect(badges.find((badge: { label: string }) => badge.label === 'Cash debt')).toMatchObject({
      tone: 'danger',
      detail: 'Partner owes 12.000 VND before final acceptance, service start, and payout release.',
    });
    expect(
      badges.find((badge: { label: string; detail: string }) => badge.label === 'Dispatch repair')
        ?.detail,
    ).toContain('cash fee debt');
    expect(
      badges.find((badge: { label: string; detail: string }) => badge.label === 'Withdrawal details ready')
        ?.detail,
    ).toContain('reviewed when the Partner requests wallet withdrawal');
  });

  it('maps badge tone to existing admin pill classes', () => {
    expect(partnerOpsBadgePillClass('success')).toBe('pill-success');
    expect(partnerOpsBadgePillClass('danger')).toBe('pill-danger');
    expect(partnerOpsBadgePillClass('warn')).toBe('pill-warn');
    expect(partnerOpsBadgePillClass('info')).toBe('pill-info');
    expect(partnerOpsBadgePillClass('neutral')).toBe('pill-neutral');
  });

  it('describes wallet clear state against final acceptance and payout release gates', () => {
    const badges = buildPartnerOpsBadges(
      partner({
        earnings: [],
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
      {
        canAcceptBookingNow: () => true,
      },
    );

    expect(badges.find((badge: { label: string }) => badge.label === 'Wallet clear')).toMatchObject({
      tone: 'success',
      detail: 'No negative wallet balance is gating final acceptance, service start, or payout release.',
    });
  });
});
