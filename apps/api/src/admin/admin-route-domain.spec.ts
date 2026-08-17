import 'reflect-metadata';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';

import { AdminController } from './admin.controller';
import { adminRouteDomain } from './admin-route-domain';

type RouteHandler = (...args: unknown[]) => unknown;

describe('Admin route domain manifest', () => {
  it('assigns every AdminController route to one operational domain', () => {
    const routes = listControllerRoutes(AdminController);

    expect(routes.length).toBeGreaterThan(200);
    expect(
      routes
        .filter((route) => adminRouteDomain(route.path) === null)
        .map((route) => `${route.method} ${route.path}`),
    ).toEqual([]);
  });

  it('keeps the customer route surface small and owned by the customer route class', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'CUSTOMER',
    );

    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'GET customers',
      'GET customers/summary',
      'GET customers/:id',
      'GET customers/:id/wallet-ledger',
      'POST customers/:id/ops-note',
    ]);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminCustomerRoutes']));
  });

  it('keeps inherited customer routes discoverable by the Nest metadata scanner', () => {
    const methodNames = new MetadataScanner().getAllMethodNames(AdminController.prototype);

    expect(methodNames).toEqual(
      expect.arrayContaining([
        'customers',
        'customerSummary',
        'customerDetail',
        'customerWalletLedger',
        'addCustomerOpsNote',
      ]),
    );
  });

  it('keeps Partner, KYC, media, device, report, and sanction routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'PARTNER',
    );

    expect(routes.length).toBeGreaterThan(30);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminPartnerRoutes']));
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        'partners/list-providers',
        'partners/:id',
        'partners/:id/approve',
        'partners/:id/public-media/presign',
        'operations-policy/matching-preview',
        'partner-reports',
        'partner-sanctions',
        'files/review-summary',
      ]),
    );
  });

  it('keeps Booking operations and chat archive routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'BOOKING',
    );

    expect(routes).toHaveLength(19);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminBookingRoutes']));
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        'bookings',
        'bookings/page',
        'bookings/summary',
        'bookings/:id',
        'bookings/:id/no-show',
        'bookings/:id/post-match-cancellation/approve',
        'chat-archive',
        'chat-archive/summary',
      ]),
    );
  });

  it('keeps inherited Booking routes discoverable by the Nest metadata scanner', () => {
    const methodNames = new MetadataScanner().getAllMethodNames(AdminController.prototype);

    expect(methodNames).toEqual(
      expect.arrayContaining([
        'bookings',
        'bookingsPage',
        'bookingDetail',
        'closeoutCompletedBooking',
        'approvePostMatchCancellation',
        'chatArchive',
      ]),
    );
  });

  it('keeps payment, callback, and refund read routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'payments' ||
        route.path.startsWith('payments/') ||
        route.path === 'payment-callback-attempts' ||
        route.path.startsWith('payment-callback-attempts/') ||
        route.path === 'refunds' ||
        route.path.startsWith('refunds/'),
    );

    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'GET payments',
      'GET payments/summary',
      'GET payments/:id',
      'GET payment-callback-attempts',
      'GET refunds',
      'GET refunds/queue-meta',
      'GET refunds/summary',
    ]);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminPaymentRoutes']));
  });

  it('keeps booking settlement records and repair routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter((route) =>
      route.path.startsWith('booking-settlement-'),
    );

    expect(routes).toHaveLength(16);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminSettlementRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET booking-settlement-gaps',
        'GET booking-settlement-gaps/preview-batch',
        'POST booking-settlement-gaps/:id/repair',
        'GET booking-settlement-snapshots',
        'GET booking-settlement-snapshots/export',
        'GET booking-settlement-snapshots/:id',
        'GET booking-settlement-reversals',
        'GET booking-settlement-reversals/:id',
        'GET booking-settlement-snapshots/coupon-finance',
      ]),
    );
  });

  it('keeps general ledger and payment clearing routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'accounting-journal-batches' ||
        route.path.startsWith('accounting-journal-batches/') ||
        route.path === 'booking-payment-clearing' ||
        route.path.startsWith('booking-payment-clearing/'),
    );

    expect(routes).toHaveLength(9);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminLedgerRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET accounting-journal-batches',
        'GET accounting-journal-batches/:id',
        'GET booking-payment-clearing',
        'GET booking-payment-clearing/:id',
        'POST booking-payment-clearing/review-assignments',
        'POST booking-payment-clearing/:id/review-assignment',
      ]),
    );
  });

  it('keeps company bank accounts and reconciliation routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'company-bank-accounts' ||
        route.path.startsWith('company-bank-accounts/') ||
        route.path === 'bank-reconciliation' ||
        route.path.startsWith('bank-reconciliation/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(26);
    expect(writeRoutes).toHaveLength(12);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminBankRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET company-bank-accounts/operations-page',
        'GET company-bank-accounts/recent-changes',
        'GET company-bank-accounts/approver-readiness',
        'GET company-bank-accounts/:id/status-preflight',
      ]),
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST company-bank-accounts',
        'PATCH company-bank-accounts/:id',
        'POST company-bank-accounts/:id/approval-decision',
        'POST bank-reconciliation/transactions',
        'POST bank-reconciliation/transactions/batch-import',
        'POST bank-reconciliation/:id/matches',
        'POST bank-reconciliation/:id/matches/:matchId/reverse',
        'POST bank-reconciliation/:id/ignore',
      ]),
    );
  });

  it('keeps partner deposits and manual wallet adjustments under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'provider-wallet/deposits' ||
        route.path === 'provider-wallet/deposit-requests' ||
        route.path.startsWith('provider-wallet/deposit-requests/') ||
        route.path === 'wallet-adjustments' ||
        route.path.startsWith('wallet-adjustments/') ||
        route.path === 'wallet-adjustment-requests' ||
        route.path.startsWith('wallet-adjustment-requests/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(26);
    expect(writeRoutes).toHaveLength(13);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminWalletRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET wallet-adjustments/policy',
        'GET wallet-adjustments/open-periods',
        'GET wallet-adjustment-requests/:id',
      ]),
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST provider-wallet/deposits',
        'POST provider-wallet/deposit-requests',
        'POST provider-wallet/deposit-requests/:id/approve',
        'POST provider-wallet/deposit-requests/:id/reject',
        'POST provider-wallet/deposit-requests/:id/cash-debt-allocations',
        'POST wallet-adjustments/preview',
        'POST wallet-adjustments',
        'POST wallet-adjustment-requests',
        'POST wallet-adjustment-requests/:id/approve',
        'POST wallet-adjustment-requests/:id/cancel-stale',
        'POST wallet-adjustment-requests/:id/reject',
      ]),
    );
  });

  it('keeps withdrawal requests and payout batches under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'provider-wallet/withdrawal-requests' ||
        route.path.startsWith('provider-wallet/withdrawal-requests/') ||
        route.path === 'payout-batches' ||
        route.path.startsWith('payout-batches/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(10);
    expect(writeRoutes).toHaveLength(5);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminPayoutRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toContain('GET payout-batches/:id');
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'PATCH provider-wallet/withdrawal-requests/:id',
        'POST provider-wallet/withdrawal-requests/:id/reversal',
        'POST payout-batches',
        'PATCH payout-batches/:id',
        'POST payout-batches/:id/reversal',
      ]),
    );
  });

  it('keeps review and partner evaluation routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'reviews' ||
        route.path.startsWith('reviews/') ||
        route.path === 'partner-customer-reviews' ||
        route.path.startsWith('partner-customer-reviews/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(9);
    expect(writeRoutes).toHaveLength(3);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminReviewRoutes']));
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'PATCH partner-customer-reviews/:id/moderate',
      'POST reviews/manual',
      'PATCH reviews/:id/moderate',
    ]);
  });

  it('keeps coupon catalog and usage routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => route.path === 'coupons' || route.path.startsWith('coupons/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(8);
    expect(writeRoutes).toHaveLength(4);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminCouponRoutes']));
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST coupons',
        'POST coupons/batch',
        'PATCH coupons/:id',
        'DELETE coupons/:id',
      ]),
    );
  });

  it('keeps audit and operational governance routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'audit-logs' ||
        route.path.startsWith('audit-logs/') ||
        route.path === 'operations-handoff/note' ||
        route.path === 'operational-policy' ||
        route.path.startsWith('operational-policy/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes.length).toBeGreaterThanOrEqual(9);
    expect(writeRoutes).toHaveLength(3);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminGovernanceRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET audit-logs/page',
        'GET audit-logs/events/:id',
        'GET audit-logs/export',
      ]),
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST audit-logs/events/:id/corrections',
        'POST operations-handoff/note',
        'PATCH operational-policy/:key',
      ]),
    );
  });

  it('keeps notification operations under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => route.path === 'notifications' || route.path.startsWith('notifications/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(11);
    expect(writeRoutes).toHaveLength(5);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminNotificationRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toContain(
      'GET notifications/push-campaigns/:id',
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'PATCH notifications/templates/:key',
        'POST notifications/push-campaigns/preview',
        'POST notifications/push-campaigns',
        'POST notifications/:id/retry',
        'POST notifications/:id/review-legacy',
      ]),
    );
  });

  it('keeps admin identity, calendar, and session routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'IDENTITY',
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(38);
    expect(writeRoutes).toHaveLength(22);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminIdentityRoutes']));
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST admin-operator-invitations',
        'POST admin-operator-invitations/:id/revoke',
        'POST admin-operator-invitations/:id/resend',
        'POST admin-operators/reauthenticate',
        'POST admin-operators/me/mfa/enrollment',
        'POST admin-operators/me/mfa/verify',
        'POST admin-operators/me/session/revoke',
        'PATCH users/:id/admin-operator-access',
        'POST users/:id/admin-operator-access/initialize',
        'POST users/:id/admin-operator/suspend',
        'POST users/:id/admin-operator/reactivate',
        'POST users/:id/admin-operator/mfa/reset',
        'POST users/:id/admin-web-sessions/:sessionId/revoke',
        'DELETE users/:id/admin-operator',
        'POST operator-activity',
        'POST calendar-events',
        'PATCH calendar-events/:id',
        'DELETE calendar-events/:id',
        'POST finance-approver-governance/requests',
        'POST finance-approver-governance/requests/:id/decision',
        'POST finance-approver-governance/legacy-attestations',
        'POST finance-approver-governance/legacy-attestations/:id/decision',
      ]),
    );
  });

  it('keeps dashboard and analytics routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'ANALYTICS',
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(19);
    expect(writeRoutes).toHaveLength(1);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminAnalyticsRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toContain(
      'GET dashboard/start-shift-analytics',
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'POST marketing/spend-daily',
    ]);
  });

  it('keeps referral policy, reward, cashout, and parent routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) => adminRouteDomain(route.path) === 'REFERRAL',
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(21);
    expect(writeRoutes).toHaveLength(9);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminReferralRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'GET referrals/customers/workspace',
        'GET referrals/customers/fixtures',
      ]),
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'PATCH referrals/policies/:audience',
        'POST referrals/rewards/release-available',
        'POST referrals/rewards/:id/hold',
        'POST referrals/rewards/:id/release',
        'POST referrals/rewards/:id/credit',
        'POST referrals/rewards/:id/cashout-approve',
        'POST referrals/rewards/:id/tax-review',
        'POST referrals/rewards/:id/cashout-paid',
        'POST referrals/rewards/:id/reverse',
      ]),
    );
  });

  it('keeps remaining finance overview, tax, fee policy, and approval routes under one owner', () => {
    const ownedPrefixes = [
      'finance-overview',
      'earnings',
      'cash-settlement-earnings',
      'cash-settlement-summary',
      'partner-withholding-tax',
      'monthly-tax-closings',
      'platform-vat',
      'payment-fees',
      'payment-fee-policies',
      'finance-approval-queue',
    ];
    const routes = listControllerRoutes(AdminController).filter((route) =>
      ownedPrefixes.some((prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`)),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(26);
    expect(writeRoutes).toHaveLength(10);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminFinanceRoutes']));
    expect(routes.map((route) => `${route.method} ${route.path}`)).toContain(
      'GET cash-settlement-earnings/:id',
    );
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'POST cash-settlement-earnings/:id/allocations',
        'PATCH monthly-tax-closings/:period/status',
        'POST payment-fee-policies',
        'PATCH payment-fee-policies/:id',
        'POST payment-fee-policies/:id/rules',
        'POST payment-fee-policies/:id/approval-request',
        'POST payment-fee-policies/:id/approval-reject',
        'POST payment-fee-policies/:id/approval-cancel',
        'POST payment-fee-policies/:id/activate',
        'POST earnings/:id/mark-paid',
      ]),
    );
  });

  it('keeps service catalog and payout-rule routes under one owner', () => {
    const routes = listControllerRoutes(AdminController).filter(
      (route) =>
        route.path === 'services' ||
        route.path.startsWith('services/') ||
        route.path.startsWith('service-payout-rules/'),
    );
    const writeRoutes = routes.filter((route) => route.method !== 'GET');

    expect(routes).toHaveLength(11);
    expect(writeRoutes).toHaveLength(7);
    expect(new Set(routes.map((route) => route.owner))).toEqual(new Set(['AdminCatalogRoutes']));
    expect(writeRoutes.map((route) => `${route.method} ${route.path}`)).toEqual(
      expect.arrayContaining([
        'PATCH services/groups/:groupKey',
        'POST services/duration-sets',
        'POST services',
        'PATCH services/:id',
        'POST services/:id/payout-rules',
        'POST services/:id/payout-rules/bulk',
        'PATCH service-payout-rules/:id',
      ]),
    );
  });

  it('does not register duplicate method and path combinations across inherited route classes', () => {
    const routes = listControllerRoutes(AdminController);
    const keys = routes.map((route) => `${route.method} ${route.path}`);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

function listControllerRoutes(controller: typeof AdminController) {
  const routes: Array<{
    method: string;
    owner: string;
    path: string;
  }> = [];
  const methodNames = new Set<string>();
  let prototype: object | null = controller.prototype;

  while (prototype && prototype !== Object.prototype) {
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === 'constructor' || methodNames.has(methodName)) continue;
      methodNames.add(methodName);

      const handler = (prototype as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;
      const routeHandler = handler as RouteHandler;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, routeHandler) as RequestMethod | undefined;
      if (requestMethod === undefined) continue;

      for (const path of toRouteParts(Reflect.getMetadata(PATH_METADATA, routeHandler))) {
        routes.push({
          method: RequestMethod[requestMethod],
          owner: prototype.constructor.name,
          path,
        });
      }
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  return routes;
}

function toRouteParts(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((path) => String(path ?? '').replace(/^\/+|\/+$/g, ''));
}
