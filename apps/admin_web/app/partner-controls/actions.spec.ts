import { vi } from 'vitest';

import { adminPatch, adminPost } from '../../lib/admin-api';
import {
  createProviderReportWithState,
  createProviderSanctionWithState,
  liftProviderSanction,
  updateProviderReportWithState,
} from './actions';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
  adminPost: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockedAdminPost = vi.mocked(adminPost);
const mockedAdminPatch = vi.mocked(adminPatch);

describe('Partner control actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPost.mockResolvedValue(null);
    mockedAdminPatch.mockResolvedValue(null);
  });

  it('refuses a restriction without the explicit target confirmation', async () => {
    const formData = restrictionForm();
    formData.delete('confirmation');

    const result = await createProviderSanctionWithState(null, formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'error',
      values: { noExpiry: 'true', reason: 'Verified safety evidence', type: 'PAYOUT_HOLD' },
    });
  });

  it('requires exactly one expiry choice and sends a deliberate no-expiry record', async () => {
    const invalid = restrictionForm();
    invalid.delete('noExpiry');
    await createProviderSanctionWithState(null, invalid);
    expect(mockedAdminPost).not.toHaveBeenCalled();

    const valid = restrictionForm();
    const result = await createProviderSanctionWithState(null, valid);
    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/providers/partner-1/sanctions',
      {
        expiresAt: null,
        reason: 'Verified safety evidence',
        reportId: 'report-1',
        type: 'PAYOUT_HOLD',
      },
      null,
    );
    expect(result).toEqual({
      message: 'The Partner restriction was saved.',
      status: 'success',
      values: {},
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
