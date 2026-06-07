const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const defaultCustomerCurrentLocation = {
  currentLat: 10.7769,
  currentLng: 106.7009,
};

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
    body: JSON.stringify(applyBookingAttemptLocationDefaults(path, body)),
  });

async function startAndCompleteBooking(bookingId, providerAccessToken) {
  await postJson(`/provider/bookings/${bookingId}/start`, providerAccessToken);
  return postJson(`/provider/bookings/${bookingId}/complete`, providerAccessToken);
}

const getJson = (path, accessToken) =>
  request(path, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

const operationalPolicyPath = (key) => `/admin/operational-policy/${encodeURIComponent(key)}`;

async function getOperationalPolicyValue(accessToken, key) {
  const settings = await getJson('/admin/operational-policy', accessToken);
  return settings.find((setting) => setting.key === key)?.value;
}

async function assertOperationalPolicyMetadata(accessToken) {
  const settings = await getJson('/admin/operational-policy', accessToken);
  const requiredLivePolicyKeys = [
    'matching.provider_response_window_minutes',
    'matching.marketplace_partner_radius_meters',
    'matching.marketplace_partner_location_max_age_minutes',
    'matching.marketplace_partner_invitation_limit',
    'matching.travel_buffer_minutes',
    'matching.preferred_accept_mode',
    'matching.marketplace_open_mode',
    'booking.max_customer_current_to_booking_address_km',
    'booking.max_preferred_partner_distance_km',
    'booking.current_location_freshness_minutes',
    'booking.distance_gate_enabled',
    'booking.service_area_required',
    'wallet.negative_balance_gate',
    'decision.action_evidence_gate_mode',
    'cash.settlement_clearance_policy',
    'payout.batch_cycle_policy',
    'matching.first_pick_expiry_action_policy',
    'cancellation.after_match_policy',
    'no_show.evidence_requirement_policy',
    'no_show.partner_report_policy',
    'notification.partner_alert_channel',
  ];
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const missingLivePolicies = requiredLivePolicyKeys.filter((key) => !settingsByKey.has(key));
  const unenforcedLivePolicies = requiredLivePolicyKeys.filter(
    (key) => settingsByKey.get(key)?.enforced !== true,
  );
  const optionPolicyKeys = [
    'matching.marketplace_open_mode',
    'wallet.negative_balance_gate',
    'decision.action_evidence_gate_mode',
    'cash.settlement_clearance_policy',
    'payout.batch_cycle_policy',
    'matching.first_pick_expiry_action_policy',
    'cancellation.after_match_policy',
    'no_show.evidence_requirement_policy',
    'no_show.partner_report_policy',
    'notification.partner_alert_channel',
  ];
  const missingPolicyOptions = optionPolicyKeys.filter((key) => {
    const options = settingsByKey.get(key)?.options;
    return !Array.isArray(options) || options.length < 2;
  });

  if (missingLivePolicies.length || unenforcedLivePolicies.length || missingPolicyOptions.length) {
    throw new Error(
      `Operational policy metadata is incomplete: ${JSON.stringify({
        missingLivePolicies,
        unenforcedLivePolicies,
        missingPolicyOptions,
      })}`,
    );
  }
}

const patchOperationalPolicyValue = (accessToken, key, value) =>
  patchJson(operationalPolicyPath(key), accessToken, {
    value,
    reason: `Automated smoke coverage for ${key}`,
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function applyBookingAttemptLocationDefaults(path, body) {
  if (path !== '/customer/bookings' || !body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  if ('currentLat' in body || 'currentLng' in body || 'currentLocationUpdatedAt' in body) {
    return body;
  }
  return {
    ...body,
    ...defaultCustomerCurrentLocation,
    currentLocationUpdatedAt: new Date().toISOString(),
  };
}

async function expectRequestFailure(label, fn, expectedStatus) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(`failed: ${expectedStatus}`)) {
      throw new Error(`${label} failed with an unexpected error: ${message}`);
    }
    return message;
  }
  throw new Error(`${label} unexpectedly succeeded`);
}

function assertNegativeWalletBlockResponse(label, message) {
  const requiredMarkers = [
    '"code":"PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT"',
    '"walletBlocked":true',
    '"marketplaceVisibilityBlocked":false',
    '"marketplaceJoinBlocked":true',
    '"directFirstPickBlocked":false',
    '"alreadyMatchedServiceBlocked":false',
    '"payoutReleaseBlocked":true',
    '"walletDebtAmount":',
    '"walletSettlementRequired":true',
    '"walletSettlementMethod":"PROVIDER_DEPOSIT_OR_ADMIN_OFFSET"',
    '"walletSettlementReference":"HANDS-WALLET-',
    '"displayMessage":"Unpaid HANDS fees must be settled before you can participate in marketplace bookings."',
    'Marketplace requests stay visible for review, but participation is blocked',
    'Marketplace participation and payout release resume',
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !message.includes(marker));
  if (missingMarkers.length) {
    throw new Error(
      `Negative wallet ${label} response is missing settlement guidance markers: ${JSON.stringify({
        missingMarkers,
        message,
      })}`,
    );
  }
}

async function approvePartnerBookingReadiness(providerAuth, adminAccessToken, label) {
  const providerProfileId = providerAuth.user.providerProfile.id;
  await postJson(`/admin/partners/${providerProfileId}/approve`, adminAccessToken);

  let onboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
  if (onboarding.kyc?.status !== 'APPROVED') {
    const requiredDocumentTypes = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];
    const documentPayload = [];
    for (const type of requiredDocumentTypes) {
      const existing = onboarding.documents?.find(
        (document) => document.type === type && document.status !== 'REJECTED',
      );
      if (!existing) {
        const upload = await postJson('/files/presign', providerAuth.accessToken, {
          contentType: 'image/jpeg',
          visibility: 'PRIVATE',
          purpose: `${label}-kyc-${type.toLowerCase()}`,
        });
        await postJson(`/files/${upload.file.id}/complete`, providerAuth.accessToken, {
          sizeBytes: 1024,
        });
        documentPayload.push({ fileId: upload.file.id, type });
      }
    }

    await postJson('/provider/onboarding/kyc/submit', providerAuth.accessToken, {
      cccdNumber: '000000000000',
      documents: documentPayload,
    });
    onboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
    for (const type of requiredDocumentTypes) {
      const document = onboarding.documents?.find((item) => item.type === type && item.status !== 'APPROVED');
      if (document) {
        await postJson(`/admin/partner-documents/${document.id}/approve`, adminAccessToken);
      }
    }
    await postJson(`/admin/partners/${providerProfileId}/kyc/approve`, adminAccessToken);
  }

  onboarding = await getJson('/provider/onboarding', providerAuth.accessToken);
  if (!onboarding.bankAccounts?.some((account) => account.status === 'APPROVED')) {
    const bankAccount = await postJson('/provider/onboarding/bank-accounts', providerAuth.accessToken, {
      bankName: 'Vietcombank',
      accountNumber: '000012345678',
      accountHolderName: `${label} Partner`,
    });
    await postJson(`/admin/partner-bank-accounts/${bankAccount.bankAccount.id}/approve`, adminAccessToken);
  }

  const ready = await getJson('/provider/onboarding', providerAuth.accessToken);
  if (
    ready.kyc?.status !== 'APPROVED' ||
    !ready.bankAccounts?.some((account) => account.status === 'APPROVED')
  ) {
    throw new Error(`${label} partner booking readiness setup failed: ${JSON.stringify(ready)}`);
  }
  return ready;
}

function firstBookingServiceLine(booking) {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return services.length > 0 && services[0] && typeof services[0] === 'object' ? services[0] : null;
}

function assertBookingPricing(label, booking, expected) {
  const serviceLine = firstBookingServiceLine(booking);
  const payment = booking?.payment;
  if (!serviceLine || serviceLine.price !== expected.customerPrice) {
    throw new Error(
      `${label} booking service price mismatch: ${JSON.stringify({
        expected,
        serviceLine,
        bookingId: booking?.id,
      })}`,
    );
  }
  if (payment?.amount !== expected.paymentAmount) {
    throw new Error(
      `${label} payment amount mismatch: ${JSON.stringify({
        expected,
        payment,
        bookingId: booking?.id,
      })}`,
    );
  }
}

function assertBookingMatchingWindow(label, booking, expectedMinutes) {
  const expiresAtMs = Date.parse(booking?.expiresAt ?? '');
  const openedAtMs = Date.parse(booking?.openedAt ?? booking?.createdAt ?? '');
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(openedAtMs)) {
    throw new Error(`${label} matching window is missing timestamps: ${JSON.stringify(booking)}`);
  }
  const windowMinutes = Math.round((expiresAtMs - openedAtMs) / 60_000);
  if (windowMinutes !== expectedMinutes) {
    throw new Error(
      `${label} matching window mismatch: ${JSON.stringify({
        expectedMinutes,
        windowMinutes,
        openedAt: booking.openedAt,
        expiresAt: booking.expiresAt,
      })}`,
    );
  }
  if (booking.earlyAcceptMin !== expectedMinutes) {
    throw new Error(
      `${label} earlyAcceptMin should match the provider response window: ${JSON.stringify(booking)}`,
    );
  }
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

await assertOperationalPolicyMetadata(adminAuth.accessToken);

const customerAppSession = await postJson('/app/session', customerAuth.accessToken, {
  role: 'CUSTOMER',
  deviceId: `smoke-customer-app-${Date.now()}`,
  platform: 'android',
  appVersion: 'smoke-test',
});
const providerAppSession = await postJson('/app/session', providerAuth.accessToken, {
  role: 'PROVIDER',
  deviceId: `smoke-provider-app-${Date.now()}`,
  platform: 'android',
  appVersion: 'smoke-test',
});
if (customerAppSession.role !== 'CUSTOMER' || providerAppSession.role !== 'PROVIDER') {
  throw new Error(
    `App session heartbeat did not persist roles correctly: ${JSON.stringify({
      customerAppSession,
      providerAppSession,
    })}`,
  );
}

const pushRegistrationStartedAt = Date.now() - 5_000;

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
await postJson(`/admin/partner-devices/${providerDeviceSession.device.id}/block`, adminAuth.accessToken, {
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
await postJson(`/admin/partner-devices/${providerDeviceSession.device.id}/unblock`, adminAuth.accessToken);
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
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/block`, adminAuth.accessToken, {
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
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/unblock`, adminAuth.accessToken);
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
const sharedProviderDeviceSession = await postJson(
  '/provider/device-session',
  backupProviderAuth.accessToken,
  {
    deviceId: providerSmokeDeviceId,
    platform: 'android',
    appVersion: 'smoke-test',
  },
);
if (
  sharedProviderDeviceSession.blocked !== false ||
  sharedProviderDeviceSession.ok !== true ||
  sharedProviderDeviceSession.sharedDeviceProfileCount < 1 ||
  sharedProviderDeviceSession.session?.suspicious !== true ||
  !String(sharedProviderDeviceSession.session?.suspiciousReason ?? '').includes('already linked')
) {
  throw new Error(
    `Shared partner device should create a session check without blocking app access: ${JSON.stringify(
      sharedProviderDeviceSession,
    )}`,
  );
}

const partnerControlReport = await postJson('/admin/partner-reports', adminAuth.accessToken, {
  providerProfileId: providerAuth.user.providerProfile.id,
  category: 'smoke-partner-report',
  summary: 'Smoke partner control report',
  details: 'Created by the smoke test to verify partner report operations.',
  severity: 'HIGH',
  source: 'ADMIN',
});
if (partnerControlReport.status !== 'OPEN' || partnerControlReport.severity !== 'HIGH') {
  throw new Error(`Partner report was not created correctly: ${JSON.stringify(partnerControlReport)}`);
}
const partnerControlSanction = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sanctions`,
  adminAuth.accessToken,
  {
    reportId: partnerControlReport.id,
    type: 'WARNING',
    reason: 'Smoke warning sanction for partner control flow',
  },
);
if (partnerControlSanction.status !== 'ACTIVE' || partnerControlSanction.type !== 'WARNING') {
  throw new Error(`Partner sanction was not created correctly: ${JSON.stringify(partnerControlSanction)}`);
}
const liftedPartnerControlSanction = await postJson(
  `/admin/partner-sanctions/${partnerControlSanction.id}/lift`,
  adminAuth.accessToken,
);
if (liftedPartnerControlSanction.status !== 'LIFTED') {
  throw new Error(
    `Partner sanction was not lifted correctly: ${JSON.stringify(liftedPartnerControlSanction)}`,
  );
}
const resolvedPartnerControlReport = await patchJson(
  `/admin/partner-reports/${partnerControlReport.id}`,
  adminAuth.accessToken,
  {
    status: 'RESOLVED',
    severity: 'MEDIUM',
    resolutionNote: 'Smoke partner report resolved',
  },
);
if (
  resolvedPartnerControlReport.status !== 'RESOLVED' ||
  resolvedPartnerControlReport.severity !== 'MEDIUM'
) {
  throw new Error(
    `Partner report was not updated correctly: ${JSON.stringify(resolvedPartnerControlReport)}`,
  );
}
const partnerControlReports = await getJson('/admin/partner-reports', adminAuth.accessToken);
if (!partnerControlReports.some((report) => report.id === resolvedPartnerControlReport.id)) {
  throw new Error(
    `Partner report endpoint did not expose the resolved report: ${JSON.stringify({
      resolvedPartnerControlReport,
      partnerControlReports: partnerControlReports.slice(0, 5),
    })}`,
  );
}
const partnerControlSanctions = await getJson('/admin/partner-sanctions', adminAuth.accessToken);
if (!partnerControlSanctions.some((sanction) => sanction.id === liftedPartnerControlSanction.id)) {
  throw new Error(
    `Partner sanction endpoint did not expose the lifted sanction: ${JSON.stringify({
      liftedPartnerControlSanction,
      partnerControlSanctions: partnerControlSanctions.slice(0, 5),
    })}`,
  );
}

const services = await request('/services');
const service = services[0];
if (!service?.id || !Array.isArray(service.payoutRules) || service.priceStep !== 100000) {
  throw new Error(`Public services should expose payout-ready pricing metadata: ${JSON.stringify(service)}`);
}
const serviceGroups = await request('/services/groups');
const serviceGroup = serviceGroups.find((group) => group.options?.some((option) => option.id === service.id));
if (
  !serviceGroup ||
  !serviceGroup.key ||
  !serviceGroup.options?.some((option) => option.durationMin === service.durationMin)
) {
  throw new Error(`Public grouped service catalog is incomplete: ${JSON.stringify(serviceGroup)}`);
}
const adminServices = await getJson('/admin/services', adminAuth.accessToken);
const adminService = adminServices.find((item) => item.id === service.id);
if (
  !adminService ||
  !adminService.payoutRules?.some((rule) => rule.customerPrice === service.basePrice && rule.active)
) {
  throw new Error(`Admin service matrix is missing the base payout rule: ${JSON.stringify(adminService)}`);
}
const basePayoutRule = adminService.payoutRules.find(
  (rule) => rule.customerPrice === service.basePrice && rule.active,
);
if (!basePayoutRule) {
  throw new Error(`Base payout rule could not be selected: ${JSON.stringify(adminService)}`);
}
const adminServiceGroups = await getJson('/admin/services/groups', adminAuth.accessToken);
const adminServiceGroup = adminServiceGroups.find((group) =>
  group.options?.some((option) => option.id === service.id),
);
if (!adminServiceGroup || typeof adminServiceGroup.activeOptionCount !== 'number') {
  throw new Error(`Admin grouped service catalog is incomplete: ${JSON.stringify(adminServiceGroup)}`);
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
const bulkPayoutStartPrice = higherCustomerPrice + service.priceStep;
const bulkPayoutRules = await postJson(
  `/admin/services/${service.id}/payout-rules/bulk`,
  adminAuth.accessToken,
  {
    rules: [
      {
        customerPrice: bulkPayoutStartPrice,
        providerPayoutAmount: Math.max(0, bulkPayoutStartPrice - Math.round(bulkPayoutStartPrice * 0.2)),
        vatBps: 0,
        otherCostAmount: 0,
        active: true,
        notes: 'Smoke test bulk payout ladder row 1',
      },
      {
        customerPrice: bulkPayoutStartPrice + service.priceStep,
        providerPayoutAmount: Math.max(
          0,
          bulkPayoutStartPrice +
            service.priceStep -
            Math.round((bulkPayoutStartPrice + service.priceStep) * 0.2),
        ),
        vatBps: 0,
        otherCostAmount: 0,
        active: true,
        notes: 'Smoke test bulk payout ladder row 2',
      },
    ],
  },
);
if (!Array.isArray(bulkPayoutRules) || bulkPayoutRules.length !== 2) {
  throw new Error(`Bulk payout ladder was not created correctly: ${JSON.stringify(bulkPayoutRules)}`);
}
await expectRequestFailure(
  'Admin bulk payout duplicate customer prices are rejected atomically',
  () =>
    postJson(`/admin/services/${service.id}/payout-rules/bulk`, adminAuth.accessToken, {
      rules: [
        {
          customerPrice: bulkPayoutStartPrice + service.priceStep * 2,
          providerPayoutAmount: 100000,
        },
        {
          customerPrice: bulkPayoutStartPrice + service.priceStep * 2,
          providerPayoutAmount: 100000,
        },
      ],
    }),
  400,
);
const smokeDurationSetKey = `smoke_duration_set_${Date.now()}`;
const smokeDurationSet = await postJson('/admin/services/duration-sets', adminAuth.accessToken, {
  serviceGroupKey: smokeDurationSetKey,
  name: 'Smoke Duration Set',
  description: 'Atomic smoke-created 60/90/120 service set.',
  priceStep: 100000,
  displayOrder: 999,
  vatBps: 0,
  otherCostAmount: 0,
  active: true,
  durations: [
    { durationMin: 60, basePrice: 500000, providerPayoutAmount: 380000 },
    { durationMin: 90, basePrice: 700000, providerPayoutAmount: 540000 },
    { durationMin: 120, basePrice: 900000, providerPayoutAmount: 700000 },
  ],
});
if (
  !Array.isArray(smokeDurationSet) ||
  smokeDurationSet.length !== 3 ||
  !smokeDurationSet.every((item) => item.serviceGroupKey === smokeDurationSetKey) ||
  !smokeDurationSet.every((item) => item.payoutRules?.some((rule) => rule.customerPrice === item.basePrice))
) {
  throw new Error(
    `Atomic service duration set was not created correctly: ${JSON.stringify(smokeDurationSet)}`,
  );
}
const vietnameseServiceSuffix = Date.now();
const vietnameseServiceName = `Mát xa đá chân ${vietnameseServiceSuffix}`;
const vietnameseServiceKey = `mat_xa_da_chan_${vietnameseServiceSuffix}`;
const vietnameseDurationSet = await postJson('/admin/services/duration-sets', adminAuth.accessToken, {
  name: vietnameseServiceName,
  description: 'Smoke test Vietnamese service-name slug generation.',
  priceStep: 100000,
  displayOrder: 999,
  vatBps: 0,
  otherCostAmount: 0,
  active: true,
  durations: [{ durationMin: 60, basePrice: 600000, providerPayoutAmount: 460000 }],
});
if (
  !Array.isArray(vietnameseDurationSet) ||
  vietnameseDurationSet.length !== 1 ||
  vietnameseDurationSet[0].serviceGroupKey !== vietnameseServiceKey
) {
  throw new Error(
    `Vietnamese service names should generate stable group keys: ${JSON.stringify(vietnameseDurationSet)}`,
  );
}
await expectRequestFailure(
  'Admin duplicate service duration set is rejected atomically',
  () =>
    postJson('/admin/services/duration-sets', adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: 'Smoke Duration Set',
      priceStep: 100000,
      durations: [{ durationMin: 60, basePrice: 500000, providerPayoutAmount: 380000 }],
    }),
  400,
);
await expectRequestFailure(
  'Admin duplicate single service duration option is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: 'Smoke Duration Set',
      description: 'Duplicate 60 minute option should be rejected.',
      durationMin: 60,
      basePrice: 500000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin service update cannot collide with another duration option',
  () =>
    patchJson(`/admin/services/${smokeDurationSet[1].id}`, adminAuth.accessToken, {
      serviceGroupKey: smokeDurationSetKey,
      name: 'Smoke Duration Set',
      description: 'Updating 90 min into the existing 60 min slot should be rejected.',
      durationMin: 60,
      basePrice: 700000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
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
await expectRequestFailure(
  'Admin service base price outside configured step is rejected',
  () =>
    postJson('/admin/services', adminAuth.accessToken, {
      serviceGroupKey: `smoke_invalid_base_price_${Date.now()}`,
      name: 'Smoke Invalid Base Price',
      description: 'Service intentionally using a base price outside the 100,000 VND step.',
      durationMin: 60,
      basePrice: 150000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Admin payout rule outside service price step is rejected',
  () =>
    postJson(`/admin/services/${service.id}/payout-rules`, adminAuth.accessToken, {
      customerPrice: service.basePrice + Math.round(service.priceStep / 2),
      providerPayoutAmount: service.basePrice,
      vatBps: 0,
      otherCostAmount: 0,
      active: true,
      notes: 'Smoke test invalid payout price step',
    }),
  400,
);
await expectRequestFailure(
  'Admin payout above customer price is rejected',
  () =>
    postJson(`/admin/services/${service.id}/payout-rules`, adminAuth.accessToken, {
      customerPrice: higherCustomerPrice,
      providerPayoutAmount: higherCustomerPrice + service.priceStep,
      vatBps: 0,
      otherCostAmount: 0,
      active: true,
      notes: 'Smoke test invalid provider payout',
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
const providerServiceGroups = await getJson('/provider/services/groups', providerAuth.accessToken);
const providerServiceGroup = providerServiceGroups.find((group) =>
  group.options?.some((option) => option.id === service.id),
);
if (
  !providerServiceGroup ||
  !providerServiceGroup.options?.some((option) => option.effectivePrice >= service.basePrice)
) {
  throw new Error(
    `Provider grouped service pricing list is incomplete: ${JSON.stringify(providerServiceGroup)}`,
  );
}
const partnerAliasServiceGroups = await getJson('/partner/services/groups', providerAuth.accessToken);
if (!partnerAliasServiceGroups.some((group) => group.options?.some((option) => option.id === service.id))) {
  throw new Error(`Partner alias service groups did not return the expected service.`);
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
await expectRequestFailure(
  'Provider price outside the admin price step is rejected',
  () =>
    patchJson(`/provider/services/${service.id}`, providerAuth.accessToken, {
      price: service.basePrice + Math.round(service.priceStep / 2),
      active: true,
    }),
  400,
);
await expectRequestFailure(
  'Provider cannot activate a service price without an exact admin payout rule',
  () =>
    patchJson(`/provider/services/${serviceWithoutPayoutRule.id}`, providerAuth.accessToken, {
      price: serviceWithoutPayoutRule.basePrice,
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
const adminServiceAfterProviderPriceUpdate = (await getJson('/admin/services', adminAuth.accessToken)).find(
  (item) => item.id === service.id,
);
if (
  !adminServiceAfterProviderPriceUpdate?.providers?.some(
    (item) =>
      item.providerProfileId === providerAuth.user.providerProfile.id &&
      item.price === higherCustomerPrice &&
      item.active,
  )
) {
  throw new Error(
    `Admin service impact data is missing provider price rows: ${JSON.stringify(adminServiceAfterProviderPriceUpdate)}`,
  );
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
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/approve`, adminAuth.accessToken);
const providerSupabaseRoleSync = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sync-supabase-role`,
  adminAuth.accessToken,
);
if (!['SKIPPED', 'SYNCED'].includes(providerSupabaseRoleSync.status)) {
  throw new Error(
    `Unexpected provider Supabase role sync result: ${JSON.stringify(providerSupabaseRoleSync)}`,
  );
}
await postJson(
  `/admin/partners/${backupProviderAuth.user.providerProfile.id}/approve`,
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
  legalName: 'Smoke Partner',
  dateOfBirth: '1995-01-01',
  displayName: 'Smoke Partner',
  bio: 'Partner onboarding smoke profile.',
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
      `/admin/partners/${kycNegativeProviderAuth.user.providerProfile.id}/kyc/approve`,
      adminAuth.accessToken,
    ),
  400,
);
await postJson(
  `/admin/partners/${kycNegativeProviderAuth.user.providerProfile.id}/approve`,
  adminAuth.accessToken,
);
await postJson('/provider/online', kycNegativeProviderAuth.accessToken);
await postJson('/provider/location', kycNegativeProviderAuth.accessToken, {
  lat: 10.7772,
  lng: 106.7011,
});
const unapprovedKycBookingGateError = await expectRequestFailure(
  'Partner without approved KYC cannot receive direct booking',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      providerId: kycNegativeProviderAuth.user.providerProfile.id,
      scheduledStartAt: new Date(Date.now() + 50 * 60_000).toISOString(),
      address: { line1: 'KYC booking gate smoke flow' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
if (!unapprovedKycBookingGateError.includes('Partner KYC must be approved')) {
  throw new Error(`KYC booking gate returned the wrong message: ${unapprovedKycBookingGateError}`);
}
const pendingKycOnboarding = await getJson('/provider/onboarding', kycNegativeProviderAuth.accessToken);
for (const type of ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE']) {
  const document = pendingKycOnboarding.documents.find(
    (item) => item.type === type && item.status !== 'APPROVED',
  );
  if (document) {
    await postJson(`/admin/partner-documents/${document.id}/approve`, adminAuth.accessToken);
  }
}
await postJson(
  `/admin/partners/${kycNegativeProviderAuth.user.providerProfile.id}/kyc/approve`,
  adminAuth.accessToken,
);
const missingBankBookingGateError = await expectRequestFailure(
  'Partner without approved bank account cannot receive direct booking',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      providerId: kycNegativeProviderAuth.user.providerProfile.id,
      scheduledStartAt: new Date(Date.now() + 55 * 60_000).toISOString(),
      address: { line1: 'Bank booking gate smoke flow' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
if (!missingBankBookingGateError.includes('Partner bank account must be approved')) {
  throw new Error(`Bank booking gate returned the wrong message: ${missingBankBookingGateError}`);
}
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
    await postJson(`/admin/partner-documents/${document.id}/approve`, adminAuth.accessToken);
  }
}
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/kyc/approve`, adminAuth.accessToken);
const onboardingBankAccount = await postJson('/provider/onboarding/bank-accounts', providerAuth.accessToken, {
  bankName: 'Vietcombank',
  accountNumber: '000012345678',
  accountHolderName: 'Smoke Partner',
});
await postJson(
  `/admin/partner-bank-accounts/${onboardingBankAccount.bankAccount.id}/approve`,
  adminAuth.accessToken,
);
await postJson('/provider/onboarding/tax-profile', providerAuth.accessToken, {
  taxCode: '0000000000',
  legalName: 'Smoke Partner',
  registeredAddress: 'District 1, Ho Chi Minh City, Vietnam',
});
await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/tax-profile/approve`,
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
await approvePartnerBookingReadiness(backupProviderAuth, adminAuth.accessToken, 'backup');
await approvePartnerBookingReadiness(walletDebtProviderAuth, adminAuth.accessToken, 'wallet-debt');
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
await expectRequestFailure(
  'Duplicate active default tax rule is rejected',
  () =>
    postJson(`/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`, adminAuth.accessToken, {
      scope: 'DEFAULT',
      rateBps: 600,
      fixedAmount: 0,
      active: true,
    }),
  400,
);
const smokeAmountBandTaxRule = await postJson(
  `/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`,
  adminAuth.accessToken,
  {
    scope: 'AMOUNT_BAND',
    minGrossAmount: 0,
    maxGrossAmount: 500000,
    rateBps: 500,
    fixedAmount: 0,
    active: true,
  },
);
if (smokeAmountBandTaxRule.scope !== 'AMOUNT_BAND') {
  throw new Error(`Amount-band tax rule was not created: ${JSON.stringify(smokeAmountBandTaxRule)}`);
}
await expectRequestFailure(
  'Overlapping amount-band tax rule is rejected',
  () =>
    postJson(`/admin/tax-policy-versions/${smokeTaxPolicy.id}/rules`, adminAuth.accessToken, {
      scope: 'AMOUNT_BAND',
      minGrossAmount: 400000,
      maxGrossAmount: 600000,
      rateBps: 500,
      fixedAmount: 0,
      active: true,
    }),
  400,
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

await postJson('/provider/location', walletDebtProviderAuth.accessToken, {
  lat: 10.7801,
  lng: 106.6992,
});

const partnerAliasInitialMe = await getJson('/partner/me', backupProviderAuth.accessToken);
if (partnerAliasInitialMe.providerProfile?.id !== backupProviderAuth.user.providerProfile.id) {
  throw new Error(
    `Partner alias /partner/me did not return the expected profile: ${JSON.stringify(partnerAliasInitialMe)}`,
  );
}
const partnerAliasInitialServices = await getJson('/partner/services/groups', backupProviderAuth.accessToken);
if (!Array.isArray(partnerAliasInitialServices) || partnerAliasInitialServices.length === 0) {
  throw new Error(`Partner alias /partner/services/groups did not return service groups.`);
}
const partnerAliasLocation = await postJson('/partner/location', backupProviderAuth.accessToken, {
  lat: 10.7825,
  lng: 106.6951,
});
if (partnerAliasLocation.currentLat === null || partnerAliasLocation.currentLng === null) {
  throw new Error(
    `Partner alias /partner/location did not persist location: ${JSON.stringify(partnerAliasLocation)}`,
  );
}

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
const nearbyPartners = await getJson(
  '/customer/partners/nearby?lat=10.7769&lng=106.7009',
  customerAuth.accessToken,
);
const noCoordinateBrowseProviders = await getJson('/customer/partners/nearby', customerAuth.accessToken);
const nearbyProvider = nearbyProviders.find((item) => item.id === providerAuth.user.providerProfile.id);
if (!nearbyProvider?.currentLocationUpdatedAt || nearbyProvider.isRecentLocation !== true) {
  throw new Error(`Nearby provider payload is missing freshness metadata: ${JSON.stringify(nearbyProvider)}`);
}
if (!nearbyPartners.some((item) => item.id === providerAuth.user.providerProfile.id)) {
  throw new Error(`Customer partner alias nearby search did not include the expected partner.`);
}
if (!noCoordinateBrowseProviders.some((item) => item.id === providerAuth.user.providerProfile.id)) {
  throw new Error(`Customer partner browse without GPS coordinates should use the default browse origin.`);
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
const customerPartnerDetail = await getJson(
  `/customer/partners/${providerAuth.user.providerProfile.id}`,
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
if (customerPartnerDetail.id !== customerProviderDetail.id) {
  throw new Error(`Customer partner alias detail returned a different partner.`);
}

const globalBrowseProviders = await getJson(
  '/customer/providers/nearby?lat=37.5665&lng=126.9780',
  customerAuth.accessToken,
);
const globalBrowseProvider = globalBrowseProviders.find(
  (item) => item.id === providerAuth.user.providerProfile.id,
);
if (
  !globalBrowseProvider ||
  typeof globalBrowseProvider.distanceMeters !== 'number' ||
  globalBrowseProvider.distanceMeters < 1_000_000
) {
  throw new Error(
    `Customer should be able to browse partners globally with long distance metadata: ${JSON.stringify(
      globalBrowseProvider,
    )}`,
  );
}

await expectRequestFailure(
  'Booking address text is required for immutable dispatch snapshot',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      address: {},
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    }),
  400,
);
await expectRequestFailure(
  'Booking dispatch pin must be inside Vietnam',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      address: { line1: 'Out of country smoke flow' },
      lat: 40.7128,
      lng: -74.006,
      paymentMethod: 'CASH',
    }),
  400,
);
const serviceAreaGateAuditLogs = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !serviceAreaGateAuditLogs.some(
    (log) =>
      log.action === 'booking.create.rejected' &&
      log.metadata?.reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
  )
) {
  throw new Error(
    `Service area gate rejection should create an operations audit log: ${JSON.stringify(
      serviceAreaGateAuditLogs.slice(0, 5),
    )}`,
  );
}
const noCurrentLocationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'CASH',
});
const noCurrentLocationBookingDetail = await getJson(
  `/customer/bookings/${noCurrentLocationBooking.id}`,
  customerAuth.accessToken,
);
if (
  noCurrentLocationBookingDetail.status !== 'OPEN_MATCHING' ||
  noCurrentLocationBookingDetail.addressSnapshot?.addressText !== 'District 1, Ho Chi Minh City'
) {
  throw new Error(
    `Booking should open from the confirmed service address without requiring customer GPS: ${JSON.stringify(
      noCurrentLocationBookingDetail,
    )}`,
  );
}
const staleCurrentLocationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'District 1, Ho Chi Minh City stale optional GPS' },
  lat: 10.7769,
  lng: 106.7009,
  currentLat: 10.7769,
  currentLng: 106.7009,
  currentLocationUpdatedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  paymentMethod: 'CASH',
});
const staleCurrentLocationBookingDetail = await getJson(
  `/customer/bookings/${staleCurrentLocationBooking.id}`,
  customerAuth.accessToken,
);
if (
  staleCurrentLocationBookingDetail.status !== 'OPEN_MATCHING' ||
  staleCurrentLocationBookingDetail.metadata?.customerCurrentLocation != null
) {
  throw new Error(
    `Stale customer GPS should be ignored as optional evidence, not block address-based booking: ${JSON.stringify(
      staleCurrentLocationBookingDetail,
    )}`,
  );
}
const farCurrentLocationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  address: { line1: 'Da Nang city center' },
  lat: 16.0471,
  lng: 108.2068,
  currentLat: 10.7769,
  currentLng: 106.7009,
  currentLocationUpdatedAt: new Date().toISOString(),
  paymentMethod: 'CASH',
});
const farCurrentLocationBookingDetail = await getJson(
  `/customer/bookings/${farCurrentLocationBooking.id}`,
  customerAuth.accessToken,
);
if (
  farCurrentLocationBookingDetail.status !== 'OPEN_MATCHING' ||
  farCurrentLocationBookingDetail.addressSnapshot?.addressText !== 'Da Nang city center'
) {
  throw new Error(
    `Customer GPS distance should not block booking when the Vietnam service address is confirmed: ${JSON.stringify(
      farCurrentLocationBookingDetail,
    )}`,
  );
}
await postJson('/provider/location', providerAuth.accessToken, {
  lat: 16.0471,
  lng: 108.2068,
});
await expectRequestFailure(
  'Booking rejects preferred partners too far from the booking address',
  () =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      providerId: providerAuth.user.providerProfile.id,
      address: { line1: 'District 1, Ho Chi Minh City' },
      lat: 10.7769,
      lng: 106.7009,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      paymentMethod: 'CASH',
    }),
  400,
);
await postJson('/provider/location', providerAuth.accessToken, {
  lat: 10.7769,
  lng: 106.7009,
});
const preferredPartnerDistanceGateAuditLogs = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !preferredPartnerDistanceGateAuditLogs.some(
    (log) =>
      log.action === 'booking.create.rejected' && log.metadata?.reasonCode === 'PREFERRED_PARTNER_TOO_FAR',
  )
) {
  throw new Error(
    `Preferred partner distance gate rejection should create an operations audit log: ${JSON.stringify(
      preferredPartnerDistanceGateAuditLogs.slice(0, 5),
    )}`,
  );
}

const selectedLocationOnlyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  selectedLocationId: savedSelectedLocation.id,
  currentLat: Number(savedSelectedLocation.latitude),
  currentLng: Number(savedSelectedLocation.longitude),
  currentLocationUpdatedAt: new Date().toISOString(),
  paymentMethod: 'CASH',
});
const selectedLocationOnlyBookingDetail = await getJson(
  `/customer/bookings/${selectedLocationOnlyBooking.id}`,
  customerAuth.accessToken,
);
if (
  selectedLocationOnlyBookingDetail.addressSnapshot?.selectedLocationId !== savedSelectedLocation.id ||
  selectedLocationOnlyBookingDetail.addressSnapshot?.addressText !== savedSelectedLocation.addressText ||
  Number(selectedLocationOnlyBookingDetail.addressSnapshot?.latitude) !==
    Number(savedSelectedLocation.latitude) ||
  Number(selectedLocationOnlyBookingDetail.addressSnapshot?.longitude) !==
    Number(savedSelectedLocation.longitude)
) {
  throw new Error(
    `Selected-location-only booking should create an immutable dispatch snapshot: ${JSON.stringify(
      selectedLocationOnlyBookingDetail.addressSnapshot,
    )}`,
  );
}

const ignoredFutureScheduledStartAt = new Date(Date.now() + 60 * 60_000).toISOString();
const booking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: ignoredFutureScheduledStartAt,
  address: { line1: 'District 1, Ho Chi Minh City' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const bookingDetail = await getJson(`/customer/bookings/${booking.id}`, customerAuth.accessToken);
if (
  bookingDetail.scheduledStartAt === ignoredFutureScheduledStartAt ||
  Date.parse(bookingDetail.scheduledStartAt) > Date.now() + 5 * 60_000
) {
  throw new Error(
    `Customer-supplied scheduledStartAt should not create scheduled booking: ${JSON.stringify({
      input: ignoredFutureScheduledStartAt,
      persisted: bookingDetail.scheduledStartAt,
    })}`,
  );
}
assertBookingPricing('Open matching base-price', bookingDetail, {
  customerPrice: service.basePrice,
  paymentAmount: service.basePrice,
});
assertBookingMatchingWindow('Open matching base-price', bookingDetail, 10);
if (
  bookingDetail.addressSnapshot?.addressText !== 'District 1, Ho Chi Minh City' ||
  Number(bookingDetail.addressSnapshot?.latitude) !== 10.7769 ||
  Number(bookingDetail.addressSnapshot?.longitude) !== 106.7009
) {
  throw new Error(
    `Customer booking detail should expose immutable address snapshot: ${JSON.stringify(
      bookingDetail.addressSnapshot,
    )}`,
  );
}
if (
  bookingDetail.metadata?.bookingGate?.gatePassed !== true ||
  bookingDetail.metadata?.bookingGate?.customerToBookingAddressDistanceMeters !== 0 ||
  bookingDetail.metadata?.bookingGate?.customerDistanceLimitMeters !== 20000
) {
  throw new Error(
    `Customer booking detail should expose the booking distance gate snapshot: ${JSON.stringify(
      bookingDetail.metadata?.bookingGate,
    )}`,
  );
}
const partnerAliasOpenBookings = await getJson('/partner/bookings/open', providerAuth.accessToken);
if (!partnerAliasOpenBookings.some((item) => item.id === booking.id)) {
  throw new Error(`Partner alias /partner/bookings/open did not include an open booking.`);
}
const preMatchChatRepairError = await expectRequestFailure(
  'Admin chat repair requires final partner selection',
  () => postJson(`/admin/bookings/${booking.id}/repair-chat-room`, adminAuth.accessToken),
  400,
);
if (!preMatchChatRepairError.includes('Final partner selection is required before repairing chat room')) {
  throw new Error(
    `Admin chat repair before matching returned an unexpected error: ${preMatchChatRepairError}`,
  );
}

const hybridBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 75 * 60_000).toISOString(),
  address: { line1: 'Hybrid fallback smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'CASH',
});
const hybridBookingDetail = await getJson(`/customer/bookings/${hybridBooking.id}`, customerAuth.accessToken);
assertBookingPricing('Direct provider custom-price', hybridBookingDetail, {
  customerPrice: higherCustomerPrice,
  paymentAmount: higherCustomerPrice,
});
assertBookingMatchingWindow('Direct provider custom-price', hybridBookingDetail, 10);
const hybridBackupNotifications = await getJson('/notifications', backupProviderAuth.accessToken);
const hybridBackupNotification = hybridBackupNotifications.find(
  (notification) =>
    notification.type === 'booking.backup_available' &&
    notification.data?.bookingId === hybridBooking.id &&
    notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
);
if (
  !hybridBackupNotification ||
  hybridBackupNotification.data?.backupProviderRadiusMeters !== 10000 ||
  typeof hybridBackupNotification.data?.distanceMeters !== 'number' ||
  hybridBackupNotification.data.distanceMeters > 10000
) {
  throw new Error(
    `Direct booking should notify eligible marketplace partners: ${JSON.stringify({
      hybridBackupNotification,
      hybridBackupNotifications,
    })}`,
  );
}
const marketplaceAcceptWithoutJoinError = await expectRequestFailure(
  'Marketplace partner accept requires participation',
  () => postJson(`/provider/bookings/${hybridBooking.id}/accept`, backupProviderAuth.accessToken),
  400,
);
if (
  !marketplaceAcceptWithoutJoinError.includes(
    'Partner must participate in this marketplace booking before responding',
  )
) {
  throw new Error(
    `Marketplace accept-before-participation returned an unexpected error: ${marketplaceAcceptWithoutJoinError}`,
  );
}
const hybridAdminBooking = await getJson(`/admin/bookings/${hybridBooking.id}`, adminAuth.accessToken);
if (
  hybridAdminBooking.addressSnapshot?.addressText !== 'Hybrid fallback smoke flow' ||
  Number(hybridAdminBooking.addressSnapshot?.latitude) !== 10.7783 ||
  Number(hybridAdminBooking.addressSnapshot?.longitude) !== 106.6994
) {
  throw new Error(
    `Admin booking detail should expose immutable address snapshot: ${JSON.stringify(
      hybridAdminBooking.addressSnapshot,
    )}`,
  );
}
const hybridBackupNotificationTraces = Array.isArray(hybridAdminBooking.metadata?.backupNotificationTraces)
  ? hybridAdminBooking.metadata.backupNotificationTraces
  : [];
const hybridInitialBackupTrace = hybridBackupNotificationTraces.find(
  (trace) =>
    trace.stage === 'initial_open' &&
    trace.backupProviderRadiusMeters === 10000 &&
    trace.providers?.some(
      (provider) => provider.providerProfileId === backupProviderAuth.user.providerProfile.id,
    ),
);
if (!hybridInitialBackupTrace || hybridInitialBackupTrace.notifiedCount < 1) {
  throw new Error(
    `Direct booking should persist backup notification trace metadata: ${JSON.stringify(
      hybridBackupNotificationTraces,
    )}`,
  );
}

let preferredAcceptPolicyBooking;
let preferredAcceptPolicyMatched;
const preferredAcceptModeBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.preferred_accept_mode',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.preferred_accept_mode',
  'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
);
try {
  preferredAcceptPolicyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: providerAuth.user.providerProfile.id,
    scheduledStartAt: new Date(Date.now() + 80 * 60_000).toISOString(),
    address: { line1: 'Preferred accept policy smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  const unsupportedPreferredAcceptModeError = await expectRequestFailure(
    'Unsupported first-pick auto-match policy option',
    () =>
      patchOperationalPolicyValue(
        adminAuth.accessToken,
        'matching.preferred_accept_mode',
        'AUTO_MATCH_ON_ACCEPT',
      ),
    400,
  );
  if (!unsupportedPreferredAcceptModeError.includes('unsupported option')) {
    throw new Error(
      `Unsupported first-pick policy returned an unexpected error: ${unsupportedPreferredAcceptModeError}`,
    );
  }
  const preferredBeforeAcceptSelectionError = await expectRequestFailure(
    'Customer final selection rejects preferred partner before acceptance',
    () =>
      postJson(
        `/customer/bookings/${preferredAcceptPolicyBooking.id}/select-provider`,
        customerAuth.accessToken,
        { providerId: providerAuth.user.providerProfile.id },
      ),
    400,
  );
  if (!preferredBeforeAcceptSelectionError.includes('Partner must participate or accept before customer selection')) {
    throw new Error(
      `Preferred partner selection before acceptance returned an unexpected error: ${preferredBeforeAcceptSelectionError}`,
    );
  }
  const acceptedButWaiting = await postJson(
    `/provider/bookings/${preferredAcceptPolicyBooking.id}/accept`,
    providerAuth.accessToken,
  );
  if (acceptedButWaiting.status !== 'OPEN_MATCHING' || acceptedButWaiting.selectedProviderId !== null) {
    throw new Error(
      `Preferred accept customer-confirm policy should keep booking open: ${JSON.stringify(
        acceptedButWaiting,
      )}`,
    );
  }
  const preferredAcceptedParticipant = acceptedButWaiting.participants?.find(
    (participant) => participant.providerProfileId === providerAuth.user.providerProfile.id,
  );
  if (preferredAcceptedParticipant?.status !== 'ACCEPTED') {
    throw new Error(
      `Preferred accept customer-confirm policy should mark participant accepted: ${JSON.stringify(
        acceptedButWaiting,
      )}`,
    );
  }
  preferredAcceptPolicyMatched = await postJson(
    `/customer/bookings/${preferredAcceptPolicyBooking.id}/select-provider`,
    customerAuth.accessToken,
    { providerId: providerAuth.user.providerProfile.id },
  );
  if (preferredAcceptPolicyMatched.status !== 'MATCHED') {
    throw new Error(
      `Customer final confirmation did not match preferred accepted partner: ${JSON.stringify(
        preferredAcceptPolicyMatched,
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.preferred_accept_mode',
    preferredAcceptModeBeforeSmoke ?? 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
  );
}

const backupRadiusBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_partner_radius_meters',
);
await patchOperationalPolicyValue(adminAuth.accessToken, 'matching.marketplace_partner_radius_meters', 1000);
try {
  await postJson('/provider/location', backupProviderAuth.accessToken, {
    lat: 10.805,
    lng: 106.7009,
  });
  const narrowRadiusBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: providerAuth.user.providerProfile.id,
    scheduledStartAt: new Date(Date.now() + 82 * 60_000).toISOString(),
    address: { line1: 'Narrow marketplace radius smoke flow' },
    lat: 10.7769,
    lng: 106.7009,
    paymentMethod: 'CASH',
  });
  const narrowRadiusOpenBookings = await getJson('/provider/bookings/open', backupProviderAuth.accessToken);
  if (narrowRadiusOpenBookings.some((item) => item.id === narrowRadiusBooking.id)) {
    throw new Error(
      `Narrow marketplace radius should hide far marketplace participant request: ${JSON.stringify(
        narrowRadiusOpenBookings,
      )}`,
    );
  }
  const narrowRadiusJoinError = await expectRequestFailure(
    'Narrow marketplace radius partner participation',
    () => postJson(`/provider/bookings/${narrowRadiusBooking.id}/join`, backupProviderAuth.accessToken),
    400,
  );
  if (!narrowRadiusJoinError.includes('Only partners within 1km can participate in this booking')) {
    throw new Error(`Narrow marketplace radius returned an unexpected error: ${narrowRadiusJoinError}`);
  }
} finally {
  await postJson('/provider/location', backupProviderAuth.accessToken, {
    lat: 10.7825,
    lng: 106.6951,
  });
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_partner_radius_meters',
    backupRadiusBeforeSmoke ?? 10000,
  );
}

let delayedBackupBooking;
let backupDeclineNotificationObserved = false;
const backupOpenModeBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_open_mode',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'matching.marketplace_open_mode',
  'AFTER_FIRST_PICK_DELAY',
);
try {
  delayedBackupBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: providerAuth.user.providerProfile.id,
    scheduledStartAt: new Date(Date.now() + 85 * 60_000).toISOString(),
    address: { line1: 'Delayed marketplace visibility smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_open_mode',
    'IMMEDIATE_WITHIN_WINDOW',
  );
  const delayedBackupOpenBookings = await getJson('/provider/bookings/open', backupProviderAuth.accessToken);
  if (delayedBackupOpenBookings.some((item) => item.id === delayedBackupBooking.id)) {
    throw new Error(
      `Delayed marketplace booking snapshot should hide request from non-preferred partner even after live policy changes: ${JSON.stringify(
        delayedBackupOpenBookings,
      )}`,
    );
  }
  await expectRequestFailure(
    'Delayed marketplace partner participation',
    () => postJson(`/provider/bookings/${delayedBackupBooking.id}/join`, backupProviderAuth.accessToken),
    400,
  );
  await postJson(`/provider/bookings/${delayedBackupBooking.id}/reject`, providerAuth.accessToken);
  const delayedBackupOpenAfterDecline = await getJson(
    '/provider/bookings/open',
    backupProviderAuth.accessToken,
  );
  const declinedRequest = delayedBackupOpenAfterDecline.find((item) => item.id === delayedBackupBooking.id);
  if (!declinedRequest) {
    throw new Error(
      `First-pick decline should immediately expose delayed marketplace request: ${JSON.stringify(
        delayedBackupOpenAfterDecline,
      )}`,
    );
  }
  if (typeof declinedRequest.distanceMeters !== 'number' || declinedRequest.distanceMeters > 10000) {
    throw new Error(
      `Declined first-pick marketplace request should keep 10km distance metadata: ${JSON.stringify(
        declinedRequest,
      )}`,
    );
  }
  await postJson(`/provider/bookings/${delayedBackupBooking.id}/join`, backupProviderAuth.accessToken);
  await postJson(`/provider/bookings/${delayedBackupBooking.id}/reject`, backupProviderAuth.accessToken);
  const rejectedMarketplaceSelectionError = await expectRequestFailure(
    'Customer final selection rejects inactive marketplace participant',
    () =>
      postJson(
        `/customer/bookings/${delayedBackupBooking.id}/select-provider`,
        customerAuth.accessToken,
        { providerId: backupProviderAuth.user.providerProfile.id },
      ),
    400,
  );
  if (!rejectedMarketplaceSelectionError.includes('Partner must participate or accept before customer selection')) {
    throw new Error(
      `Rejected marketplace participant should not be selectable by customer: ${rejectedMarketplaceSelectionError}`,
    );
  }
  const delayedBackupCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
  backupDeclineNotificationObserved = delayedBackupCustomerNotifications.some(
    (notification) =>
      notification.type === 'provider.rejected' &&
      notification.data?.bookingId === delayedBackupBooking.id &&
      notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
  );
  if (!backupDeclineNotificationObserved) {
    throw new Error(
      `Marketplace partner decline should create a customer notification: ${JSON.stringify(
        delayedBackupCustomerNotifications,
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'matching.marketplace_open_mode',
    backupOpenModeBeforeSmoke ?? 'IMMEDIATE_WITHIN_WINDOW',
  );
}

let oneSignalPolicyNotification = null;
const partnerAlertChannelBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'notification.partner_alert_channel',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'notification.partner_alert_channel',
  'ONESIGNAL_FOR_ALL_BOOKINGS',
);
try {
  const oneSignalPolicyBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: providerAuth.user.providerProfile.id,
    scheduledStartAt: new Date(Date.now() + 88 * 60_000).toISOString(),
    address: { line1: 'Partner alert channel policy smoke flow' },
    lat: 10.7783,
    lng: 106.6994,
    paymentMethod: 'CASH',
  });
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(500);
    const adminNotifications = await getJson('/admin/notifications', adminAuth.accessToken);
    oneSignalPolicyNotification = adminNotifications.find(
      (item) =>
        item.type === 'booking.requested' &&
        item.data?.bookingId === oneSignalPolicyBooking.id &&
        (item.deliveries?.length ?? 0) > 0,
    );
    if (oneSignalPolicyNotification) {
      break;
    }
  }
  const deliveryProvider = oneSignalPolicyNotification?.deliveries?.[0]?.provider;
  if (deliveryProvider !== 'ONESIGNAL') {
    throw new Error(
      `Partner alert channel policy did not route direct booking push through OneSignal: ${JSON.stringify(
        oneSignalPolicyNotification,
      )}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'notification.partner_alert_channel',
    partnerAlertChannelBeforeSmoke ?? 'IN_APP_WITH_PUSH_LATER',
  );
}

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
if (
  cancelledMomoBooking.closedByRole !== 'CUSTOMER' ||
  cancelledMomoBooking.closedReason !== 'customer_cancelled' ||
  !cancelledMomoBooking.closedAt
) {
  throw new Error(
    `Cancelled booking did not record customer closure metadata: ${JSON.stringify(cancelledMomoBooking)}`,
  );
}
const cancelledPaymentBeforeSync = await getJson('/admin/payments', adminAuth.accessToken).then((payments) =>
  payments.find((item) => item.bookingId === cancellableMomoBooking.id),
);
if (!cancelledPaymentBeforeSync?.id) {
  throw new Error(
    `Admin payment list did not expose cancelled booking payment id: ${JSON.stringify({
      cancelledMomoBooking,
      cancelledPaymentBeforeSync,
    })}`,
  );
}
const cancelledPaymentSync = await postJson(
  `/admin/payments/${cancelledPaymentBeforeSync.id}/sync`,
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

let afterMatchCancellationBooking;
const cancellationAfterMatchBeforeSmoke = await getOperationalPolicyValue(
  adminAuth.accessToken,
  'cancellation.after_match_policy',
);
await patchOperationalPolicyValue(
  adminAuth.accessToken,
  'cancellation.after_match_policy',
  'ADMIN_FEE_REVIEW_AFTER_MATCH',
);
try {
  afterMatchCancellationBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    providerId: providerAuth.user.providerProfile.id,
    scheduledStartAt: new Date(Date.now() + 220 * 60_000).toISOString(),
    address: { line1: 'After match cancellation policy smoke flow' },
    lat: 10.7769,
    lng: 106.7009,
    paymentMethod: 'MOMO',
  });
  const acceptedAfterMatchCancellation = await postJson(
    `/provider/bookings/${afterMatchCancellationBooking.id}/accept`,
    providerAuth.accessToken,
  );
  const matchedAfterMatchCancellation =
    acceptedAfterMatchCancellation.status === 'MATCHED'
      ? acceptedAfterMatchCancellation
      : await postJson(
          `/customer/bookings/${afterMatchCancellationBooking.id}/select-provider`,
          customerAuth.accessToken,
          {
            providerId: providerAuth.user.providerProfile.id,
          },
        );
  if (matchedAfterMatchCancellation.status !== 'MATCHED') {
    throw new Error(
      `After-match cancellation smoke booking was not matched before cancel: ${JSON.stringify(
        matchedAfterMatchCancellation,
      )}`,
    );
  }
  const afterMatchCancellationError = await expectRequestFailure(
    'Matched booking customer direct cancel is blocked',
    () => postJson(`/customer/bookings/${afterMatchCancellationBooking.id}/cancel`, customerAuth.accessToken),
    400,
  );
  if (!afterMatchCancellationError.includes('Matched bookings cannot be cancelled directly')) {
    throw new Error(
      `Matched booking direct cancel should route to chat evidence and admin review: ${afterMatchCancellationError}`,
    );
  }
} finally {
  await patchOperationalPolicyValue(
    adminAuth.accessToken,
    'cancellation.after_match_policy',
    cancellationAfterMatchBeforeSmoke ?? 'ADMIN_REVIEW_FOR_MVP',
  );
}

const noShowBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 130 * 60_000).toISOString(),
  address: { line1: 'No-show operations smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const markedNoShowBooking = await postJson(
  `/admin/bookings/${noShowBooking.id}/no-show`,
  adminAuth.accessToken,
  {
    reason: 'Smoke test no-show',
  },
);
if (markedNoShowBooking.status !== 'NO_SHOW') {
  throw new Error(`Admin no-show action did not update status: ${JSON.stringify(markedNoShowBooking)}`);
}
if (
  markedNoShowBooking.closedByRole !== 'ADMIN' ||
  markedNoShowBooking.closedReason !== 'admin_no_show' ||
  !markedNoShowBooking.closedAt
) {
  throw new Error(
    `Admin no-show action did not record closure metadata: ${JSON.stringify(markedNoShowBooking)}`,
  );
}
const noShowCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
if (
  !noShowCustomerNotifications.some(
    (notification) =>
      notification.type === 'booking.no_show' && notification.data?.bookingId === noShowBooking.id,
  )
) {
  throw new Error(`No-show should notify the customer: ${JSON.stringify(noShowCustomerNotifications)}`);
}
const noShowPartnerNotifications = await getJson('/notifications', providerAuth.accessToken);
if (
  !noShowPartnerNotifications.some(
    (notification) =>
      notification.type === 'booking.no_show' && notification.data?.bookingId === noShowBooking.id,
  )
) {
  throw new Error(
    `No-show should notify the preferred partner: ${JSON.stringify(noShowPartnerNotifications)}`,
  );
}
const noShowCustomerCancelError = await expectRequestFailure(
  'No-show booking customer direct cancel is blocked',
  () => postJson(`/customer/bookings/${noShowBooking.id}/cancel`, customerAuth.accessToken),
  400,
);
if (!noShowCustomerCancelError.includes('Booking cannot be cancelled in its current state')) {
  throw new Error(`No-show booking direct cancel returned an unexpected error: ${noShowCustomerCancelError}`);
}

const manuallyExpiredBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 135 * 60_000).toISOString(),
  address: { line1: 'Manual expiry operations smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const expiredByAdminBooking = await postJson(
  `/admin/bookings/${manuallyExpiredBooking.id}/expire`,
  adminAuth.accessToken,
  {
    reason: 'Smoke test manual expiry',
  },
);
if (expiredByAdminBooking.status !== 'EXPIRED' || expiredByAdminBooking.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin expiry action did not expire booking and release payment: ${JSON.stringify(expiredByAdminBooking)}`,
  );
}
if (
  expiredByAdminBooking.closedByRole !== 'ADMIN' ||
  expiredByAdminBooking.closedReason !== 'admin_expired' ||
  !expiredByAdminBooking.closedNote?.includes('Smoke test manual expiry')
) {
  throw new Error(
    `Admin expiry action did not record closure metadata: ${JSON.stringify(expiredByAdminBooking)}`,
  );
}
const expiredCustomerCancelError = await expectRequestFailure(
  'Expired booking customer direct cancel is blocked',
  () => postJson(`/customer/bookings/${manuallyExpiredBooking.id}/cancel`, customerAuth.accessToken),
  400,
);
if (!expiredCustomerCancelError.includes('Booking cannot be cancelled in its current state')) {
  throw new Error(`Expired booking direct cancel returned an unexpected error: ${expiredCustomerCancelError}`);
}

await postJson(`/provider/bookings/${booking.id}/join`, providerAuth.accessToken);
await postJson(`/provider/bookings/${hybridBooking.id}/join`, backupProviderAuth.accessToken);
await postJson(`/provider/bookings/${hybridBooking.id}/accept`, backupProviderAuth.accessToken);
const hybridCustomerNotifications = await getJson('/notifications', customerAuth.accessToken);
const backupAcceptNotificationObserved = hybridCustomerNotifications.some(
  (notification) =>
    notification.type === 'provider.accepted' &&
    notification.data?.bookingId === hybridBooking.id &&
    notification.data?.providerProfileId === backupProviderAuth.user.providerProfile.id,
);
if (!backupAcceptNotificationObserved) {
  throw new Error(
    `Marketplace partner acceptance should create a customer notification: ${JSON.stringify(
      hybridCustomerNotifications,
    )}`,
  );
}

const hybridMatched = await postJson(
  `/customer/bookings/${hybridBooking.id}/select-provider`,
  customerAuth.accessToken,
  {
    providerId: backupProviderAuth.user.providerProfile.id,
  },
);

const walletDebtJoinedBeforeDebtBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 130 * 60_000).toISOString(),
  address: { line1: 'Negative wallet final selection smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'MOMO',
});
await postJson(
  `/provider/bookings/${walletDebtJoinedBeforeDebtBooking.id}/join`,
  walletDebtProviderAuth.accessToken,
);

const walletDebtServiceStartGateBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: walletDebtProviderAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 132 * 60_000).toISOString(),
  address: { line1: 'Negative wallet service start smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'MOMO',
});
const acceptedWalletDebtServiceStartGateBooking = await postJson(
  `/provider/bookings/${walletDebtServiceStartGateBooking.id}/accept`,
  walletDebtProviderAuth.accessToken,
);
if (acceptedWalletDebtServiceStartGateBooking.status !== 'MATCHED') {
  await postJson(
    `/customer/bookings/${walletDebtServiceStartGateBooking.id}/select-provider`,
    customerAuth.accessToken,
    {
      providerId: walletDebtProviderAuth.user.providerProfile.id,
    },
  );
}

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
const walletDebtProviderOpenBookings = await getJson(
  '/provider/bookings/open',
  walletDebtProviderAuth.accessToken,
);
const cashOpenBooking = walletDebtProviderOpenBookings.find(
  (item) => item.id === walletDebtBooking.id || item.id === blockedDirectBooking.id,
);
if (cashOpenBooking?.payment?.method !== 'CASH') {
  throw new Error(
    `Provider open bookings must include cash payment metadata: ${JSON.stringify(cashOpenBooking)}`,
  );
}
if (typeof cashOpenBooking.distanceMeters !== 'number' || cashOpenBooking.distanceMeters > 10000) {
  throw new Error(
    `Provider open bookings must expose only eligible 10km marketplace requests with distance metadata: ${JSON.stringify(
      cashOpenBooking,
    )}`,
  );
}
const acceptedWalletDebtBooking = await postJson(
  `/provider/bookings/${walletDebtBooking.id}/accept`,
  walletDebtProviderAuth.accessToken,
);
if (acceptedWalletDebtBooking.status !== 'MATCHED') {
  await postJson(`/customer/bookings/${walletDebtBooking.id}/select-provider`, customerAuth.accessToken, {
    providerId: walletDebtProviderAuth.user.providerProfile.id,
  });
}
await startAndCompleteBooking(walletDebtBooking.id, walletDebtProviderAuth.accessToken);
const walletDebtProviderNotifications = await getJson('/notifications', walletDebtProviderAuth.accessToken);
if (
  !walletDebtProviderNotifications.some(
    (notification) =>
      notification.type === 'provider.payout_setup_required' &&
      notification.data?.missing?.taxProfileApproved === true,
  )
) {
  throw new Error(
    `First provider earning should notify payout tax setup requirements: ${JSON.stringify(
      walletDebtProviderNotifications,
    )}`,
  );
}
const walletDebtProviderEarningsSummary = await getJson(
  '/provider/earnings/summary',
  walletDebtProviderAuth.accessToken,
);
if (
  walletDebtProviderEarningsSummary.walletBalance >= 0 ||
  walletDebtProviderEarningsSummary.walletBlocked !== true ||
  walletDebtProviderEarningsSummary.marketplaceVisibilityBlocked !== false ||
  walletDebtProviderEarningsSummary.marketplaceJoinBlocked !== true ||
  walletDebtProviderEarningsSummary.directFirstPickBlocked !== false ||
  walletDebtProviderEarningsSummary.alreadyMatchedServiceBlocked !== false ||
  walletDebtProviderEarningsSummary.payoutReleaseBlocked !== true ||
  walletDebtProviderEarningsSummary.walletDebtAmount <= 0 ||
  walletDebtProviderEarningsSummary.walletBlockCode !== 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT' ||
  walletDebtProviderEarningsSummary.walletSettlementRequired !== true ||
  walletDebtProviderEarningsSummary.walletSettlementMethod !== 'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET' ||
  !walletDebtProviderEarningsSummary.walletSettlementInstruction ||
  !walletDebtProviderEarningsSummary.walletBlockReason
) {
  throw new Error(
    `Cash booking did not create a negative provider wallet: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (!walletDebtProviderEarningsSummary.walletSettlementInstruction.includes('HANDS')) {
  throw new Error(
    `Negative wallet settlement instruction should explain HANDS repayment: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (
  !walletDebtProviderEarningsSummary.walletSettlementReference?.startsWith('HANDS-WALLET-') ||
  !Array.isArray(walletDebtProviderEarningsSummary.walletSettlementSteps) ||
  walletDebtProviderEarningsSummary.walletSettlementSteps.length < 3 ||
  !walletDebtProviderEarningsSummary.walletSettlementSteps.some((step) =>
    step.includes(walletDebtProviderEarningsSummary.walletSettlementReference),
  )
) {
  throw new Error(
    `Negative wallet summary should include deposit reference and operator steps: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
const expectedProviderWalletBlockReason =
  'Outstanding HANDS fee settlement must be completed before marketplace participation or payout release.';
if (walletDebtProviderEarningsSummary.walletBlockReason !== expectedProviderWalletBlockReason) {
  throw new Error(
    `Negative wallet block reason should be readable and operator-approved: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
if (
  walletDebtProviderEarningsSummary.walletBlockDisplayMessage !==
  'Unpaid HANDS fees must be settled before you can participate in marketplace bookings.'
) {
  throw new Error(
    `Negative wallet summary should include the partner-app marketplace block message: ${JSON.stringify(
      walletDebtProviderEarningsSummary,
    )}`,
  );
}
const directAcceptedWithDebt = await postJson(
  `/provider/bookings/${blockedDirectBooking.id}/accept`,
  walletDebtProviderAuth.accessToken,
);
if (!['OPEN_MATCHING', 'MATCHED'].includes(directAcceptedWithDebt.status)) {
  throw new Error(
    `Negative wallet should not block preferred direct request acceptance: ${JSON.stringify(directAcceptedWithDebt)}`,
  );
}
const negativeWalletMarketplaceAcceptError = await expectRequestFailure(
  'Negative provider wallet blocks marketplace participant acceptance after debt appears',
  () =>
    postJson(
      `/provider/bookings/${walletDebtJoinedBeforeDebtBooking.id}/accept`,
      walletDebtProviderAuth.accessToken,
    ),
  400,
);
assertNegativeWalletBlockResponse('marketplace acceptance after debt appears', negativeWalletMarketplaceAcceptError);
const negativeWalletMarketplaceSelectionError = await expectRequestFailure(
  'Negative provider wallet blocks customer final selection of marketplace participant',
  () =>
    postJson(`/customer/bookings/${walletDebtJoinedBeforeDebtBooking.id}/select-provider`, customerAuth.accessToken, {
      providerId: walletDebtProviderAuth.user.providerProfile.id,
    }),
  400,
);
assertNegativeWalletBlockResponse('marketplace final selection after debt appears', negativeWalletMarketplaceSelectionError);
const serviceStartedWithDebt = await postJson(
  `/provider/bookings/${walletDebtServiceStartGateBooking.id}/start`,
  walletDebtProviderAuth.accessToken,
);
if (serviceStartedWithDebt.status !== 'IN_SERVICE') {
  throw new Error(
    `Negative wallet should not block starting a booking that is already matched: ${JSON.stringify(
      serviceStartedWithDebt,
    )}`,
  );
}
const blockedOpenMatchingBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  scheduledStartAt: new Date(Date.now() + 165 * 60_000).toISOString(),
  address: { line1: 'Negative wallet open matching smoke flow' },
  lat: 10.7783,
  lng: 106.6994,
  paymentMethod: 'MOMO',
});
const negativeWalletVisibleMarketplaceBookings = await getJson(
  '/provider/bookings/open',
  walletDebtProviderAuth.accessToken,
);
const negativeWalletVisibleMarketplaceBooking = negativeWalletVisibleMarketplaceBookings.find(
  (item) => item.id === blockedOpenMatchingBooking.id,
);
if (
  !negativeWalletVisibleMarketplaceBooking ||
  typeof negativeWalletVisibleMarketplaceBooking.distanceMeters !== 'number' ||
  negativeWalletVisibleMarketplaceBooking.distanceMeters > 10000
) {
  throw new Error(
    `Negative wallet partner should still see marketplace request before settlement, but cannot participate: ${JSON.stringify(
      {
        expectedBookingId: blockedOpenMatchingBooking.id,
        visibleBooking: negativeWalletVisibleMarketplaceBooking,
        sample: negativeWalletVisibleMarketplaceBookings[0],
      },
    )}`,
  );
}
const negativeWalletMarketplaceJoinError = await expectRequestFailure(
  'Negative provider wallet blocks marketplace participation',
  () =>
    postJson(
      `/provider/bookings/${blockedOpenMatchingBooking.id}/join`,
      walletDebtProviderAuth.accessToken,
    ),
  400,
);
assertNegativeWalletBlockResponse('marketplace participation', negativeWalletMarketplaceJoinError);
const adminBookingAfterBlockedMarketplaceJoin = (
  await getJson('/admin/bookings', adminAuth.accessToken)
).find((booking) => booking.id === blockedOpenMatchingBooking.id);
const blockedMarketplaceParticipant =
  adminBookingAfterBlockedMarketplaceJoin?.participants?.find(
    (participant) =>
      participant.providerProfileId === walletDebtProviderAuth.user.providerProfile.id,
  );
if (blockedMarketplaceParticipant) {
  throw new Error(
    `Wallet-blocked marketplace attempt should not create a participant record: ${JSON.stringify(
      blockedMarketplaceParticipant,
    )}`,
  );
}
const payoutWalletBlockError = await expectRequestFailure(
  'Negative provider wallet holds payout batch creation',
  () =>
    postJson('/admin/payout-batches', adminAuth.accessToken, {
      providerProfileId: walletDebtProviderAuth.user.providerProfile.id,
      transferRef: `SMOKE-DEBT-HOLD-${Date.now()}`,
      notes: 'This should be blocked by cash fee debt',
    }),
  400,
);
for (const [label, message] of [['payout batch creation', payoutWalletBlockError]]) {
  assertNegativeWalletBlockResponse(label, message);
}
const adminEarningsAfterCashDebt = await getJson('/admin/earnings', adminAuth.accessToken);
const cashDebtEarning = adminEarningsAfterCashDebt.find(
  (earning) => earning.bookingId === walletDebtBooking.id && earning.netAmount < 0,
);
if (!cashDebtEarning) {
  throw new Error(
    `Cash debt earning was not visible to admin: ${JSON.stringify(adminEarningsAfterCashDebt[0])}`,
  );
}
const cashDebtBookingLedger = cashDebtEarning.walletLedgerEntries?.find(
  (entry) => entry.type === 'BOOKING_EARNING',
);
if (!cashDebtBookingLedger || cashDebtBookingLedger.amount !== cashDebtEarning.netAmount) {
  throw new Error(`Cash debt booking ledger was not recorded: ${JSON.stringify(cashDebtEarning)}`);
}
const adminCashSettlementEarnings = await getJson('/admin/cash-settlement-earnings', adminAuth.accessToken);
const cashSettlementDebtRow = adminCashSettlementEarnings.find(
  (earning) => earning.bookingId === walletDebtBooking.id && earning.netAmount < 0,
);
if (!cashSettlementDebtRow || cashSettlementDebtRow.payoutBatchId) {
  throw new Error(
    `Cash settlement queue did not expose the open wallet debt row: ${JSON.stringify(
      adminCashSettlementEarnings[0],
    )}`,
  );
}
const adminCashSettlementSummary = await getJson('/admin/cash-settlement-summary', adminAuth.accessToken);
if (
  adminCashSettlementSummary.rowCount < 1 ||
  adminCashSettlementSummary.providerCount < 1 ||
  adminCashSettlementSummary.totalDebtAmount < Math.abs(cashSettlementDebtRow.netAmount) ||
  adminCashSettlementSummary.cashPaymentRowCount < 1 ||
  !adminCashSettlementSummary.topProviderGroups?.some(
    (group) =>
      group.providerProfileId === walletDebtProviderAuth.user.providerProfile.id && group.debtAmount > 0,
  )
) {
  throw new Error(
    `Cash settlement summary did not expose open wallet debt totals: ${JSON.stringify(
      adminCashSettlementSummary,
    )}`,
  );
}
const adminPaymentsAfterCashDebt = await getJson('/admin/payments', adminAuth.accessToken);
const cashDebtPayment = adminPaymentsAfterCashDebt.find(
  (payment) => payment.bookingId === walletDebtBooking.id,
);
if (
  cashDebtPayment?.method !== 'CASH' ||
  cashDebtPayment?.booking?.earning?.id !== cashDebtEarning.id ||
  cashDebtPayment.booking.earning.netAmount >= 0 ||
  !cashDebtPayment.booking.earning.walletLedgerEntries?.some((entry) => entry.type === 'BOOKING_EARNING')
) {
  throw new Error(`Cash debt payment trace was not visible to admin: ${JSON.stringify(cashDebtPayment)}`);
}
const adminBookingsAfterCashDebt = await getJson('/admin/bookings', adminAuth.accessToken);
const cashDebtBookingInMonitor = adminBookingsAfterCashDebt.find(
  (booking) => booking.id === walletDebtBooking.id,
);
if (
  cashDebtBookingInMonitor?.earning?.id !== cashDebtEarning.id ||
  cashDebtBookingInMonitor.earning.netAmount >= 0 ||
  !cashDebtBookingInMonitor.earning.walletLedgerEntries?.some((entry) => entry.type === 'BOOKING_EARNING')
) {
  throw new Error(
    `Cash debt booking trace was not visible to booking monitor: ${JSON.stringify(cashDebtBookingInMonitor)}`,
  );
}
await expectRequestFailure(
  'Negative cash fee settlement requires a reference',
  () => postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {}),
  400,
);
await expectRequestFailure(
  'Negative cash fee settlement requires a method',
  () =>
    postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {
      settlementRef: `SMOKE-MISSING-METHOD-${Date.now()}`,
    }),
  400,
);
const cashDebtSettlementRef = `SMOKE-CASH-FEE-${Date.now()}`;
await postJson(`/admin/earnings/${cashDebtEarning.id}/mark-paid`, adminAuth.accessToken, {
  settlementRef: cashDebtSettlementRef,
  settlementNotes: 'Smoke test cash fee deposit reference',
  settlementMethod: 'PARTNER_DEPOSIT',
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
if (settledCashDebtEarning?.settlementMethod !== 'PARTNER_DEPOSIT') {
  throw new Error(
    `Cash fee settlement method was not persisted: ${JSON.stringify(settledCashDebtEarning)}`,
  );
}
const cashDebtSettlementLedger = settledCashDebtEarning.walletLedgerEntries?.find(
  (entry) => entry.type === 'CASH_FEE_DEBT_SETTLED',
);
if (
  !cashDebtSettlementLedger ||
  cashDebtSettlementLedger.amount !== Math.abs(cashDebtEarning.netAmount) ||
  cashDebtSettlementLedger.reference !== cashDebtSettlementRef
) {
  throw new Error(`Cash fee settlement ledger was not recorded: ${JSON.stringify(settledCashDebtEarning)}`);
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
const partnerAliasMe = await getJson('/partner/me', providerAuth.accessToken);
const partnerAliasBookings = await getJson('/partner/bookings', providerAuth.accessToken);
const partnerAliasOnboarding = await getJson('/partner/onboarding', providerAuth.accessToken);
const chatRoomId = matched.booking.chatRoom.id;
const repairedMatchedChat = await postJson(
  `/admin/bookings/${booking.id}/repair-chat-room`,
  adminAuth.accessToken,
);
if (
  repairedMatchedChat?.id !== booking.id ||
  repairedMatchedChat?.chatRoom?.id !== chatRoomId ||
  repairedMatchedChat?.selectedProvider?.id !== providerAuth.user.providerProfile.id
) {
  throw new Error(
    `Admin chat repair should retain the matched chat room: ${JSON.stringify(repairedMatchedChat)}`,
  );
}
const repairedMatchedChatDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (!repairedMatchedChatDetail.auditLogs?.some((log) => log.action === 'booking.chat_room.repair')) {
  throw new Error(
    `Admin chat repair should leave an audit trail on booking detail: ${JSON.stringify(
      repairedMatchedChatDetail.auditLogs?.slice(0, 5),
    )}`,
  );
}

const partnerResponseAfterMatchError = await expectRequestFailure(
  'Partner response after matching is blocked',
  () => postJson(`/provider/bookings/${booking.id}/reject`, providerAuth.accessToken),
  400,
);
if (!partnerResponseAfterMatchError.includes('Booking is not open for partner responses')) {
  throw new Error(
    `Partner response after matching returned an unexpected error: ${partnerResponseAfterMatchError}`,
  );
}

if (partnerAliasMe.id !== providerAuth.user.id) {
  throw new Error(`Partner alias /partner/me returned the wrong user: ${JSON.stringify(partnerAliasMe)}`);
}
if (!partnerAliasBookings.some((item) => item.id === booking.id)) {
  throw new Error(`Partner alias bookings did not include the matched booking.`);
}
if (partnerAliasOnboarding.providerProfileId !== providerAuth.user.providerProfile.id) {
  throw new Error(`Partner alias onboarding snapshot is incomplete.`);
}

const chatMessage = await postJson(`/chat/rooms/${chatRoomId}/messages`, customerAuth.accessToken, {
  body: 'Hello, see you soon.',
});

const completeBeforeStartError = await expectRequestFailure(
  'Partner cannot complete before service start',
  () => postJson(`/provider/bookings/${booking.id}/complete`, providerAuth.accessToken),
  400,
);
if (!completeBeforeStartError.includes('Invalid booking status transition from MATCHED')) {
  throw new Error(
    `Completing before service start returned an unexpected error: ${completeBeforeStartError}`,
  );
}

await startAndCompleteBooking(booking.id, providerAuth.accessToken);

const completedAdminChatDetail = await getJson(`/admin/bookings/${booking.id}`, adminAuth.accessToken);
if (
  completedAdminChatDetail?.status !== 'COMPLETED' ||
  completedAdminChatDetail?.chatRoom?.id !== chatRoomId ||
  !completedAdminChatDetail?.chatRoom?.messages?.some((message) => message.id === chatMessage.id)
) {
  throw new Error(
    `Completed booking did not retain admin chat archive: ${JSON.stringify(completedAdminChatDetail)}`,
  );
}

const completedChatArchive = await getJson('/admin/chat-archive', adminAuth.accessToken);
if (
  !completedChatArchive.some(
    (item) =>
      item.id === booking.id &&
      item.chatRoom?.id === chatRoomId &&
      item.chatRoom?.messages?.some((message) => message.id === chatMessage.id),
  )
) {
  throw new Error(
    `Admin chat archive did not retain completed booking messages: ${JSON.stringify(
      completedChatArchive.slice(0, 5),
    )}`,
  );
}

const review = await postJson('/customer/reviews', customerAuth.accessToken, {
  bookingId: booking.id,
  rating: 5,
  comment: 'Great service.',
});

const completedCloseout = await postJson(`/admin/bookings/${booking.id}/closeout`, adminAuth.accessToken, {
  note: 'Smoke test completed booking closeout',
});
if (
  completedCloseout.status !== 'COMPLETED' ||
  completedCloseout.payment?.status !== 'CAPTURED' ||
  !completedCloseout.earning?.id ||
  !completedCloseout.earning?.taxLogs?.length ||
  !completedCloseout.earning?.platformFeeLogs?.length ||
  !completedCloseout.earning?.walletLedgerEntries?.length
) {
  throw new Error(
    `Completed closeout did not reconcile finance records: ${JSON.stringify(completedCloseout)}`,
  );
}

const providerEarnings = await getJson('/provider/earnings', providerAuth.accessToken);
const providerEarningsSummary = await getJson('/provider/earnings/summary', providerAuth.accessToken);
const partnerAliasEarningsSummary = await getJson('/partner/earnings/summary', providerAuth.accessToken);
const completedEarning = providerEarnings.find((earning) => earning.bookingId === booking.id);
if (
  !completedEarning ||
  completedEarning.withholdingAmount <= 0 ||
  completedEarning.netAmount !==
    completedEarning.grossAmount - completedEarning.platformFee - completedEarning.withholdingAmount
) {
  throw new Error(`Completed earning did not apply withholding policy: ${JSON.stringify(completedEarning)}`);
}
if (providerEarningsSummary.withholdingAmount <= 0) {
  throw new Error(`Earnings summary did not include withholding: ${JSON.stringify(providerEarningsSummary)}`);
}
if (partnerAliasEarningsSummary.providerProfileId !== providerEarningsSummary.providerProfileId) {
  throw new Error(`Partner alias earnings summary returned a different profile.`);
}
const adminCompletedEarning = (await getJson('/admin/earnings', adminAuth.accessToken)).find(
  (earning) => earning.bookingId === booking.id,
);
const expectedBasePlatformFee = service.basePrice - basePayoutRule.providerPayoutAmount;
if (
  completedEarning.grossAmount !== service.basePrice ||
  completedEarning.platformFee !== expectedBasePlatformFee
) {
  throw new Error(
    `Completed earning did not use the service payout matrix amounts: ${JSON.stringify({
      completedEarning,
      serviceBasePrice: service.basePrice,
      basePayoutRule,
      expectedBasePlatformFee,
    })}`,
  );
}
if (
  !adminCompletedEarning?.platformFeeLogs?.length ||
  adminCompletedEarning.platformFeeLogs[0].platformFeeAmount !== completedEarning.platformFee
) {
  throw new Error(
    `Completed earning did not record platform fee policy log: ${JSON.stringify(adminCompletedEarning)}`,
  );
}
await expectRequestFailure(
  'Positive partner earnings must be paid through payout batches',
  () =>
    postJson(`/admin/earnings/${adminCompletedEarning.id}/mark-paid`, adminAuth.accessToken, {
      settlementRef: `DIRECT-PAYOUT-BLOCKED-${Date.now()}`,
      settlementMethod: 'PARTNER_DEPOSIT',
    }),
  400,
);
if (adminCompletedEarning.platformFeeLogs[0].ruleSnapshot?.source !== 'SERVICE_PAYOUT_RULE') {
  throw new Error(
    `Completed earning should prefer the service payout matrix: ${JSON.stringify(
      adminCompletedEarning.platformFeeLogs[0],
    )}`,
  );
}
const servicePayoutLog = adminCompletedEarning.platformFeeLogs[0];
const servicePayoutSnapshot = servicePayoutLog.ruleSnapshot ?? {};
const servicePayoutLines = Array.isArray(servicePayoutSnapshot.lines) ? servicePayoutSnapshot.lines : [];
const servicePayoutLine = servicePayoutLines.find(
  (line) => line.serviceId === service.id && line.customerPrice === service.basePrice,
);
const expectedBaseVatAmount = Math.round((expectedBasePlatformFee * basePayoutRule.vatBps) / 10_000);
const expectedBaseOtherCostAmount = basePayoutRule.otherCostAmount;
const expectedNetCompanyFeeBeforeWithholding =
  expectedBasePlatformFee - expectedBaseVatAmount - expectedBaseOtherCostAmount;
if (
  servicePayoutSnapshot.providerPayoutAmount !== basePayoutRule.providerPayoutAmount ||
  servicePayoutSnapshot.vatAmount !== expectedBaseVatAmount ||
  servicePayoutSnapshot.otherCostAmount !== expectedBaseOtherCostAmount ||
  servicePayoutSnapshot.netCompanyFeeBeforeWithholding !== expectedNetCompanyFeeBeforeWithholding
) {
  throw new Error(
    `Completed earning service payout snapshot does not match the admin pricing rule: ${JSON.stringify({
      servicePayoutLog,
      basePayoutRule,
      expectedBasePlatformFee,
      expectedBaseVatAmount,
      expectedBaseOtherCostAmount,
      expectedNetCompanyFeeBeforeWithholding,
    })}`,
  );
}
if (
  !servicePayoutLine ||
  servicePayoutLine.customerAmount !== service.basePrice ||
  servicePayoutLine.providerPayoutAmount !== basePayoutRule.providerPayoutAmount ||
  servicePayoutLine.platformFeeAmount !== expectedBasePlatformFee ||
  servicePayoutLine.vatAmount !== expectedBaseVatAmount ||
  servicePayoutLine.otherCostAmount !== expectedBaseOtherCostAmount ||
  servicePayoutLine.ruleId !== basePayoutRule.id
) {
  throw new Error(
    `Completed earning service payout line does not match the selected service option: ${JSON.stringify({
      servicePayoutLine,
      servicePayoutLines,
      service,
      basePayoutRule,
    })}`,
  );
}

const directCustomPriceBooking = await postJson('/customer/bookings', customerAuth.accessToken, {
  serviceId: service.id,
  providerId: providerAuth.user.providerProfile.id,
  scheduledStartAt: new Date(Date.now() + 75 * 60_000).toISOString(),
  address: { line1: 'Custom price payout smoke flow' },
  lat: 10.7769,
  lng: 106.7009,
  paymentMethod: 'MOMO',
});
const directCustomPriceBookingDetail = await getJson(
  `/customer/bookings/${directCustomPriceBooking.id}`,
  customerAuth.accessToken,
);
assertBookingPricing('Completed custom-price direct booking', directCustomPriceBookingDetail, {
  customerPrice: higherCustomerPrice,
  paymentAmount: higherCustomerPrice,
});
const acceptedDirectCustomPrice = await postJson(
  `/provider/bookings/${directCustomPriceBooking.id}/accept`,
  providerAuth.accessToken,
);
const matchedDirectCustomPrice =
  acceptedDirectCustomPrice.status === 'MATCHED'
    ? acceptedDirectCustomPrice
    : await postJson(
        `/customer/bookings/${directCustomPriceBooking.id}/select-provider`,
        customerAuth.accessToken,
        {
          providerId: providerAuth.user.providerProfile.id,
        },
      );
if (matchedDirectCustomPrice.status !== 'MATCHED') {
  throw new Error(
    `Custom-price direct booking did not match the selected partner: ${JSON.stringify(matchedDirectCustomPrice)}`,
  );
}
await startAndCompleteBooking(directCustomPriceBooking.id, providerAuth.accessToken);
const customPriceCloseout = await postJson(
  `/admin/bookings/${directCustomPriceBooking.id}/closeout`,
  adminAuth.accessToken,
  {
    note: 'Smoke test custom price payout closeout',
  },
);
if (customPriceCloseout.status !== 'COMPLETED' || customPriceCloseout.payment?.status !== 'CAPTURED') {
  throw new Error(`Custom-price booking closeout failed: ${JSON.stringify(customPriceCloseout)}`);
}
const adminCustomPriceEarning = (await getJson('/admin/earnings', adminAuth.accessToken)).find(
  (earning) => earning.bookingId === directCustomPriceBooking.id,
);
const expectedHigherPlatformFee = higherCustomerPrice - higherPricePayoutRule.providerPayoutAmount;
const expectedHigherVatAmount = Math.round(
  (expectedHigherPlatformFee * higherPricePayoutRule.vatBps) / 10_000,
);
const expectedHigherOtherCostAmount = higherPricePayoutRule.otherCostAmount;
const expectedHigherNetCompanyFeeBeforeWithholding =
  expectedHigherPlatformFee - expectedHigherVatAmount - expectedHigherOtherCostAmount;
const customPricePlatformFeeLog = adminCustomPriceEarning?.platformFeeLogs?.[0];
const customPricePayoutSnapshot = customPricePlatformFeeLog?.ruleSnapshot ?? {};
const customPricePayoutLines = Array.isArray(customPricePayoutSnapshot.lines)
  ? customPricePayoutSnapshot.lines
  : [];
const customPricePayoutLine = customPricePayoutLines.find(
  (line) => line.serviceId === service.id && line.customerPrice === higherCustomerPrice,
);
if (
  !adminCustomPriceEarning ||
  adminCustomPriceEarning.grossAmount !== higherCustomerPrice ||
  adminCustomPriceEarning.platformFee !== expectedHigherPlatformFee ||
  customPricePlatformFeeLog?.platformFeeAmount !== expectedHigherPlatformFee ||
  customPricePayoutSnapshot.source !== 'SERVICE_PAYOUT_RULE' ||
  customPricePayoutSnapshot.providerPayoutAmount !== higherPricePayoutRule.providerPayoutAmount ||
  customPricePayoutSnapshot.vatAmount !== expectedHigherVatAmount ||
  customPricePayoutSnapshot.otherCostAmount !== expectedHigherOtherCostAmount ||
  customPricePayoutSnapshot.netCompanyFeeBeforeWithholding !== expectedHigherNetCompanyFeeBeforeWithholding ||
  !customPricePayoutLine ||
  customPricePayoutLine.customerAmount !== higherCustomerPrice ||
  customPricePayoutLine.providerPayoutAmount !== higherPricePayoutRule.providerPayoutAmount ||
  customPricePayoutLine.platformFeeAmount !== expectedHigherPlatformFee ||
  customPricePayoutLine.vatAmount !== expectedHigherVatAmount ||
  customPricePayoutLine.otherCostAmount !== expectedHigherOtherCostAmount ||
  customPricePayoutLine.ruleId !== higherPricePayoutRule.id
) {
  throw new Error(
    `Custom-price completed earning did not use the matching service payout row: ${JSON.stringify({
      adminCustomPriceEarning,
      customPricePayoutLine,
      customPricePayoutLines,
      higherPricePayoutRule,
      expectedHigherPlatformFee,
      expectedHigherVatAmount,
      expectedHigherOtherCostAmount,
      expectedHigherNetCompanyFeeBeforeWithholding,
    })}`,
  );
}

if (providerEarningsSummary.walletBlocked === true || providerEarningsSummary.walletBalance <= 0) {
  throw new Error(
    `Online payment earning should keep provider wallet positive: ${JSON.stringify(providerEarningsSummary)}`,
  );
}
const existingPayoutHolds = await getJson('/admin/partner-sanctions', adminAuth.accessToken);
for (const sanction of existingPayoutHolds.filter(
  (item) =>
    item.providerProfileId === providerAuth.user.providerProfile.id &&
    item.type === 'PAYOUT_HOLD' &&
    item.status === 'ACTIVE',
)) {
  await postJson(`/admin/partner-sanctions/${sanction.id}/lift`, adminAuth.accessToken);
}
const payoutHoldSanction = await postJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/sanctions`,
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
  `/admin/partner-sanctions/${payoutHoldSanction.id}/lift`,
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
await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  transferRef: '',
  notes: 'Missing transfer reference guard',
});
await expectRequestFailure(
  'Payout paid status requires transfer reference',
  () =>
    patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
      status: 'PAID',
    }),
  400,
);
await patchJson(`/admin/payout-batches/${payoutBatch.id}`, adminAuth.accessToken, {
  transferRef: payoutBatchUpdate.transferRef,
  notes: 'Updated by smoke test',
});
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
const adminEarningsAfterPayoutPaid = await getJson('/admin/earnings', adminAuth.accessToken);
const paidPayoutEarning = adminEarningsAfterPayoutPaid.find(
  (earning) => earning.payoutBatchId === payoutBatch.id && earning.netAmount > 0,
);
const payoutPaidLedger = paidPayoutEarning?.walletLedgerEntries?.find(
  (entry) => entry.type === 'PAYOUT_PAID' && entry.payoutBatchId === payoutBatch.id,
);
if (!paidPayoutEarning || !payoutPaidLedger || payoutPaidLedger.amount !== -paidPayoutEarning.netAmount) {
  throw new Error(`Payout paid wallet ledger was not recorded: ${JSON.stringify(paidPayoutEarning)}`);
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
    `Hybrid booking did not switch from preferred to marketplace participant: ${JSON.stringify(adminHybridBooking)}`,
  );
}
const adminHybridMarketplaceParticipant = adminHybridBooking.participants?.find(
  (participant) => participant.providerProfileId === adminHybridBooking.selectedProvider.id,
);
if (
  !adminHybridMarketplaceParticipant ||
  !['ACCEPTED', 'SELECTED'].includes(adminHybridMarketplaceParticipant.status) ||
  !adminHybridMarketplaceParticipant.joinedAt ||
  adminHybridMarketplaceParticipant.providerProfile?.id !== adminHybridBooking.selectedProvider.id
) {
  throw new Error(
    `Admin booking monitor did not retain the selected marketplace participant record: ${JSON.stringify(
      adminHybridBooking,
    )}`,
  );
}
const adminHybridBookingDetail = await getJson(`/admin/bookings/${hybridBooking.id}`, adminAuth.accessToken);
const adminHybridDetailMarketplaceParticipant = adminHybridBookingDetail.participants?.find(
  (participant) => participant.providerProfileId === adminHybridBookingDetail.selectedProvider?.id,
);
if (
  !adminHybridDetailMarketplaceParticipant ||
  !['ACCEPTED', 'SELECTED'].includes(adminHybridDetailMarketplaceParticipant.status) ||
  !adminHybridDetailMarketplaceParticipant.providerProfile?.user?.phone
) {
  throw new Error(
    `Admin booking detail did not expose marketplace participant identity and status: ${JSON.stringify(
      adminHybridBookingDetail,
    )}`,
  );
}
const adminCancelledBooking = adminBookings.find((item) => item.id === cancellableMomoBooking.id);
if (adminCancelledBooking?.status !== 'CANCELLED' || adminCancelledBooking?.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin booking monitor did not expose cancellation release state: ${JSON.stringify(adminCancelledBooking)}`,
  );
}
if (
  adminCancelledBooking?.closedByRole !== 'CUSTOMER' ||
  adminCancelledBooking?.closedReason !== 'customer_cancelled'
) {
  throw new Error(
    `Admin booking monitor did not expose customer cancellation metadata: ${JSON.stringify(adminCancelledBooking)}`,
  );
}
const adminNoShowBooking = adminBookings.find((item) => item.id === noShowBooking.id);
if (adminNoShowBooking?.status !== 'NO_SHOW') {
  throw new Error(
    `Admin booking monitor did not expose no-show state: ${JSON.stringify(adminNoShowBooking)}`,
  );
}
if (adminNoShowBooking?.closedByRole !== 'ADMIN' || adminNoShowBooking?.closedReason !== 'admin_no_show') {
  throw new Error(
    `Admin booking monitor did not expose no-show closure metadata: ${JSON.stringify(adminNoShowBooking)}`,
  );
}
const adminExpiredBooking = adminBookings.find((item) => item.id === manuallyExpiredBooking.id);
if (adminExpiredBooking?.status !== 'EXPIRED' || adminExpiredBooking?.payment?.status !== 'RELEASED') {
  throw new Error(
    `Admin booking monitor did not expose manual expiry release state: ${JSON.stringify(adminExpiredBooking)}`,
  );
}
if (adminExpiredBooking?.closedByRole !== 'ADMIN' || adminExpiredBooking?.closedReason !== 'admin_expired') {
  throw new Error(
    `Admin booking monitor did not expose expiry closure metadata: ${JSON.stringify(adminExpiredBooking)}`,
  );
}
const adminUsers = await getJson('/admin/users', adminAuth.accessToken);
const adminCustomerUser = adminUsers.find((item) => item.id === customerAuth.user.id);
if (!adminCustomerUser?.appSessions?.some((session) => session.id === customerAppSession.id)) {
  throw new Error(
    `Admin user payload is missing customer app session heartbeat: ${JSON.stringify(adminCustomerUser)}`,
  );
}
const adminAppSessions = await getJson('/admin/app-sessions', adminAuth.accessToken);
if (
  !adminAppSessions.some((session) => session.id === customerAppSession.id) ||
  !adminAppSessions.some((session) => session.id === providerAppSession.id)
) {
  throw new Error(
    `Admin app session payload is missing expected heartbeats: ${JSON.stringify({
      customerAppSession,
      providerAppSession,
      adminAppSessions: adminAppSessions.slice(0, 5),
    })}`,
  );
}
const adminPartners = await getJson('/admin/partners?view=list', adminAuth.accessToken);
const legacyAdminProviders = await getJson('/admin/providers?view=list', adminAuth.accessToken);
if (legacyAdminProviders.length !== adminPartners.length) {
  throw new Error(
    `Legacy admin provider alias count does not match partner count: ${JSON.stringify({
      providerCount: legacyAdminProviders.length,
      partnerCount: adminPartners.length,
    })}`,
  );
}
const adminPartner = await getJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
const legacyAdminProvider = await getJson(
  `/admin/providers/${providerAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
if (!adminPartner) {
  throw new Error(
    `Admin partner payload is missing the smoke partner: ${JSON.stringify({
      providerProfileId: providerAuth.user.providerProfile.id,
      listedPartnerIds: adminPartners.slice(0, 5).map((item) => item.id),
    })}`,
  );
}
if (legacyAdminProvider?.id !== adminPartner.id) {
  throw new Error(
    `Legacy admin provider alias does not return the smoke partner: ${JSON.stringify({
      legacyAdminProvider,
      adminPartner,
    })}`,
  );
}
if (!hasFreshEnabledPushDevice(adminPartner?.user?.pushDevices, pushRegistrationStartedAt)) {
  throw new Error(`Admin partner payload is missing registered push device: ${JSON.stringify(adminPartner)}`);
}
if (
  adminPartner?.kyc?.status !== 'APPROVED' ||
  !adminPartner?.bankAccounts?.some((account) => account.status === 'APPROVED') ||
  adminPartner?.taxProfile?.status !== 'APPROVED'
) {
  throw new Error(
    `Admin partner payload is missing onboarding review state: ${JSON.stringify(adminPartner)}`,
  );
}
if (
  !adminPartner?.user?.fileAssets?.some(
    (file) => file.id === publicProfileImageUpload.file.id && file.reviewStatus === 'APPROVED',
  )
) {
  throw new Error(`Admin partner payload is missing approved public media: ${JSON.stringify(adminPartner)}`);
}
const partnerOpsNote = `Automated partner handoff note ${Date.now()}`;
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/ops-note`, adminAuth.accessToken, {
  note: partnerOpsNote,
  preset: 'Partner app session and push reachability checked.',
});
const adminPartnerDetail = await getJson(
  `/admin/partners/${providerAuth.user.providerProfile.id}`,
  adminAuth.accessToken,
);
if (
  !adminPartnerDetail?.auditLogs?.some(
    (log) => log.action === 'provider.ops_note.add' && log.metadata?.note === partnerOpsNote,
  )
) {
  throw new Error(
    `Admin partner detail is missing partner operation note audit log: ${JSON.stringify({
      partnerOpsNote,
      auditLogs: adminPartnerDetail?.auditLogs?.slice(0, 5),
    })}`,
  );
}
const shiftHandoffNote = `Automated shift handoff note ${Date.now()}`;
await postJson('/admin/operations-handoff/note', adminAuth.accessToken, {
  owner: 'Dispatch',
  note: shiftHandoffNote,
  preset: 'Next operator should review live matching, chat, and cash settlement lanes first.',
});
const auditLogsAfterHandoff = await getJson('/admin/audit-logs', adminAuth.accessToken);
if (
  !auditLogsAfterHandoff?.some(
    (log) => log.action === 'operations.handoff_note.add' && log.metadata?.note === shiftHandoffNote,
  )
) {
  throw new Error(
    `Admin audit log is missing operations handoff note: ${JSON.stringify({
      shiftHandoffNote,
      auditLogs: auditLogsAfterHandoff?.slice(0, 5),
    })}`,
  );
}
const adminBackupPartner = await getJson(
  `/admin/partners/${backupProviderAuth.user.providerProfile.id}/overview`,
  adminAuth.accessToken,
);
if (!hasFreshEnabledPushDevice(adminBackupPartner?.user?.pushDevices, pushRegistrationStartedAt)) {
  throw new Error(
    `Admin marketplace partner payload is missing registered push device: ${JSON.stringify(adminBackupPartner)}`,
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

const tracedAdminServices = await getJson('/admin/services', adminAuth.accessToken);
const tracedAdminService = tracedAdminServices.find((item) => item.id === service.id);
const serviceFinanceTraceReady = Boolean(
  tracedAdminService?.bookings?.some(
    (item) =>
      item.booking?.payment &&
      item.booking?.earning &&
      item.booking?.walletLedgerEntries?.length > 0 &&
      item.booking?.platformFeeLogs?.length > 0,
  ),
);
if (!serviceFinanceTraceReady) {
  throw new Error(`Admin service finance trace is incomplete: ${JSON.stringify(tracedAdminService)}`);
}

function hasFreshEnabledPushDevice(devices, registeredAfterMs) {
  return Boolean(
    devices?.some((device) => {
      const lastSeenMs = Date.parse(device.updatedAt ?? device.createdAt ?? '');
      return (
        device.platform === 'android' &&
        device.enabled === true &&
        Number.isFinite(lastSeenMs) &&
        lastSeenMs >= registeredAfterMs
      );
    }),
  );
}

console.log({
  ok: true,
  bookingId: booking.id,
  hybridBookingId: hybridBooking.id,
  directCustomPriceBookingId: directCustomPriceBooking.id,
  directCustomPriceGrossAmount: adminCustomPriceEarning.grossAmount,
  directCustomPricePlatformFee: adminCustomPriceEarning.platformFee,
  directCustomPricePayoutRuleMatched: true,
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
  customerAppSessionId: customerAppSession.id,
  providerAppSessionId: providerAppSession.id,
  adminCustomerAppSessionReady: true,
  adminAppSessionCount: adminAppSessions.length,
  adminPartnerPushDeviceCount: adminPartner?.user?.pushDevices?.length ?? 0,
  adminBackupPartnerPushDeviceCount: adminBackupPartner?.user?.pushDevices?.length ?? 0,
  partnerAliasMeReady:
    partnerAliasInitialMe.providerProfile?.id === backupProviderAuth.user.providerProfile.id,
  partnerAliasServiceGroupCount: partnerAliasInitialServices.length,
  partnerAliasOpenBookingReady: true,
  providerDeviceSessionId: providerDeviceSession.session?.id ?? null,
  providerDeviceBlockRoundTrip:
    blockedProviderDeviceSession.blocked === true && unblockedProviderDeviceSession.blocked === false,
  partnerControlReportId: partnerControlReport.id,
  partnerControlReportStatus: resolvedPartnerControlReport.status,
  partnerControlSanctionId: partnerControlSanction.id,
  partnerControlSanctionLifted: liftedPartnerControlSanction.status === 'LIFTED',
  providerPayoutHoldBlocked: Boolean(payoutHoldSanction.id) && liftedPayoutHoldSanction.status === 'LIFTED',
  providerSupabaseRoleSyncStatus: providerSupabaseRoleSync.status,
  hybridPreferredProviderId: adminHybridBooking?.preferredProvider?.id ?? null,
  hybridSelectedProviderId: adminHybridBooking?.selectedProvider?.id ?? null,
  hybridSwitchedToBackup:
    adminHybridBooking?.preferredProvider?.id !== adminHybridBooking?.selectedProvider?.id,
  backupAcceptNotificationObserved,
  backupDeclineNotificationObserved,
  preferredAcceptPolicyBookingId: preferredAcceptPolicyBooking?.id ?? null,
  preferredAcceptPolicyMatched: preferredAcceptPolicyMatched?.status === 'MATCHED',
  savedSelectedLocationId: savedSelectedLocation.id,
  nearbyProviderDistanceMeters: nearbyProvider.distanceMeters,
  nearbyProviderRecent: nearbyProvider.isRecentLocation,
  globalBrowsePartnerDistanceMeters: globalBrowseProvider.distanceMeters,
  globalBrowseKeepsPartnerDiscoveryOpen: true,
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
  noShowCustomerNotified: true,
  noShowPartnerNotified: true,
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
  serviceFinanceTraceReady,
  customerNotifications: notifications.length,
  retryAccepted,
  retryBeforeDeliveryCount,
  retriedNotificationDeliveryCount: retriedNotification?.deliveries?.length ?? 0,
  retryDeliveryObserved: (retriedNotification?.deliveries?.length ?? 0) > retryBeforeDeliveryCount,
  readiness,
  externalReadinessOk: externalReadiness.ok,
  externalCurrentStageOk: externalReadiness.currentStageOk,
  externalBlockingCategories: externalReadiness.blockingCategories ?? [],
  externalDeferredCategories: externalReadiness.deferredCategories ?? [],
  externalReadinessCategories: [...externalCategories].sort(),
});
