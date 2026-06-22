import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import { buildProviderRegistrationDossier } from './partner-detail-registration-dossier-model';

function approvedKycDocuments() {
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type) => ({
    status: 'APPROVED',
    type,
  }));
}

describe('partner detail registration dossier model', () => {
  it('marks a complete pre-revenue partner dossier ready while deferring payout-only gates', () => {
    const dossier = buildProviderRegistrationDossier({
      activityNickname: 'Moon',
      bankAccounts: [{ status: 'APPROVED' }],
      city: 'Da Nang',
      currentLat: 16.06,
      currentLng: 108.22,
      dateOfBirth: '1995-04-03',
      displayName: 'Linh Tran',
      documents: approvedKycDocuments(),
      experienceYears: 4,
      gender: 'FEMALE',
      kyc: { status: 'APPROVED' },
      languages: ['vi', 'en'],
      legalName: 'Tran Linh',
      residentialAddress: null,
      serviceStyle: 'calm',
      specialties: ['Aroma'],
      user: { phone: '+84000000001' },
    });

    expect(dossier).toMatchObject({
      blockers: 0,
      ready: true,
    });
    expect(dossier.items.find((item) => item.label === 'Tax profile optional')).toBeUndefined();
    expect(dossier.items.map((item) => item.label)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional', 'Legal agreements']),
    );
  });

  it('keeps first-earning payout follow-up out of the registration approval dossier', () => {
    const dossier = buildProviderRegistrationDossier({
      activityNickname: 'Moon',
      bankAccounts: [{ status: 'APPROVED' }],
      city: 'Da Nang',
      currentLat: 16.06,
      currentLng: 108.22,
      dateOfBirth: '1995-04-03',
      displayName: 'Linh Tran',
      documents: approvedKycDocuments(),
      earnings: [{ status: 'AVAILABLE' }],
      gender: 'FEMALE',
      kyc: { status: 'APPROVED' },
      legalName: 'Tran Linh',
      serviceStyle: 'calm',
      user: { phone: '+84000000001' },
    });

    expect(dossier.ready).toBe(true);
    expect(dossier.items.find((item) => item.label === 'Address and service area')).toMatchObject({
      ok: true,
      status: 'READY',
    });
    expect(dossier.items.map((item) => item.label)).not.toEqual(
      expect.arrayContaining(['Withdrawal details', 'Tax profile optional', 'Legal agreements']),
    );
  });

  it('omits submitted optional tax profile from the registration approval dossier', () => {
    const dossier = buildProviderRegistrationDossier({
      taxProfile: { status: 'PENDING' },
    });

    expect(dossier.items.find((item) => item.label === 'Tax profile optional')).toBeUndefined();
  });

  it('surfaces document and device/session blockers without blocking on bank review', () => {
    const dossier = buildProviderRegistrationDossier({
      bankAccounts: [{ status: 'PENDING' }],
      devices: [{ blockedAt: '2026-06-13T03:15:00.000Z' }],
      documents: [{ status: 'APPROVED', type: 'CCCD_FRONT' }],
      kyc: { status: 'PENDING' },
      sessions: [{ suspicious: true }],
    });

    expect(dossier.ready).toBe(false);
    expect(dossier.items.find((item) => item.label === 'KYC evidence')).toMatchObject({
      ok: false,
      status: 'PENDING',
    });
    expect(dossier.items.find((item) => item.label === 'Withdrawal details')).toBeUndefined();
    expect(dossier.items.find((item) => item.label === 'Device and session')).toMatchObject({
      ok: false,
      status: 'CHECK',
    });
  });
});
