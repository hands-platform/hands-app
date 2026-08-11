import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import {
  partnerBackupMatchingEligibility,
  partnerCanAcceptBookingNow,
  partnerHasHardAcceptanceBlocker,
  providerActionHint,
  providerDispatchReady,
  providerReviewIssues,
} from './partner-list-readiness';

const now = new Date();

describe('partner list readiness', () => {
  it('marks a fully ready Partner as dispatch and direct-request ready', () => {
    const provider = partner();

    expect(providerDispatchReady(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(true);
    expect(partnerCanAcceptBookingNow(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(true);
    expect(partnerHasHardAcceptanceBlocker(provider)).toBe(false);
    expect(providerReviewIssues(provider, DEFAULT_PROVIDER_OPS_POLICY)).toEqual([]);
    expect(providerActionHint(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(
      'Partner is ready for direct requests and marketplace matching.',
    );
    expect(partnerBackupMatchingEligibility(provider, DEFAULT_PROVIDER_OPS_POLICY).eligible).toBe(true);
  });

  it('keeps wallet debt visible as a high-priority Admin issue without hiding marketplace context', () => {
    const provider = partner({
      earnings: [
        {
          bookingId: 'booking-cash',
          createdAt: now.toISOString(),
          currency: 'VND',
          grossAmount: 450000,
          id: 'earning-debt',
          netAmount: -120000,
          platformFee: 120000,
          providerProfileId: 'partner-001',
          status: 'PENDING',
          withholdingAmount: 0,
        },
      ],
    });

    expect(providerActionHint(provider, DEFAULT_PROVIDER_OPS_POLICY)).toContain(
      'Partner wallet is negative by',
    );
    expect(providerReviewIssues(provider, DEFAULT_PROVIDER_OPS_POLICY)).toEqual(
      expect.arrayContaining([{ label: 'cash debt 120.000 VND', severity: 'high' }]),
    );
  });

  it('reports account, identity, location, push, auth, report, and control blockers', () => {
    const provider = partner({
      bankAccounts: [
        { id: 'bank-1', bankName: 'VCB', accountHolderName: 'Linh', isPrimary: true, status: 'REJECTED' },
      ],
      blockedAt: now.toISOString(),
      currentLocationUpdatedAt: undefined,
      documents: [{ id: 'doc-front', type: 'CCCD_FRONT', status: 'REJECTED' }],
      kyc: { id: 'kyc-1', status: 'REJECTED' },
      reports: [
        {
          category: 'SAFETY',
          createdAt: now.toISOString(),
          id: 'report-1',
          providerProfileId: 'partner-001',
          severity: 'HIGH',
          source: 'ADMIN',
          status: 'OPEN',
          summary: 'Open safety report',
        },
      ],
      sanctions: [
        {
          id: 'sanction-1',
          providerProfileId: 'partner-001',
          reason: 'Temporary control',
          startsAt: now.toISOString(),
          status: 'ACTIVE',
          type: 'SUSPENSION',
        },
      ],
      user: {
        id: 'user-1',
        phone: '+84900000000',
        pushDevices: [],
      },
      verification: { id: 'verification-1', status: 'PENDING_REVIEW' },
    });

    expect(providerDispatchReady(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(false);
    expect(partnerCanAcceptBookingNow(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(false);
    expect(partnerHasHardAcceptanceBlocker(provider)).toBe(true);
    expect(providerActionHint(provider, DEFAULT_PROVIDER_OPS_POLICY)).toBe(
      'This partner account is blocked and cannot go online, update location, or appear to customers.',
    );
    expect(providerReviewIssues(provider, DEFAULT_PROVIDER_OPS_POLICY)).toEqual(
      expect.arrayContaining([
        { label: 'account blocked', severity: 'high' },
        { label: 'verification review', severity: 'high' },
        { label: 'KYC REJECTED', severity: 'high' },
        { label: 'identity docs 3/3 missing', severity: 'high' },
        { label: 'document rejected', severity: 'high' },
        { label: 'location missing', severity: 'high' },
        { label: 'push missing', severity: 'medium' },
        { label: 'Supabase role pending', severity: 'medium' },
        { label: '1 open report', severity: 'high' },
        { label: '1 active control', severity: 'high' },
      ]),
    );
  });
});

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    agreements: [
      { id: 'agreement-1' },
      { id: 'agreement-2' },
      { id: 'agreement-3' },
      { id: 'agreement-4' },
      { id: 'agreement-5' },
    ],
    bankAccounts: [
      {
        accountHolderName: 'Nguyen Thi Linh',
        bankName: 'VCB',
        id: 'bank-1',
        isPrimary: true,
        status: 'APPROVED',
      },
    ],
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: now.toISOString(),
    devices: [{ deviceId: 'android-device-1', enabled: true, id: 'device-1' }],
    displayName: 'Linh Wellness',
    documents: [
      { id: 'doc-front', status: 'APPROVED', type: 'CCCD_FRONT' },
      { id: 'doc-back', status: 'APPROVED', type: 'CCCD_BACK' },
      { id: 'doc-selfie', status: 'APPROVED', type: 'SELFIE' },
    ],
    id: 'partner-001',
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    legalName: 'Nguyen Thi Linh',
    residentialAddress: 'District 1, Ho Chi Minh City, Vietnam',
    status: 'ONLINE_AVAILABLE',
    taxProfile: { id: 'tax-1', status: 'APPROVED' },
    user: {
      id: 'user-1',
      phone: '+84900000000',
      pushDevices: [{ enabled: true, id: 'push-1', platform: 'android' }],
      supabaseUserId: 'supabase-user-1',
    },
    verification: { id: 'verification-1', status: 'APPROVED' },
    ...input,
  } as AdminProvider;
}
