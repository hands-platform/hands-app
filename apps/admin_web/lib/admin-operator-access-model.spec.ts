import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  adminOperatorCategoryForAdminApiPath,
  adminOperatorCategoryForPath,
  adminOperatorUncategorizedWriteApiAllowlistReason,
  hasAdminOperatorCategory,
} from './admin-operator-access-model';

describe('admin operator access model', () => {
  it('maps Admin pages to operator permission categories', () => {
    expect(adminOperatorCategoryForPath('/')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForPath('/bookings/completed')).toBe('BOOKINGS_COMPLETED');
    expect(adminOperatorCategoryForPath('/bookings/post-match-cancellations')).toBe('BOOKINGS_CANCELLATIONS');
    expect(adminOperatorCategoryForPath('/customers/customer-1')).toBe('CUSTOMERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partners/overview')).toBe('PARTNERS_DIRECTORY');
    expect(adminOperatorCategoryForPath('/partners')).toBe('PARTNERS_DIRECTORY');
    expect(adminOperatorCategoryForPath('/partners?review=approval-pending&sort=oldest')).toBe(
      'PARTNERS_UNAPPROVED',
    );
    expect(adminOperatorCategoryForPath('/partners?review=unapproved')).toBe('PARTNERS_UNAPPROVED');
    expect(adminOperatorCategoryForPath('/partner-controls')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partner-controls?details=controls')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partner-controls?details=reports')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partner-controls?details=sanctions')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/partners/provider-1')).toBe('PARTNERS_DETAIL');
    expect(adminOperatorCategoryForPath('/finance-tax/payment-clearing')).toBe('FINANCE_PAYMENT_CLEARING');
    expect(adminOperatorCategoryForPath('/finance-overview')).toBe('FINANCE');
    expect(adminOperatorCategoryForPath('/finance-closeout')).toBe('FINANCE');
    expect(adminOperatorCategoryForPath('/finance-tax/approval-queue')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForPath('/finance-tax/partner-bank-deposits/deposit-1')).toBe(
      'FINANCE_WALLET_ADJUSTMENTS',
    );
    expect(adminOperatorCategoryForPath('/finance-tax/company-bank-accounts')).toBe(
      'FINANCE_BANK_RECONCILIATION',
    );
    expect(adminOperatorCategoryForPath('/finance-tax/coupon-finance')).toBe('FINANCE_TAX');
    expect(adminOperatorCategoryForPath('/finance-tax/booking-settlement-audit/settlement-1')).toBe(
      'FINANCE_SETTLEMENTS',
    );
    expect(adminOperatorCategoryForPath('/finance-tax/settlement-reversals/reversal-1')).toBe(
      'FINANCE_SETTLEMENTS',
    );
    expect(adminOperatorCategoryForPath('/finance-tax/finance-approvers')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForPath('/referrals/customers')).toBe('CUSTOMERS');
    expect(adminOperatorCategoryForPath('/referrals/customers?settings=policy')).toBe('SYSTEM_POLICY');
    expect(adminOperatorCategoryForPath('/referrals')).toBe('CUSTOMERS');
    expect(adminOperatorCategoryForPath('/referrals/partners')).toBe('PARTNERS');
    expect(adminOperatorCategoryForPath('/referrals/partners?settings=policy')).toBe('SYSTEM_POLICY');
    expect(adminOperatorCategoryForPath('/finance-tax/payment-fees?settings=policy')).toBe('SYSTEM_POLICY');
    expect(adminOperatorCategoryForPath('/referrals/cashouts')).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForPath('/notifications/push-send')).toBe('NOTIFICATIONS_PUSH');
    expect(adminOperatorCategoryForPath('/notifications/templates')).toBe('NOTIFICATIONS_TEMPLATES');
    expect(adminOperatorCategoryForPath('/app-sessions')).toBe('DEVELOPER_APP_SESSIONS_DIAGNOSTICS');
    expect(adminOperatorCategoryForPath('/background-jobs')).toBe('DEVELOPER_HEALTH');
    expect(adminOperatorCategoryForPath('/chat-archive')).toBe('BOOKINGS_DETAIL');
    expect(adminOperatorCategoryForPath('/calendar')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForPath('/usage-overview')).toBe('CUSTOMERS_DIRECTORY');
    expect(adminOperatorCategoryForPath('/marketing-analytics')).toBe('GROWTH_MARKETING');
    expect(adminOperatorCategoryForPath('/setup')).toBe('DEVELOPER_SETUP');
    expect(adminOperatorCategoryForPath('/website-content')).toBe('CONTENT_VIEW');
    expect(adminOperatorCategoryForPath('/operations-handoff')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForPath('/admin-operators')).toBe('SYSTEM_ADMIN_OPERATORS');
    expect(adminOperatorCategoryForPath('/vietnam-overview')).toBe('BOOKINGS_REALTIME');
  });

  it('maps write API calls to operator permission categories', () => {
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/finance-approver-governance/requests')).toBe(
      'SYSTEM_ADMIN_OPERATORS',
    );
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/finance-approver-governance/requests/request-1/decision',
      ),
    ).toBe('SYSTEM_POLICY');
    expect(
      adminOperatorCategoryForAdminApiPath('PATCH', '/admin/partner-customer-reviews/note-1/moderate'),
    ).toBe('CUSTOMERS_REVIEWS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/bookings/booking-1/ops-note')).toBe(
      'BOOKINGS_DETAIL',
    );
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/users/user-1/admin-operator-access')).toBe(
      'SYSTEM_ADMIN_OPERATORS',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/manual-wallet-adjustments')).toBe(
      'FINANCE_WALLET_ADJUSTMENTS',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/wallet-adjustments')).toBe(
      'FINANCE_WALLET_ADJUSTMENTS',
    );
    expect(
      adminOperatorCategoryForAdminApiPath('POST', '/admin/wallet-adjustment-requests/request-1/approve'),
    ).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(
      adminOperatorCategoryForAdminApiPath('POST', '/admin/payment-fee-policies/policy-1/activate'),
    ).toBe('SYSTEM_POLICY');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/provider-wallet/deposits')).toBe(
      'FINANCE_WALLET_ADJUSTMENTS',
    );
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/provider-wallet/deposit-requests/request-1/approve',
      ),
    ).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/provider-wallet/deposit-requests/request-1/reconciliation-assignment',
      ),
    ).toBe('FINANCE_WALLET_ADJUSTMENTS');
    expect(
      adminOperatorCategoryForAdminApiPath('PATCH', '/admin/provider-wallet/withdrawal-requests/request-1'),
    ).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/payout-batches')).toBe('FINANCE_SETTLEMENTS');
    expect(
      adminOperatorCategoryForAdminApiPath('POST', '/admin/cash-settlement-earnings/earning-1/allocations'),
    ).toBe('FINANCE_SETTLEMENTS');
    expect(
      adminOperatorCategoryForAdminApiPath('POST', '/admin/booking-settlement-gaps/booking-1/repair'),
    ).toBe('FINANCE_SETTLEMENTS');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/referrals/rewards/reward-1/credit')).toBe(
      'FINANCE_SETTLEMENTS',
    );
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/referrals/rewards/reward-1/tax-review-approve',
      ),
    ).toBe('FINANCE_TAX');
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/referrals/rewards/reward-1/tax-review-hold',
      ),
    ).toBe('FINANCE_TAX');
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/referrals/rewards/reward-1/tax-review-reject',
      ),
    ).toBe('FINANCE_TAX');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/company-bank-accounts')).toBe(
      'SYSTEM_POLICY',
    );
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/company-bank-accounts/bank-account-1')).toBe(
      'SYSTEM_POLICY',
    );
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/company-bank-accounts/bank-account-1/approval-decision',
      ),
    ).toBe('FINANCE_BANK_RECONCILIATION');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/referrals/policies/customer')).toBe(
      'SYSTEM_POLICY',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/site-pages')).toBe('CONTENT_EDIT');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/site-pages/page-1')).toBe('CONTENT_EDIT');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/site-pages/page-1/publish')).toBe(
      'CONTENT_PUBLISH',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/site-pages/page-1/rollback')).toBe(
      'CONTENT_PUBLISH',
    );
    expect(adminOperatorCategoryForAdminApiPath('DELETE', '/admin/site-pages/page-1')).toBe('CONTENT_DELETE');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partners/provider-1/approve')).toBe(
      'PARTNERS_DETAIL',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partner-documents/document-1/approve')).toBe(
      'PARTNERS_KYC',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/partner-bank-accounts/bank-1/reject')).toBe(
      'PARTNERS_KYC',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/tax-policy-versions')).toBe('FINANCE_TAX');
    expect(adminOperatorCategoryForAdminApiPath('PATCH', '/admin/service-payout-rules/rule-1')).toBe(
      'SYSTEM_SERVICES',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/marketing/spend-daily')).toBe(
      'GROWTH_MARKETING_SPEND',
    );
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/calendar-events')).toBe('BOOKINGS_REALTIME');
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/notifications/push-campaigns')).toBe(
      'NOTIFICATIONS_PUSH',
    );
    expect(
      adminOperatorCategoryForAdminApiPath('PATCH', '/admin/notifications/templates/booking.matched'),
    ).toBe('NOTIFICATIONS_TEMPLATES');
    expect(
      adminOperatorCategoryForAdminApiPath(
        'POST',
        '/admin/system/background-jobs/payment-status-check/job-1/acknowledge',
      ),
    ).toBe('DEVELOPER_HEALTH');
  });

  it('keeps audit sink writes out of category matching and behind an explicit allowlist reason', () => {
    expect(adminOperatorCategoryForAdminApiPath('POST', '/admin/operator-activity')).toBeNull();
    expect(adminOperatorUncategorizedWriteApiAllowlistReason('POST', '/admin/operator-activity')).toBe(
      'Operator activity is the audit sink used to record access decisions.',
    );
  });

  it('keeps Admin Web write API calls mapped to permission categories or an explicit audit allowlist', () => {
    const writeCalls = collectAdminWebWriteApiCalls();
    expect(writeCalls.length).toBeGreaterThan(40);
    expect(writeCalls.map(writeCallKey)).toContain('POST /admin/operator-activity');
    const unmappedCalls = writeCalls
      .filter((call) => !adminWriteCallHasCategory(call) && !adminWriteCallHasAllowlistReason(call))
      .map((call) => `${writeCallKey(call)} in ${call.file}`)
      .sort();

    expect(unmappedCalls).toEqual([]);
  });

  it('checks detailed category membership with legacy parent fallback', () => {
    expect(hasAdminOperatorCategory(null, 'BOOKINGS')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS_DETAIL'] }, 'BOOKINGS_DETAIL')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['BOOKINGS'] }, 'FINANCE')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: [], roles: ['MASTER_ADMIN'] }, 'DEVELOPER_SETUP')).toBe(
      true,
    );
    expect(hasAdminOperatorCategory({ categories: ['DEVELOPER_SYSTEM'] }, 'DEVELOPER_SETUP')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['GROWTH'] }, 'GROWTH_MARKETING')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['GROWTH'] }, 'GROWTH_MARKETING_SPEND')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['GROWTH_MARKETING'] }, 'GROWTH_MARKETING_SPEND')).toBe(
      false,
    );
    expect(
      hasAdminOperatorCategory({ categories: ['GROWTH_MARKETING_SPEND'] }, 'GROWTH_MARKETING_SPEND'),
    ).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['NOTIFICATIONS'] }, 'NOTIFICATIONS_PUSH')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['NOTIFICATIONS_PUSH'] }, 'NOTIFICATIONS_PUSH')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: ['NOTIFICATIONS'] }, 'NOTIFICATIONS_INCIDENTS')).toBe(false);
    expect(hasAdminOperatorCategory({ categories: ['NOTIFICATIONS_INCIDENTS'] }, 'NOTIFICATIONS_INCIDENTS')).toBe(true);
    expect(hasAdminOperatorCategory({ categories: [], roles: ['MASTER_ADMIN'] }, 'BOOKINGS_REALTIME')).toBe(
      true,
    );
  });
});

type AdminWebWriteApiCall = {
  readonly file: string;
  readonly method: 'DELETE' | 'PATCH' | 'POST';
  readonly path: string;
};

function collectAdminWebWriteApiCalls() {
  const sourceDirectories = ['app', 'components', 'lib'].map((directory) =>
    path.join(process.cwd(), directory),
  );

  return sourceDirectories
    .flatMap((directory) => collectSourceFiles(directory))
    .flatMap((file) => collectAdminWebWriteApiCallsFromFile(file))
    .sort((a, b) => writeCallKey(a).localeCompare(writeCallKey(b)) || a.file.localeCompare(b.file));
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    if (!/\.(ts|tsx)$/u.test(entry) || /\.(spec|test)\.(ts|tsx)$/u.test(entry)) {
      return [];
    }

    return [entryPath];
  });
}

function collectAdminWebWriteApiCallsFromFile(filePath: string): AdminWebWriteApiCall[] {
  const source = readFileSync(filePath, 'utf8');
  const calls: AdminWebWriteApiCall[] = [];
  const callPattern =
    /\b(adminPostOrThrow|adminPost|adminPatchOrThrow|adminPatch|adminDeleteWithBodyOrThrow|adminDeleteOrThrow|adminDelete)(?:<[^>]*>)?\s*\(\s*([`'"])([\s\S]*?)\2/gu;

  for (const match of source.matchAll(callPattern)) {
    const [, functionName, , rawPath] = match;
    if (!rawPath.startsWith('/admin/')) {
      continue;
    }

    calls.push({
      file: path.relative(process.cwd(), filePath),
      method: adminWriteMethodForFunction(functionName),
      path: normalizeAdminWritePath(rawPath),
    });
  }

  return calls;
}

function adminWriteMethodForFunction(functionName: string): AdminWebWriteApiCall['method'] {
  if (functionName.includes('Delete')) {
    return 'DELETE';
  }
  if (functionName.includes('Patch')) {
    return 'PATCH';
  }

  return 'POST';
}

function normalizeAdminWritePath(rawPath: string) {
  return rawPath.replace(/\$\{[^}]+\}/gu, 'sample-id');
}

function adminWriteCallHasCategory(call: AdminWebWriteApiCall) {
  return Boolean(adminOperatorCategoryForAdminApiPath(call.method, call.path));
}

function adminWriteCallHasAllowlistReason(call: AdminWebWriteApiCall) {
  return Boolean(adminOperatorUncategorizedWriteApiAllowlistReason(call.method, call.path));
}

function writeCallKey(call: AdminWebWriteApiCall) {
  return `${call.method} ${call.path}`;
}
