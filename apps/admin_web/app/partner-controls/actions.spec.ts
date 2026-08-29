import { vi } from 'vitest';
import { redirect } from 'next/navigation';

import { adminPatch, adminPost, adminPostOrThrow } from '../../lib/admin-api';
import {
  applyPartnerControlFilters,
  createProviderReportWithState,
  createProviderSanctionWithState,
  liftProviderSanction,
  updateProviderReportWithState,
} from './actions';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockedAdminPost = vi.mocked(adminPost);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedAdminPatch = vi.mocked(adminPatch);

describe('Partner control actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPost.mockResolvedValue(null);
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
    mockedAdminPatch.mockResolvedValue(null);
  });

  it('refuses a restriction without the explicit target confirmation', async () => {
    const formData = restrictionForm();
    formData.delete('confirmation');

    const result = await createProviderSanctionWithState(null, formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'error',
      values: { noExpiry: 'true', reason: 'Verified safety evidence', type: 'PAYOUT_HOLD' },
    });
  });

  it('requires exactly one expiry choice and sends a deliberate no-expiry record', async () => {
    const invalid = restrictionForm();
    invalid.delete('noExpiry');
    await createProviderSanctionWithState(null, invalid);
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();

    const valid = restrictionForm();
    const result = await createProviderSanctionWithState(null, valid);
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/providers/partner-1/sanctions',
      {
        expiresAt: null,
        reason: 'Verified safety evidence',
        reportId: 'report-1',
        type: 'PAYOUT_HOLD',
      },
    );
    expect(mockedAdminPostOrThrow).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      message: 'The Partner restriction was saved.',
      status: 'success',
      values: {},
    });
  });

  it.each(['WARNING', 'PAYOUT_HOLD', 'ACCOUNT_BLOCK', 'TRUST_BADGE_REMOVAL'])(
    'submits the confirmed %s control exactly once',
    async (type) => {
      const formData = restrictionForm();
      formData.set('type', type);

      await createProviderSanctionWithState(null, formData);

      expect(mockedAdminPostOrThrow).toHaveBeenCalledTimes(1);
      expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
        '/admin/providers/partner-1/sanctions',
        expect.objectContaining({ reportId: 'report-1', type }),
      );
    },
  );

  it('sends an explicit future expiry when the operator does not choose No expiry', async () => {
    const formData = restrictionForm();
    formData.delete('noExpiry');
    formData.set('expiresAt', '2099-09-01T09:30');

    await createProviderSanctionWithState(null, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/providers/partner-1/sanctions',
      expect.objectContaining({ expiresAt: new Date('2099-09-01T09:30').toISOString() }),
    );
  });

  it('preserves every restriction input when the API rejects the confirmed mutation', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('API unavailable'));
    const formData = restrictionForm();

    const result = await createProviderSanctionWithState(null, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      message:
        'The Partner control service did not save the restriction. Your entries are preserved; check access and service availability, then retry.',
      status: 'error',
      values: {
        confirmation: 'confirmed',
        noExpiry: 'true',
        providerProfileId: 'partner-1',
        reason: 'Verified safety evidence',
        reportId: 'report-1',
        type: 'PAYOUT_HOLD',
      },
    });
  });

  it('preserves report draft values and connects missing required fields to the response', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', 'partner-1');
    formData.set('details', 'Customer supplied supporting chat evidence');
    formData.set('returnTo', '/partner-controls?details=reports');

    const result = await createProviderReportWithState(null, formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'error',
      fieldErrors: {
        category: 'This field is required.',
        severity: 'This field is required.',
        summary: 'This field is required.',
      },
      values: expect.objectContaining({
        providerProfileId: 'partner-1',
        details: 'Customer supplied supporting chat evidence',
      }),
    });
  });

  it('keeps all report evidence when the API rejects the draft', async () => {
    mockedAdminPost.mockRejectedValueOnce(new Error('API unavailable'));
    const formData = reportForm();

    const result = await createProviderReportWithState(null, formData);

    expect(result).toMatchObject({
      status: 'error',
      values: {
        bookingId: 'booking-1',
        category: 'SAFETY',
        details: 'Customer supplied supporting chat evidence',
        providerProfileId: 'partner-1',
        severity: 'HIGH',
        summary: 'Partner safety report',
      },
    });
  });

  it('returns a created open report to the default active review queue', async () => {
    const formData = reportForm();
    formData.set('returnTo', '/partner-controls?details=reports&status=RESOLVED&reportPage=4');

    await createProviderReportWithState(null, formData);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      '/partner-controls?details=reports&notice=report-saved',
    );
  });

  it('sends an explicit lift reason instead of an empty request body', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', 'partner-1');
    formData.set('sanctionId', 'sanction-1');
    formData.set('reason', 'Debt was reconciled against the bank receipt');

    await liftProviderSanction(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/provider-sanctions/sanction-1/lift',
      { reason: 'Debt was reconciled against the bank receipt' },
      null,
    );
  });

  it('rejects a 501-character lift reason instead of truncating evidence', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', 'partner-1');
    formData.set('sanctionId', 'sanction-1');
    formData.set('reason', 'x'.repeat(501));

    await expect(liftProviderSanction(formData)).rejects.toThrow('Reason must be at most 500 characters');
    expect(mockedAdminPost).not.toHaveBeenCalled();
  });

  it.each([
    [
      { details: 'controls', q: '   ', review: 'attention', sort: 'priority', blockerPage: '4' },
      '/partner-controls?details=controls',
    ],
    [
      { details: 'reports', q: '', status: '', severity: '', sort: 'priority', reportPage: '3' },
      '/partner-controls?details=reports',
    ],
    [
      { details: 'sanctions', q: ' Linh ', sanction: 'ACTIVE', sort: 'newest', sanctionPage: '2' },
      '/partner-controls?details=sanctions&q=Linh',
    ],
    [
      { details: 'reports', newReport: '1', partnerQ: ' Mai ', reportPage: '2' },
      '/partner-controls?details=reports&newReport=1&partnerQ=Mai',
    ],
  ])('canonicalizes Partner Control filter form submission %#', async (values, expectedHref) => {
    const formData = new FormData();
    for (const [name, value] of Object.entries(values)) formData.set(name, value);

    await applyPartnerControlFilters(formData);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(expectedHref);
  });

  it.each(['RESOLVED', 'DISMISSED'])('requires a resolution note before saving %s', async (status) => {
    const formData = new FormData();
    formData.set('reportId', 'report-1');
    formData.set('providerProfileId', 'partner-1');
    formData.set('severity', 'HIGH');
    formData.set('status', status);
    formData.set('returnTo', '/partner-controls?details=reports');

    const result = await updateProviderReportWithState(null, formData);

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'error',
      fieldErrors: {
        resolutionNote: 'Resolution note is required when closing a report.',
      },
      values: expect.objectContaining({ reportId: 'report-1', severity: 'HIGH', status }),
    });
  });
});

function restrictionForm() {
  const formData = new FormData();
  for (const [name, value] of Object.entries({
    confirmation: 'confirmed',
    noExpiry: 'true',
    providerProfileId: 'partner-1',
    reason: 'Verified safety evidence',
    reportId: 'report-1',
    returnTo: '/partner-controls?details=reports',
    type: 'PAYOUT_HOLD',
  })) {
    formData.set(name, value);
  }
  return formData;
}

function reportForm() {
  const formData = new FormData();
  for (const [name, value] of Object.entries({
    bookingId: 'booking-1',
    category: 'SAFETY',
    details: 'Customer supplied supporting chat evidence',
    providerProfileId: 'partner-1',
    returnTo: '/partner-controls?details=reports',
    severity: 'HIGH',
    summary: 'Partner safety report',
  })) {
    formData.set(name, value);
  }
  return formData;
}
