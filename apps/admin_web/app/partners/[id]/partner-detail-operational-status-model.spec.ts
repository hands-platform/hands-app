import { describe, expect, it } from 'vitest';

import {
  buildPartnerOperationalChecks,
  openPartnerOperationalChecks,
} from './partner-detail-operational-status-model';

describe('partner detail operational status model', () => {
  it('uses one unresolved issue list without duplicating the same gate', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '80,000 VND',
      cashDebtOpen: true,
      kycStatus: 'APPROVED',
      locationDetail: 'Last location is 3 hours old.',
      locationFresh: false,
      missingKycDocumentCount: 0,
      partnerStatus: 'ONLINE_AVAILABLE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: false,
    });

    expect(openPartnerOperationalChecks(checks).map((check) => check.id)).toEqual([
      'location-freshness',
      'push-reachability',
      'cash-debt',
    ]);
    expect(new Set(checks.map((check) => check.id)).size).toBe(checks.length);
  });

  it('keeps offline availability informational instead of creating a false operator issue', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'OFFLINE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    const availability = checks.find((check) => check.id === 'availability-reason');
    expect(availability).toMatchObject({
      open: false,
      status: 'Offline reason not recorded',
      tone: 'pending',
    });
    expect(openPartnerOperationalChecks(checks)).toEqual([]);
  });

  it('shows 7-day inactivity once as an operator action and keeps the reason factual', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'inactive_7d',
      appLastActiveLabel: '10 Jul 2026, 09:00',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'OFFLINE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(openPartnerOperationalChecks(checks).map((check) => check.id)).toEqual(['app-activity']);
    expect(checks.find((check) => check.id === 'availability-reason')).toMatchObject({
      open: false,
      status: 'Inactive 7d+',
    });
  });

  it('flags a busy status when no active booking explains it', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'ONLINE_BUSY',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(checks.find((check) => check.id === 'availability-reason')).toMatchObject({
      open: true,
      status: 'Status mismatch',
      tone: 'blocked',
    });
  });

  it('explains busy availability with one distinct active booking', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 1,
      activeBookingsHref: '#partner-booking-journey',
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'ONLINE_BUSY',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(checks.find((check) => check.id === 'availability-reason')).toMatchObject({
      href: '#partner-booking-journey',
      open: false,
      status: 'Working now',
    });
    expect(checks.find((check) => check.id === 'active-booking')).toMatchObject({
      status: '1 active booking',
    });
  });

  it('flags a ready status when an active booking should make the Partner unavailable', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 1,
      activeBookingsHref: '#partner-booking-journey',
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'ONLINE_AVAILABLE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(checks.find((check) => check.id === 'availability-reason')).toMatchObject({
      open: true,
      status: 'Status mismatch',
      tone: 'blocked',
    });
  });

  it('separates manual offline from outside working hours', () => {
    const manual = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      availabilityIntent: 'OFFLINE',
      availabilityReason: 'MANUAL_OFFLINE',
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'OFFLINE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
      scheduleConfigured: true,
      todayWorkingHoursLabel: '09:00-18:00',
      withinWorkingHours: true,
    });
    const outside = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      availabilityIntent: 'AVAILABLE',
      availabilityReason: 'OUTSIDE_WORKING_HOURS',
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'OFFLINE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
      scheduleConfigured: true,
      todayWorkingHoursLabel: '09:00-18:00',
      withinWorkingHours: false,
    });

    expect(manual.find((check) => check.id === 'availability-reason')).toMatchObject({
      open: false,
      status: 'Partner set offline',
    });
    expect(outside.find((check) => check.id === 'availability-reason')).toMatchObject({
      open: false,
      status: 'Outside working hours',
    });
    expect(outside.find((check) => check.id === 'work-schedule-data')).toMatchObject({
      status: 'Outside working hours',
    });
  });

  it('does not label an approved but incomplete profile as operationally approved', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'APPROVED',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'ONLINE_AVAILABLE',
      payoutHoldReason: null,
      profileComplete: false,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(checks.find((check) => check.id === 'profile-approval')).toMatchObject({
      open: true,
      status: 'Profile incomplete',
      tone: 'pending',
    });
  });

  it('maps a draft KYC record to operator-facing copy', () => {
    const checks = buildPartnerOperationalChecks({
      accountBlocked: false,
      activeBookingCount: 0,
      appActivityStatus: 'active',
      bookableServiceCount: 1,
      cashDebtLabel: '0 VND',
      cashDebtOpen: false,
      kycStatus: 'DRAFT',
      locationDetail: 'Location is fresh.',
      locationFresh: true,
      missingKycDocumentCount: 0,
      partnerStatus: 'OFFLINE',
      payoutHoldReason: null,
      profileComplete: true,
      profileStatus: 'APPROVED',
      pushEnabled: true,
    });

    expect(checks.find((check) => check.id === 'kyc-approval')).toMatchObject({
      open: true,
      status: 'KYC not submitted',
      tone: 'pending',
    });
  });
});
