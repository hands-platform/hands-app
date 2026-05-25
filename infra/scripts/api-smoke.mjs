const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3100/api';

async function request(path, options = {}) {
  const { retryRateLimit = true, ...fetchOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...fetchOptions,
    headers: { 'content-type': 'application/json', ...(fetchOptions.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429 && retryRateLimit) {
      const retryAfterSeconds = Number(body.retryAfterSeconds ?? response.headers.get('retry-after') ?? 30);
      await sleep(Math.max(1, retryAfterSeconds) * 1000);
      return request(path, { ...options, retryRateLimit: false });
    }
    throw new Error(
      `${fetchOptions.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

const patchJson = (path, accessToken, body) =>
  request(path, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

const postJson = (path, accessToken, body = {}) =>
  request(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

const getJson = (path, accessToken) =>
  request(path, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectRequestFailure(label, fn, expectedStatus) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(`failed: ${expectedStatus}`)) {
      throw new Error(`${label} failed with an unexpected error: ${message}`);
    }
    return true;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

const health = await request('/health');
const readiness = await request('/health/ready');
if (!health.ok || !readiness.ok) {
  throw new Error(`API is not ready: ${JSON.stringify({ health, readiness })}`);
}
const externalReadiness = await request('/health/external');
const expectedExternalCategories = ['mobile', 'supabase', 'maps', 'payments', 'storage', 'sms', 'push'];
const externalCategories = new Set((externalReadiness.checks ?? []).map((check) => check.category));
const missingExternalCategories = expectedExternalCategories.filter(
  (category) => !externalCategories.has(category),
);
if (missingExternalCategories.length > 0) {
  throw new Error(
    `External readiness is missing categories: ${JSON.stringify({
      missingExternalCategories,
      externalReadiness,
    })}`,
  );
}

const customerAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: '+84900000001', otp: '123456', role: 'CUSTOMER' }),
});

const providerAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: '+84900000002', otp: '123456', role: 'PROVIDER' }),
});

const backupProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: '+84900000003', otp: '123456', role: 'PROVIDER' }),
});

const kycNegativeProviderPhone = `+849${String(Date.now()).slice(-8)}`;
const kycNegativeProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: kycNegativeProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const walletDebtProviderPhone = `+848${String(Date.now()).slice(-8)}`;
const walletDebtProviderAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: walletDebtProviderPhone, otp: '123456', role: 'PROVIDER' }),
});

const adminAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: '+84900000099', otp: '123456', role: 'ADMIN' }),
});

await patchJson('/notifications/device-token/register', customerAuth.accessToken, {
  token: 'demo-customer-device-token',
  platform: 'android',
});

await patchJson('/notifications/device-token/register', providerAuth.accessToken, {
  token: 'demo-provider-device-token',
  platform: 'android',
});

await patchJson('/notifications/device-token/register', backupProviderAuth.accessToken, {
  token: 'demo-backup-provider-device-token',
  platform: 'android',
});

const providerSmokeDeviceId = `smoke-provider-device-${Date.now()}`;
const providerDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (
  providerDeviceSession.blocked !== false ||
  providerDeviceSession.device?.deviceId !== providerSmokeDeviceId ||
  providerDeviceSession.session?.deviceId !== providerSmokeDeviceId
) {
  throw new Error(
    `Provider device session was not recorded correctly: ${JSON.stringify(providerDeviceSession)}`,
  );
}
await postJson(`/admin/provider-devices/${providerDeviceSession.device.id}/block`, adminAuth.accessToken, {
  reason: 'Smoke test duplicate-device block',
});
const blockedProviderDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (blockedProviderDeviceSession.blocked !== true || blockedProviderDeviceSession.ok !== false) {
  throw new Error(
    `Blocked provider device was not rejected by device-session: ${JSON.stringify(blockedProviderDeviceSession)}`,
  );
}
await postJson(`/admin/provider-devices/${providerDeviceSession.device.id}/unblock`, adminAuth.accessToken);
const unblockedProviderDeviceSession = await postJson('/provider/device-session', providerAuth.accessToken, {
  deviceId: providerSmokeDeviceId,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (unblockedProviderDeviceSession.blocked !== false || unblockedProviderDeviceSession.ok !== true) {
  throw new Error(
    `Unblocked provider device still appears blocked: ${JSON.stringify(unblockedProviderDeviceSession)}`,
  );
}
await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/block`, adminAuth.accessToken, {
  reason: 'Smoke test account-level provider block',
});
const accountBlockedProviderDeviceSession = await postJson(
  '/provider/device-session',
  providerAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  accountBlockedProviderDeviceSession.providerBlocked !== true ||
  accountBlockedProviderDeviceSession.blockedScope !== 'provider' ||
  accountBlockedProviderDeviceSession.ok !== false
) {
  throw new Error(
    `Blocked provider account was not rejected by device-session: ${JSON.stringify(
      accountBlockedProviderDeviceSession,
    )}`,
  );
}
await expectRequestFailure(
  'Blocked provider account cannot go online',
  () => postJson('/provider/online', providerAuth.accessToken),
  400,
);
await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/unblock`, adminAuth.accessToken);
const accountUnblockedProviderDeviceSession = await postJson(
  '/provider/device-session',
  providerAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  accountUnblockedProviderDeviceSession.providerBlocked !== false ||
  accountUnblockedProviderDeviceSession.blocked !== false ||
  accountUnblockedProviderDeviceSession.ok !== true
) {
  throw new Error(
    `Unblocked provider account still appears blocked: ${JSON.stringify(
      accountUnblockedProviderDeviceSession,
    )}`,
  );
}

const providerRiskReport = await postJson('/admin/provider-reports', adminAuth.accessToken, {
  providerProfileId: providerAuth.user.providerProfile.id,
  category: 'smoke-risk',
  summary: 'Smoke provider risk report',
  details: 'Created by the smoke test to verify provider risk report operations.',
  severity: 'HIGH',
  source: 'ADMIN',
});
if (providerRiskReport.status !== 'OPEN' || providerRiskReport.severity !== 'HIGH') {
  throw new Error(`Provider risk report was not created correctly: ${JSON.stringify(providerRiskReport)}`);
}
const providerRiskSanction = await postJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/sanctions`,
  adminAuth.accessToken,
  {
    reportId: providerRiskReport.id,
    type: 'WARNING',
    reason: 'Smoke warning sanction for provider risk flow',
  },
);
if (providerRiskSanction.status !== 'ACTIVE' || providerRiskSanction.type !== 'WARNING') {
  throw new Error(
    `Provider risk sanction was not created correctly: ${JSON.stringify(providerRiskSanction)}`,
  );
}
const liftedProviderRiskSanction = await postJson(
  `/admin/provider-sanctions/${providerRiskSanction.id}/lift`,
  adminAuth.accessToken,
);
if (liftedProviderRiskSanction.status !== 'LIFTED') {
  throw new Error(
    `Provider risk sanction was not lifted correctly: ${JSON.stringify(liftedProviderRiskSanction)}`,
  );
}
const resolvedProviderRiskReport = await patchJson(
  `/admin/provider-reports/${providerRiskReport.id}`,
  adminAuth.accessToken,
  {
    status: 'RESOLVED',
    severity: 'MEDIUM',
    resolutionNote: 'Smoke risk report resolved',
  },
);
if (resolvedProviderRiskReport.status !== 'RESOLVED' || resolvedProviderRiskReport.severity !== 'MEDIUM') {
  throw new Error(
    `Provider risk report was not updated correctly: ${JSON.stringify(resolvedProviderRiskReport)}`,
  );
}

const services = await request('/services');
const service = services[0];
if (!service?.id || !Array.isArray(service.payoutRules) || service.priceStep !== 100000) {
  throw new Error(`Public services should expose payout-ready pricing metadata: ${JSON.stringify(service)}`);
}
const adminServices = await getJson('/admin/services', adminAuth.accessToken);
const adminService = adminServices.find((item) => item.id === service.id);
if (
  !adminService ||
  !adminService.payoutRules?.some((rule) => rule.customerPrice === service.basePrice && rule.active)
) {
  throw new Error(`Admin service matrix is missing the base payout rule: ${JSON.stringify(adminService)}`);
}
const higherCustomerPrice = service.basePrice + service.priceStep;
const higherPricePayoutRule = await postJson(
  `/admin/services/${service.id}/payout-rules`,
  adminAuth.accessToken,
  {
    customerPrice: higherCustomerPrice,
    providerPayoutAmount: Math.max(0, higherCustomerPrice - Math.round(higherCustomerPrice * 0.2)),
    vatBps: 0,
    otherCostAmount: 0,
    active: true,
    notes: 'Smoke test higher-price payout rule',
  },
);
if (
  higherPricePayoutRule.customerPrice !== higherCustomerPrice ||
  higherPricePayoutRule.providerPayoutAmount <= 0
) {
  throw new Error(
    `Higher-price payout rule was not created correctly: ${JSON.stringify(higherPricePayoutRule)}`,
  );
}
await expectRequestFailure(
  'Admin service price step below HANDS VND unit is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: `smoke_invalid_price_step_${Date.now()}`,
      name: 'Smoke Invalid Price Step',
      description: 'Service intentionally using a disallowed 50,000 VND price step.',
      durationMin: 60,
      basePrice: 100000,
      priceStep: 50000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
const serviceWithoutPayoutRule = await postJson('/admin/services', adminAuth.accessToken, {
  serviceGroupKey: `smoke_missing_payout_${Date.now()}`,
  name: 'Smoke Missing Payout Rule',
  description: 'Service intentionally missing a payout rule for booking guard coverage.',
  durationMin: 60,
  basePrice: 100000,
  priceStep: 100000,
  displayOrder: 999,
  active: true,
});
await expectRequestFailure(
  'Booking without a service payout rule is rejected',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: serviceWithoutPayoutRule.id,
      scheduledStartAt: new Date(Date.now() + 45 * 60_000).toISOString(),
      address: { line1: 'Missing payout rule smoke flow' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
const providerServicesBeforeUpdate = await getJson('/provider/services', providerAuth.accessToken);
const providerService = providerServicesBeforeUpdate.find((item) => item.id === service.id);
if (
  !providerService ||
  providerService.basePrice !== service.basePrice ||
  providerService.effectivePrice < service.basePrice ||
  !providerService.payoutOptions?.some((option) => option.customerPrice === service.basePrice)
) {
  throw new Error(`Provider service pricing list is incomplete: ${JSON.stringify(providerService)}`);
}
await expectRequestFailure(
  'Provider price below admin minimum is rejected',
  () =>
    patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
      price: service.basePrice - service.priceStep,
      active: true,
    }),
  400,
);
const updatedProviderService = await patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
  price: higherCustomerPrice,
  active: true,
});
if (updatedProviderService.price !== higherCustomerPrice || updatedProviderService.active !== true) {
  throw new Error(`Provider service price was not updated: ${JSON.stringify(updatedProviderService)}`);
}
const couponCode = `smoke${Date.now()}`;
const coupon = await postJson('/admin/coupons', adminAuth.accessToken, {
  code: couponCode,
  description: 'Smoke test checkout discount',
  discount: { type: 'percent', value: 10 },
  active: true,
});
const couponPreview = await postJson('/customer/coupons/preview', customerAuth.accessToken, {
  code: couponCode.toLowerCase(),
  serviceId: service.id,
  subtotal: service.basePrice,
});
const expectedCouponDiscount = Math.min(service.basePrice, Math.round((service.basePrice * 10) / 100));
if (coupon.code !== couponCode.toUpperCase()) {
  throw new Error(`Coupon code was not normalized by admin create: ${JSON.stringify(coupon)}`);
}
if (couponPreview.discountAmount !== expectedCouponDiscount) {
  throw new Error(
    `Coupon preview discount mismatch: ${JSON.stringify({ couponPreview, expectedCouponDiscount })}`,
  );
}

const verificationUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PRIVATE',
  purpose: 'provider-verification',
});
const completedVerificationUpload = await postJson(
  `/files/${verificationUpload.file.id}/complete`,
  providerAuth.accessToken,
  { sizeBytes: 2048 },
);
if (
  completedVerificationUpload.uploadStatus !== 'UPLOADED' ||
  completedVerificationUpload.sizeBytes !== 2048
) {
  throw new Error(
    `Verification upload was not marked complete: ${JSON.stringify(completedVerificationUpload)}`,
  );
}
await postJson('/provider/verification/submit', providerAuth.accessToken, {
  fileIds: [verificationUpload.file.id],
});
await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/approve`, adminAuth.accessToken);
const providerSupabaseRoleSync = await postJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/sync-supabase-role`,
  adminAuth.accessToken,
);
if (!['SKIPPED', 'SYNCED'].includes(providerSupabaseRoleSync.status)) {
  throw new Error(
    `Unexpected provider Supabase role sync result: ${JSON.stringify(providerSupabaseRoleSync)}`,
  );
}
await postJson(
  `/admin/providers/${backupProviderAuth.user.providerProfile.id}/approve`,
  adminAuth.accessToken,
);
const verificationReadUrl = await getJson(
  `/files/${verificationUpload.file.id}/read-url`,
  adminAuth.accessToken,
);
const providerOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  providerOnboarding.providerProfileId !== providerAuth.user.providerProfile.id ||
  !providerOnboarding.payoutGate ||
  !Array.isArray(providerOnboarding.nextRequiredActions)
) {
  throw new Error(`Provider onboarding snapshot is incomplete: ${JSON.stringify(providerOnboarding)}`);
}
if (
  providerOnboarding.completedBookingCount === 0 &&
  (providerOnboarding.payoutGate.missing?.taxProfileApproved ||
    providerOnboarding.payoutGate.missing?.residentialAddress ||
    (providerOnboarding.payoutGate.missing?.agreements ?? []).length > 0)
) {
  throw new Error(
    `Provider payout gate should defer tax/address/agreements until first completed service: ${JSON.stringify(
      providerOnboarding.payoutGate,
    )}`,
  );
}
await patchJson('/provider/onboarding/basic-profile', providerAuth.accessToken, {
  legalName: 'Smoke Provider',
  dateOfBirth: '1995-01-01',
  displayName: 'Smoke Provider',
  bio: 'Provider onboarding smoke profile.',
  experienceYears: 5,
  specialties: ['Foot massage', 'Swedish massage'],
  languages: ['vi', 'en'],
  serviceStyle: 'Calm, professional hotel and home service.',
  residentialAddress: 'District 1, Ho Chi Minh City, Vietnam',
  city: 'Ho Chi Minh City',
  serviceArea: { country: 'VN', cities: ['Ho Chi Minh City'] },
});
const providerOnboardingAfterBasicProfile = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  providerOnboardingAfterBasicProfile.basicProfile?.experienceYears !== 5 ||
  !providerOnboardingAfterBasicProfile.basicProfile?.specialties?.includes('Foot massage') ||
  !providerOnboardingAfterBasicProfile.basicProfile?.languages?.includes('vi')
) {
  throw new Error(
    `Provider profile quality fields were not saved: ${JSON.stringify(
      providerOnboardingAfterBasicProfile.basicProfile,
    )}`,
  );
}
const publicProfileImageUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PUBLIC',
  purpose: 'profile-image',
});
await postJson(`/files/${publicProfileImageUpload.file.id}/complete`, providerAuth.accessToken, {
  sizeBytes: 4096,
});
await postJson(
  `/admin/files/${publicProfileImageUpload.file.id}/approve-public-media`,
  adminAuth.accessToken,
);
const publicGalleryImageUpload = await postJson('/files/presign', providerAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PUBLIC',
  purpose: 'provider-gallery',
});
await postJson(`/files/${publicGalleryImageUpload.file.id}/complete`, providerAuth.accessToken, {
  sizeBytes: 8192,
});
await postJson(
  `/admin/files/${publicGalleryImageUpload.file.id}/approve-public-media`,
  adminAuth.accessToken,
);
await expectRequestFailure(
  'KYC submit without required documents',
  () =>
    postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: [],
    }),
  400,
);
const duplicateKycFileUpload = await postJson('/files/presign', kycNegativeProviderAuth.accessToken, {
  contentType: 'image/jpeg',
  visibility: 'PRIVATE',
  purpose: 'provider-kyc-duplicate-file-negative',
});
await postJson(`/files/${duplicateKycFileUpload.file.id}/complete`, kycNegativeProviderAuth.accessToken, {
  sizeBytes: 1024,
});
await expectRequestFailure(
  'KYC submit rejects duplicate file ids across document types',
  () =>
    postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: [
        { fileId: duplicateKycFileUpload.file.id, type: 'CCCD_FRONT' },
        { fileId: duplicateKycFileUpload.file.id, type: 'CCCD_BACK' },
        { fileId: duplicateKycFileUpload.file.id, type: 'SELFIE' },
      ],
    }),
  400,
);
const pendingKycDocumentUploads = [];
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const upload = await postJson('/files/presign', kycNegativeProviderAuth.accessToken, {
    contentType: 'image/jpeg',
    visibility: 'PRIVATE',
    purpose: `provider-kyc-pending-${type.toLowerCase()}`,
  });
  await postJson(`/files/${upload.file.id}/complete`, kycNegativeProviderAuth.accessToken, {
    sizeBytes: 1024,
  });
  pendingKycDocumentUploads.push({ fileId: upload.file.id, type });
}
await postJson('/provider/onboarding/kyc/submit', kycNegativeProviderAuth.accessToken, {
  cccdNumber: '000000000000',
  documents: pendingKycDocumentUploads,
});
await expectRequestFailure(
  'KYC approve before required documents are approved',
  () =>
    postJson(
      `/admin/providers/${kycNegativeProviderAuth.user.providerProfile.id}/kyc/approve`,
      adminAuth.accessToken,
    ),
  400,
);
const kycDocumentUploads = [];
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const upload = await postJson('/files/presign', providerAuth.accessToken, {
    contentType: 'image/jpeg',
    visibility: 'PRIVATE',
    purpose: `provider-kyc-${type.toLowerCase()}`,
  });
  await postJson(`/files/${upload.file.id}/complete`, providerAuth.accessToken, { sizeBytes: 1024 });
  kycDocumentUploads.push({ fileId: upload.file.id, type });
}
await postJson('/provider/onboarding/kyc/submit', providerAuth.accessToken, {
  cccdNumber: '000000000000',
  documents: kycDocumentUploads,
});
const kycSubmittedOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const document = kycSubmittedOnboarding.documents.find(
    (item) => item.type === type && item.status !== 'APPROVED',
  );
  if (document) {
    await postJson(`/admin/provider-documents/${document.id}/approve`, adminAuth.accessToken);
  }
}
await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/kyc/approve`, adminAuth.accessToken);
const onboardingBankAccount = await postJson('/provider/onboarding/bank-accounts', providerAuth.accessToken, {
  bankName: 'Vietcombank',
  accountNumber: '000012345678',
  accountHolderName: 'Smoke Provider',
});
await postJson(
  `/admin/provider-bank-accounts/${onboardingBankAccount.bankAccount.id}/approve`,
  adminAuth.accessToken,
);
await postJson('/provider/onboarding/tax-profile', providerAuth.accessToken, {
  taxCode: '0000000000',
  legalName: 'Smoke Provider',
  registeredAddress: 'District 1, Ho Chi Minh City, Vietnam',
});
await postJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/tax-profile/approve`,
  adminAuth.accessToken,
);
for (const type of ['TERMS', 'PRIVACY', 'LOCATION', 'PAYOUT', 'TAX']) {
  await postJson('/provider/onboarding/agreements', providerAuth.accessToken, {
    type,
    version: '2026-05',
    deviceId: 'smoke-device',
  });
}
const approvedProviderOnboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
if (
  approvedProviderOnboarding.kyc?.status !== 'APPROVED' ||
  !approvedProviderOnboarding.bankAccounts?.some((account) => account.status === 'APPROVED') ||
  approvedProviderOnboarding.taxProfile?.status !== 'APPROVED'
) {
  throw new Error(`Provider onboarding review flow failed: ${JSON.stringify(approvedProviderOnboarding)}`);
}
const taxPolicyVersions = await getJson('/admin/tax-policy-versions', adminAuth.accessToken);
if (!Array.isArray(taxPolicyVersions)) {
  throw new Error(`Tax policy version list did not return an array: ${JSON.stringify(taxPolicyVersions)}`);
}
const smokeTaxPolicy = await postJson('/admin/tax-policy-versions', adminAuth.accessToken, {
  name: `Smoke withholding ${Date.now()}`,
  status: 'ACTIVE',
  effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
  notes: 'Smoke test active withholding policy',
});
const smokeTaxRule = await postJson(
  `/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`,
  adminAuth.accessToken,
  {
    scope: 'DEFAULT',
    rateBps: 500,
    fixedAmount: 0,
    active: true,
  },
);
const updatedSmokeTaxRule = await patchJson(`/admin/tax-rules/${smokeTaxRule.id}`, adminAuth.accessToken, {
  scope: 'DEFAULT',
  rateBps: 500,
  fixedAmount: 0,
  active: false,
});
if (updatedSmokeTaxRule.active !== false || updatedSmokeTaxRule.rateBps !== 500) {
  throw new Error(`Tax rule update failed: ${JSON.stringify(updatedSmokeTaxRule)}`);
}
await patchJson(`/admin/tax-rules/${smokeTaxRule.id}`, adminAuth.accessToken, {
  active: true,
});

await postJson('/provider/online', providerAuth.accessToken);
await postJson('/provider/online', backupProviderAuth.accessToken);
await postJson('/provider/online', walletDebtProviderAuth.accessToken);

await postJson('/provider/location', providerAuth.accessToken, {
  lat: 10.7769,
  lng: 106.7009,
});

await postJson('/provider/location', backupProviderAuth.accessToken, {
  lat: 10.7825,
  lng: 106.6951,
});

const savedSelectedLocation = await postJson('/customer/locations/selected', customerAuth.accessToken, {
  lat: 10.7769,
  lng: 106.7009,
  addressText: 'District 1, Ho Chi Minh City, Vietnam',
});
if (
  !savedSelectedLocation.id ||
  savedSelectedLocation.addressText !== 'District 1, Ho Chi Minh City, Vietnam'
) {
  throw new Error(`Customer selected location was not saved: ${JSON.stringify(savedSelectedLocation)}`);
}

await expectRequestFailure(
  'Out-of-country customer selected location',
  () =>
    postJson('/customer/locations/selected', customerAuth.accessToken, {
      lat: 0,
      lng: 0,
      addressText: 'Invalid location',
    }),
  400,
);

const nearbyProviders = await getJson(
  '/customer/providers/nearby?lat=10.7769&lng=106.7009',
  customerAuth.accessToken,
);
const nearbyProvider = nearbyProviders.find((item) => item.id === providerAuth.user.providerProfile.id);
if (!nearbyProvider?.currentLocationUpdatedAt || nearbyProvider.isRecentLocation !== true) {
  throw new Error(`Nearby provider payload is missing freshness metadata: ${JSON.stringify(nearbyProvider)}`);
}
if (
  !nearbyProvider.profileImageUrl ||
  !Array.isArray(nearbyProvider.galleryImageUrls) ||
  nearbyProvider.galleryImageUrls.length < 2
) {
  throw new Error(`Nearby provider payload is missing public media: ${JSON.stringify(nearbyProvider)}`);
}
const customerProviderDetail = await getJson(
  `/customer/providers/${providerAuth.user.providerProfile.id}`,
  customerAuth.accessToken,
);
if (
  !customerProviderDetail.profileImageUrl ||
  !Array.isArray(customerProviderDetail.galleryImageUrls) ||
  customerProviderDetail.galleryImageUrls.length < 2
) {
  throw new Error(
    `Customer provider detail payload is missing public media: ${JSON.stringify(customerProviderDetail)}`,
  );
}

await expectRequestFailure(
  'Out-of-country provider search',
  () => getJson('/customer/providers/nearby?lat=0&lng=0', customerAuth.accessToken),
  400,
);

const booking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});

const hybridBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 75 * 60_000).toISOString(),
  address: { line1: 'Hybrid fallback smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});

const momoBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 90 * 60_000).toISOString(),
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});

const couponBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  couponCode: couponCode.toLowerCase(),
  scheduledStartAt: new Date(Date.now() + 105 * 60_000).toISOString(),
  address: { line1: 'Coupon checkout smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'CASH',
});
const expectedCouponTotal = Math.max(0, service.basePrice - expectedCouponDiscount);
const couponPayment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === couponBooking.id),
);
if (couponPayment?.amount !== expectedCouponTotal) {
  throw new Error(
    `Coupon booking payment total mismatch: ${JSON.stringify({
      amount: couponPayment?.amount,
      expectedCouponTotal,
      couponPayment,
    })}`,
  );
}

const cancellableMomoBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 120 * 60_000).toISOString(),
  address: { line1: 'Cancellation release smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const cancelledMomoBooking = await postJson(
  `/customer/bookings/${cancellableMomoBooking.id}/cancel`,
  customerAuth.accessToken,
);
if (cancelledMomoBooking.status !== 'CANCELLED' || cancelledMomoBooking.payment?.status !== 'RELEASED') {
  throw new Error(`Cancelled booking did not release payment hold: ${JSON.stringify(cancelledMomoBooking)}`);
}
const cancelledPaymentSync = await postJson(
  `/admin/payments/${cancelledMomoBooking.payment.id}/sync`,
  adminAuth.accessToken,
);
const cancelledPaymentAfterSync = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === cancellableMomoBooking.id),
);
if (cancelledPaymentAfterSync?.status !== 'RELEASED') {
  throw new Error(
    `Released payment was overwritten by sync: ${JSON.stringify({ cancelledPaymentSync, cancelledPaymentAfterSync })}`,
  );
}

await postJson(`/provider/bookings/${booking.id}/join`, providerAuth.accessToken);
await postJson(`/provider/bookings/${hybridBooking.id}/join`, backupProviderAuth.accessToken);

const hybridMatched = await postJson(
  `/customer/bookings/${hybridBooking.id}/select-provider`,
  customerAuth.accessToken,
  {
    providerId: backupProviderAuth.user.providerProfile.id,
  },
);

const walletDebtBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtProviderAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 135 * 60_000).toISOString(),
  address: { line1: 'Negative wallet source smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const blockedDirectBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtProviderAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 150 * 60_000).toISOString(),
  address: { line1: 'Negative wallet acceptance smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
await postJson(`/provider/bookings/${walletDebtBooking.id}/accept`, walletDebtProviderAuth.accessToken);
await postJson(`/provider/bookings/${walletDebtBooking.id}/complete`, walletDebtProviderAuth.accessToken);
const walletDebtProviderEarningsSummary = await getJson(
  '/provider/earnings/summary',
  walletDebtProviderAuth.accessToken,
);
if (
  walletDebtProviderEarningsSummary.walletBalance >= 0 ||
  walletDebtProviderEarningsSummary.walletBlocked !== true ||
  walletDebtProviderEarningsSummary.walletDebtAmount <= 0 ||
  !walletDebtProviderEarningsSummary.walletSettlementInstruction
) {
  throw new Error(
    `Cash booking did not create a negative provider wallet: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
await expectRequestFailure(
  'Negative provider wallet blocks direct booking acceptance',
  () => postJson(`/provider/bookings/${blockedDirectBooking.id}/accept`, walletDebtProviderAuth.accessToken),
  400,
);
const adminEarningsAfterCashDebt = await getJson('/admin/earnings', adminAuth.accessToken);
const cashDebtEarning = adminEarningsAfterCashDebt.find(
  (earning) => earning.bookingId === walletDebtBooking.id && earning.netAmount < 0,
);
if (!cashDebtEarning) {
  throw new Error(
    `Cash debt earning was not visible to admin: ${JSON.stringify(adminEarningsAfterCashDebt[0])}`,
  );
}
const cashDebtSettlementRef = `SMOKE-CASH-FEE-${Date.now()}`;
await postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {
  settlementRef: cashDebtSettlementRef,
  settlementNotes: 'Smoke test cash fee deposit reference',
});
const adminEarningsAfterCashSettlement = await getJson('/admin/earnings', adminAuth.accessToken);
const settledCashDebtEarning = adminEarningsAfterCashSettlement.find(
  (earning) => earning.id === cashDebtEarning.id,
);
if (settledCashDebtEarning?.settlementRef !== cashDebtSettlementRef) {
  throw new Error(
    `Cash fee settlement reference was not persisted: ${JSON.stringify(settledCashDebtEarning)}`,
  );
}
const walletDebtProviderSummaryAfterSettlement = await getJson(
  '/provider/earnings/summary',
  walletDebtProviderAuth.accessToken,
);
if (
  walletDebtProviderSummaryAfterSettlement.walletBalance < 0 ||
  walletDebtProviderSummaryAfterSettlement.walletBlocked === true
) {
  throw new Error(
    `Cash fee settlement did not unblock provider wallet: ${JSON.stringify(
      walletDebtProviderSummaryAfterSettlement,
    )}`,
  );
}
await postJson(`/provider/bookings/${blockedDirectBooking.id}/accept`, walletDebtProviderAuth.accessToken);

const matched = await postJson(`/customer/bookings/${booking.id}/select-provider`, customerAuth.accessToken, {
  providerId: providerAuth.user.providerProfile.id,
});

const customerBookings = await getJson('/customer/bookings', customerAuth.accessToken);
const providerBookings = await getJson('/provider/bookings', providerAuth.accessToken);
const chatRoomId = matched.booking.chatRoom.id;

const chatMessage = await postJson(`/chat/rooms/${chatRoomId}/messages`, customerAuth.accessToken, {
  body: 'Hello, see you soon.',
});

await postJson(`/provider/bookings/${booking.id}/complete`, providerAuth.accessToken);

const review = await postJson('/customer/reviews', customerAuth.accessToken, {
  bookingId: booking.id,
  rating: 5,
  comment: 'Great service.',
  tipAmount: 50000,
});

const providerEarnings = await getJson('/provider/earnings', providerAuth.accessToken);
const providerEarningsSummary = await getJson('/provider/earnings/summary', providerAuth.accessToken);
const completedEarning = providerEarnings.find((earning) => earning.bookingId === booking.id);
if (
  !completedEarning ||
  completedEarning.withholdingAmount <= 0 ||
  completedEarning.netAmount !==
    completedEarning.grossAmount -
      completedEarning.platformFee -
      completedEarning.withholdingAmount +
      completedEarning.tipAmount
) {
  throw new Error(`Completed earning did not apply withholding policy: ${JSON.stringify(completedEarning)}`);
}
if (providerEarningsSummary.withholdingAmount <= 0) {
  throw new Error(`Earnings summary did not include withholding: ${JSON.stringify(providerEarningsSummary)}`);
}
const adminCompletedEarning = (await getJson('/admin/earnings', adminAuth.accessToken)).find(
  (earning) => earning.bookingId === booking.id,
);
if (
  !adminCompletedEarning?.platformFeeLogs?.length ||
  adminCompletedEarning.platformFeeLogs[0].platformFeeAmount !== completedEarning.platformFee
) {
  throw new Error(
    `Completed earning did not record platform fee policy log: ${JSON.stringify(adminCompletedEarning)}`,
  );
}
if (adminCompletedEarning.platformFeeLogs[0].ruleSnapshot?.source !== 'SERVICE_PAYOUT_RULE') {
  throw new Error(
    `Completed earning should prefer the service payout matrix: ${JSON.stringify(
      adminCompletedEarning.platformFeeLogs[0],
    )}`,
  );
}
if (providerEarningsSummary.walletBlocked === true || providerEarningsSummary.walletBalance <= 0) {
  throw new Error(
    `Online payment earning should keep provider wallet positive: ${JSON.stringify(providerEarningsSummary)}`,
  );
}
const existingPayoutHolds = await getJson('/admin/provider-sanctions', adminAuth.accessToken);
for (const sanction of existingPayoutHolds.filter(
  (item) =>
    item.providerProfileId === providerAuth.user.providerProfile.id &&
    item.type === 'PAYOUT_HOLD' &&
    item.status === 'ACTIVE',
)) {
  await postJson(`/admin/provider-sanctions/${sanction.id}/lift`, adminAuth.accessToken);
}
const payoutHoldSanction = await postJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/sanctions`,
  adminAuth.accessToken,
  {
    type: 'PAYOUT_HOLD',
    reason: 'Smoke payout hold before finance release',
  },
);
await expectRequestFailure(
  'Active payout hold blocks payout batch creation',
  () =>
    postJson('/admin/payout-batches', adminAuth.accessToken, {
      providerProfileId: providerAuth.user.providerProfile.id,
      transferRef: `SMOKE-HOLD-${Date.now()}`,
      notes: 'This should be blocked by active payout hold',
    }),
  400,
);
const liftedPayoutHoldSanction = await postJson(
  `/admin/provider-sanctions/${payoutHoldSanction.id}/lift`,
  adminAuth.accessToken,
);
if (liftedPayoutHoldSanction.status !== 'LIFTED') {
  throw new Error(`Payout hold sanction was not lifted: ${JSON.stringify(liftedPayoutHoldSanction)}`);
}
const payoutBatch = await postJson('/admin/payout-batches', adminAuth.accessToken, {
  providerProfileId: providerAuth.user.providerProfile.id,
  transferRef: `SMOKE-${Date.now()}`,
  notes: 'Created by smoke test',
});
if (payoutBatch.status !== 'DRAFT' || payoutBatch.paidAt) {
  throw new Error(`Payout batch should start as draft: ${JSON.stringify(payoutBatch)}`);
}
if (!payoutBatch.earnings?.length || payoutBatch.earnings.some((earning) => earning.status === 'PAID')) {
  throw new Error(`Draft payout batch should not mark earnings paid: ${JSON.stringify(payoutBatch)}`);
}
if (!payoutBatch.withholdingLogs?.length) {
  throw new Error(`Draft payout batch should include withholding logs: ${JSON.stringify(payoutBatch)}`);
}
const payoutBatchUpdate = await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  transferRef: `${payoutBatch.transferRef}-UPDATED`,
  notes: 'Updated by smoke test',
});
if (payoutBatchUpdate.transferRef !== `${payoutBatch.transferRef}-UPDATED`) {
  throw new Error(`Payout batch transfer reference was not updated: ${JSON.stringify(payoutBatchUpdate)}`);
}
const payoutBatchProcessing = await patchJson(
  `/admin/payout-batches/${payoutBatch.id}`,
  adminAuth.accessToken,
  {
    status: 'PROCESSING',
  },
);
if (payoutBatchProcessing.status !== 'PROCESSING' || payoutBatchProcessing.paidAt) {
  throw new Error(
    `Payout batch should move to processing without paidAt: ${JSON.stringify(payoutBatchProcessing)}`,
  );
}
const payoutBatchPaid = await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  status: 'PAID',
});
if (
  payoutBatchPaid.status !== 'PAID' ||
  !payoutBatchPaid.paidAt ||
  payoutBatchPaid.earnings?.some((earning) => earning.status !== 'PAID') ||
  payoutBatchPaid.withholdingLogs?.some((log) => log.status !== 'PAID')
) {
  throw new Error(`Payout batch should mark linked earnings paid: ${JSON.stringify(payoutBatchPaid)}`);
}
const adminPayoutBatches = await getJson('/admin/payout-batches', adminAuth.accessToken);
const adminBookings = await getJson('/admin/bookings', adminAuth.accessToken);
const adminBooking = adminBookings.find((item) => item.id === booking.id);
if (!adminBooking?.chatRoom?.id || !adminBooking?.services?.length || !adminBooking?.participants?.length) {
  throw new Error(`Admin booking monitor payload is incomplete: ${JSON.stringify(adminBooking)}`);
}
const adminBookingDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (
  adminBookingDetail?.id !== booking.id ||
  !adminBookingDetail?.payment?.id ||
  !adminBookingDetail?.chatRoom?.messages?.some((message) => message.id === chatMessage.id) ||
  !adminBookingDetail?.review?.id ||
  !adminBookingDetail?.earning?.id
) {
  throw new Error(`Admin booking detail payload is incomplete: ${JSON.stringify(adminBookingDetail)}`);
}
const adminHybridBooking = adminBookings.find((item) => item.id === hybridBooking.id);
if (!adminHybridBooking?.preferredProvider?.id || !adminHybridBooking?.selectedProvider?.id) {
  throw new Error(
    `Hybrid booking is missing preferred/final provider state: ${JSON.stringify(adminHybridBooking)}`,
  );
}
if (adminHybridBooking.preferredProvider.id === adminHybridBooking.selectedProvider.id) {
  throw new Error(
    `Hybrid booking did not switch from preferred to backup provider: ${JSON.stringify(adminHybridBooking)}`,
  );
}
const adminCancelledBooking = adminBookings.find((item) => item.id === cancellableMomoBooking.id);
if (adminCancelledBooking?.status !== 'CANCELLED' || adminCancelledBooking?.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin booking monitor did not expose cancellation release state: ${JSON.stringify(adminCancelledBooking)}`,
  );
}
const adminProviders = await getJson('/admin/providers', adminAuth.accessToken);
const adminProvider = adminProviders.find((item) => item.id === providerAuth.user.providerProfile.id);
if (!adminProvider?.user?.pushDevices?.some((device) => device.token === 'demo-provider-device-token')) {
  throw new Error(
    `Admin provider payload is missing registered push device: ${JSON.stringify(adminProvider)}`,
  );
}
if (
  adminProvider?.kyc?.status !== 'APPROVED' ||
  !adminProvider?.bankAccounts?.some((account) => account.status === 'APPROVED') ||
  adminProvider?.taxProfile?.status !== 'APPROVED'
) {
  throw new Error(
    `Admin provider payload is missing onboarding review state: ${JSON.stringify(adminProvider)}`,
  );
}
if (
  !adminProvider?.user?.fileAssets?.some(
    (file) => file.id === publicProfileImageUpload.file.id && file.reviewStatus === 'APPROVED',
  )
) {
  throw new Error(
    `Admin provider payload is missing approved public media: ${JSON.stringify(adminProvider)}`,
  );
}
const adminBackupProvider = adminProviders.find(
  (item) => item.id === backupProviderAuth.user.providerProfile.id,
);
if (
  !adminBackupProvider?.user?.pushDevices?.some(
    (device) => device.token === 'demo-backup-provider-device-token',
  )
) {
  throw new Error(
    `Admin backup provider payload is missing registered push device: ${JSON.stringify(adminBackupProvider)}`,
  );
}
const payment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === booking.id),
);
const momoPayment = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === momoBooking.id),
);
const syncedMomo = momoPayment
  ? await postJson(`/admin/payments/${momoPayment.id}/sync`, adminAuth.accessToken)
  : null;
const releasedMomo = momoPayment
  ? await postJson(`/admin/payments/${momoPayment.id}/release`, adminAuth.accessToken)
  : null;
const capturedCash = couponPayment
  ? await postJson(`/admin/payments/${couponPayment.id}/capture`, adminAuth.accessToken)
  : null;
const refund = payment ? await postJson(`/admin/payments/${payment.id}/refund`, adminAuth.accessToken) : null;
const adminRefunds = await getJson('/admin/refunds', adminAuth.accessToken);
const notifications = await getJson('/notifications', customerAuth.accessToken);
const notificationToRetry = notifications[0];
let retryBeforeDeliveryCount = 0;
let retryAccepted = false;
if (notificationToRetry) {
  await patchJson('/notifications/device-token/register', customerAuth.accessToken, {
    token: 'demo-customer-device-token',
    platform: 'android',
  });
  const adminNotificationsBeforeRetry = await getJson('/admin/notifications', adminAuth.accessToken);
  const adminNotificationBeforeRetry = adminNotificationsBeforeRetry.find(
    (item) => item.id === notificationToRetry.id,
  );
  retryBeforeDeliveryCount = adminNotificationBeforeRetry?.deliveries?.length ?? 0;
  const retryResult = await postJson(
    `/admin/notifications/${notificationToRetry.id}/retry`,
    adminAuth.accessToken,
  );
  retryAccepted = Boolean(retryResult?.ok);
}
let retriedNotification = null;
for (let attempt = 0; attempt < 20 && notificationToRetry; attempt++) {
  await sleep(500);
  const adminNotifications = await getJson('/admin/notifications', adminAuth.accessToken);
  retriedNotification = adminNotifications.find((item) => item.id === notificationToRetry.id);
  if ((retriedNotification?.deliveries?.length ?? 0) > retryBeforeDeliveryCount) {
    break;
  }
}

console.log({
  ok: true,
  bookingId: booking.id,
  hybridBookingId: hybridBooking.id,
  chatRoomId,
  hybridChatRoomId: hybridMatched.booking.chatRoom.id,
  customerBookingCount: customerBookings.length,
  providerBookingCount: providerBookings.length,
  chatMessageId: chatMessage.id,
  reviewId: review.id,
  earningCount: providerEarnings.length,
  providerNetAmount: providerEarningsSummary.netAmount,
  payoutBatchId: payoutBatch.id,
  payoutBatchCount: adminPayoutBatches.length,
  adminBookingMonitorReady: true,
  adminBookingDetailReady: true,
  adminProviderPushDeviceCount: adminProvider?.user?.pushDevices?.length ?? 0,
  adminBackupProviderPushDeviceCount: adminBackupProvider?.user?.pushDevices?.length ?? 0,
  providerDeviceSessionId: providerDeviceSession.session?.id ?? null,
  providerDeviceBlockRoundTrip:
    blockedProviderDeviceSession.blocked === true && unblockedProviderDeviceSession.blocked === false,
  providerRiskReportId: providerRiskReport.id,
  providerRiskReportStatus: resolvedProviderRiskReport.status,
  providerRiskSanctionId: providerRiskSanction.id,
  providerRiskSanctionLifted: liftedProviderRiskSanction.status === 'LIFTED',
  providerPayoutHoldBlocked: Boolean(payoutHoldSanction.id) && liftedPayoutHoldSanction.status === 'LIFTED',
  providerSupabaseRoleSyncStatus: providerSupabaseRoleSync.status,
  hybridPreferredProviderId: adminHybridBooking?.preferredProvider?.id ?? null,
  hybridSelectedProviderId: adminHybridBooking?.selectedProvider?.id ?? null,
  hybridSwitchedToBackup:
    adminHybridBooking?.preferredProvider?.id !== adminHybridBooking?.selectedProvider?.id,
  savedSelectedLocationId: savedSelectedLocation.id,
  nearbyProviderDistanceMeters: nearbyProvider.distanceMeters,
  nearbyProviderRecent: nearbyProvider.isRecentLocation,
  providerProfileImageReady: Boolean(customerProviderDetail.profileImageUrl),
  providerGalleryImageCount: customerProviderDetail.galleryImageUrls.length,
  providerPublicMediaApproved: true,
  momoPaymentStatus: momoPayment?.status ?? null,
  couponId: coupon.id,
  couponCode: coupon.code,
  couponDiscountAmount: couponPreview.discountAmount,
  couponBookingPaymentAmount: couponPayment?.amount ?? null,
  cancelledBookingId: cancellableMomoBooking.id,
  cancelledBookingStatus: cancelledMomoBooking.status,
  cancelledPaymentStatus: cancelledMomoBooking.payment?.status ?? null,
  cancelledPaymentSyncSkipped: cancelledPaymentSync?.skipped ?? false,
  syncedMomoStatus: syncedMomo?.status ?? null,
  releasedMomoStatus: releasedMomo?.status ?? null,
  capturedCashStatus: capturedCash?.status ?? null,
  refundId: refund?.refunds?.at(-1)?.id ?? null,
  refundCount: adminRefunds.length,
  verificationFileId: verificationUpload.file.id,
  verificationUploadStatus: completedVerificationUpload.uploadStatus,
  verificationReadStorageMode: verificationReadUrl.storageMode,
  providerOnboardingLevel: providerOnboarding.level,
  taxPolicyVersionCount: taxPolicyVersions.length,
  customerNotifications: notifications.length,
  retryAccepted,
  retryBeforeDeliveryCount,
  retriedNotificationDeliveryCount: retriedNotification?.deliveries?.length ?? 0,
  retryDeliveryObserved: (retriedNotification?.deliveries?.length ?? 0) > retryBeforeDeliveryCount,
  readiness,
  externalReadinessOk: externalReadiness.ok,
  externalReadinessCategories: [...externalCategories].sort(),
});
