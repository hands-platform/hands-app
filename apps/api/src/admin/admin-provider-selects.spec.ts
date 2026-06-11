import {
  adminProviderDeviceSummarySelect,
  adminProviderDocumentSummarySelect,
  adminProviderPublicMediaSelect,
  adminProviderSummarySelect,
  adminProviderVerificationSummarySelect,
} from './admin-provider-selects';

describe('admin provider selects', () => {
  it('keeps provider summary connected to a safe user summary', () => {
    expect(adminProviderSummarySelect).toMatchObject({
      id: true,
      displayName: true,
      status: true,
      user: { select: expect.objectContaining({ id: true, phone: true }) },
    });
  });

  it('keeps verification and media selects bounded and review-aware', () => {
    expect(adminProviderVerificationSummarySelect.files).toMatchObject({
      take: 3,
      select: expect.objectContaining({ reviewStatus: true, url: true }),
    });
    expect(adminProviderPublicMediaSelect).toMatchObject({
      visibility: true,
      reviewStatus: true,
      sizeBytes: true,
    });
  });

  it('keeps document and device summaries operationally useful without raw secrets', () => {
    expect(adminProviderDocumentSummarySelect.fileAsset.select).toMatchObject({
      key: true,
      uploadStatus: true,
      sizeBytes: true,
    });
    expect(adminProviderDeviceSummarySelect).toMatchObject({
      deviceId: true,
      enabled: true,
      blockedAt: true,
      blockReason: true,
    });
  });
});
