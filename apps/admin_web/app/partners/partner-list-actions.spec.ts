import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { nextPartnerListAction, partnerListActionPillClass } from './partner-list-actions';

const now = new Date();

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    legalName: 'Nguyen Thi Linh',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: now.toISOString(),
    residentialAddress: 'District 1, Ho Chi Minh City, Vietnam',
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'VCB',
        accountHolderName: 'Nguyen Thi Linh',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    agreements: [
      { id: 'agreement-1' },
      { id: 'agreement-2' },
      { id: 'agreement-3' },
      { id: 'agreement-4' },
      { id: 'agreement-5' },
    ],
    taxProfile: { id: 'tax-1', status: 'APPROVED' },
    devices: [{ id: 'device-1', deviceId: 'android-device-1', enabled: true }],
    user: {
      id: 'user-1',
      phone: '+84900000000',
      supabaseUserId: 'supabase-user-1',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

describe('partner list actions', () => {
  it('blocks marketplace finalization work before other dispatch checks when cash fee debt exists', () => {
    const action = nextPartnerListAction(
      partner({
        earnings: [
          {
            id: 'earning-debt',
            providerProfileId: 'partner-001',
            bookingId: 'booking-cash',
            grossAmount: 450000,
            platformFee: 120000,
            withholdingAmount: 0,
            netAmount: -120000,
            currency: 'VND',
            status: 'PENDING',
            createdAt: now.toISOString(),
          },
        ],
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(action.status).toBe('CASH DEBT');
    expect(action.tone).toBe('blocked');
    expect(action.priority).toBe(85);
    expect(action.operatorAction).toContain('settle the cash fee debt');
    expect(action.operatorAction).toContain('final acceptance');
  });

  it('prioritizes resubmitted withdrawal details for admin review', () => {
    const action = nextPartnerListAction(
      partner({
        bankAccounts: [
          {
            id: 'bank-resubmitted',
            bankName: 'VCB',
            accountHolderName: 'Nguyen Thi Linh',
            status: 'PENDING_REVIEW',
            isPrimary: true,
          },
          {
            id: 'bank-rejected',
            bankName: 'VCB',
            accountHolderName: 'Nguyen Thi Linh',
            isPrimary: false,
            rejectionReason: '입금 정보가 정확하지 않아 입금이 되지 않습니다',
            status: 'REJECTED',
          },
        ],
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(action.status).toBe('WITHDRAWAL DETAILS');
    expect(action.detail).toBe('Corrected withdrawal details are pending admin review.');
    expect(action.operatorAction).toBe(
      'Compare the resubmitted withdrawal details with the requested correction before manual withdrawal/deposit processing.',
    );
    expect(action.priority).toBe(83);
  });

  it('keeps optional tax review as a non-blocking finance follow-up', () => {
    const action = nextPartnerListAction(
      partner({
        taxProfile: {
          id: 'tax-1',
          status: 'PENDING',
          legalName: 'Nguyen Thi Linh',
          registeredAddress: 'District 1, Ho Chi Minh City, Vietnam',
        },
        earnings: [
          {
            id: 'earning-1',
            providerProfileId: 'partner-001',
            bookingId: 'booking-1',
            grossAmount: 450000,
            platformFee: 70000,
            withholdingAmount: 0,
            netAmount: 380000,
            currency: 'VND',
            status: 'AVAILABLE',
            createdAt: now.toISOString(),
          },
        ],
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(action.status).toBe('OPTIONAL TAX');
    expect(action.detail).toContain('optional tax profile');
    expect(action.operatorAction).toContain('do not block withdrawal');
    expect(action.tone).toBe('pending');
  });

  it('returns a location action when location is not recent and core onboarding is clear', () => {
    const action = nextPartnerListAction(
      partner({
        currentLocationUpdatedAt: new Date(
          now.getTime() - (DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes + 10) * 60_000,
        ).toISOString(),
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(action.status).toBe('LOCATION');
    expect(action.tone).toBe('pending');
  });

  it('returns clear state and matching pill class when no visible operation blocker exists', () => {
    const action = nextPartnerListAction(partner(), DEFAULT_PROVIDER_OPS_POLICY);

    expect(action.status).toBe('CLEAR');
    expect(action.tone).toBe('done');
    expect(partnerListActionPillClass(action.tone)).toBe('pill-success');
    expect(partnerListActionPillClass('blocked')).toBe('pill-danger');
    expect(partnerListActionPillClass('pending')).toBe('pill-warn');
  });
});
