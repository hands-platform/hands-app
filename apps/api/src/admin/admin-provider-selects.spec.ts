import {
  adminProviderBookingListSummarySelect,
  adminProviderDetailUserSelect,
  adminProviderDeviceSummarySelect,
  adminProviderDocumentSummarySelect,
  adminProviderOverviewUserSelect,
  adminProviderPublicMediaSelect,
  adminProviderReportDetailSelect,
  adminProviderReportListSelect,
  adminProviderSanctionDetailSelect,
  adminProviderSanctionListSelect,
  adminProviderSummarySelect,
  adminProviderVerificationDetailSelect,
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

  it('keeps booking list provider summaries compact for repeated rows', () => {
    expect(adminProviderBookingListSummarySelect).toMatchObject({
      id: true,
      displayName: true,
      status: true,
      currentLocationUpdatedAt: true,
      user: { select: { id: true, phone: true, fullName: true } },
    });
    expect(
      'ratingAvg' in (adminProviderBookingListSummarySelect as Record<string, unknown>),
    ).toBe(false);
    expect(
      'email' in (adminProviderBookingListSummarySelect.user.select as Record<string, unknown>),
    ).toBe(false);
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

  it('keeps provider user media selections bounded by view depth', () => {
    expect(adminProviderDetailUserSelect.fileAssets).toMatchObject({
      take: 12,
      select: adminProviderPublicMediaSelect,
    });
    expect(adminProviderOverviewUserSelect.fileAssets).toMatchObject({
      take: 3,
      select: adminProviderPublicMediaSelect,
    });
  });

  it('keeps provider verification detail file-aware', () => {
    expect(adminProviderVerificationDetailSelect.files).toMatchObject({
      select: expect.objectContaining({ key: true, url: true, reviewStatus: true }),
    });
  });

  it('keeps provider moderation selects connected to sanctions and actor context', () => {
    expect(adminProviderReportDetailSelect.sanctions).toMatchObject({
      orderBy: { createdAt: 'desc' },
    });
    expect(adminProviderReportListSelect.providerProfile).toMatchObject({
      select: expect.objectContaining({ displayName: true, user: expect.any(Object) }),
    });
    expect(adminProviderSanctionDetailSelect.report).toMatchObject({
      select: expect.objectContaining({ severity: true, status: true }),
    });
    expect(adminProviderSanctionListSelect.providerProfile).toMatchObject({
      select: expect.objectContaining({ displayName: true, user: expect.any(Object) }),
    });
  });
});
