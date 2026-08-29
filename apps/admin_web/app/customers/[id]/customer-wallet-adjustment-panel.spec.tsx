import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminCustomerWalletLedgerPage } from '../../../lib/admin-api';
import { CustomerWalletAdjustmentPanel } from './customer-wallet-adjustment-panel';

const emptyWalletLedger: AdminCustomerWalletLedgerPage = {
  pagination: { skip: 0, take: 10 },
  rows: [],
  summary: { balance: 160000, currency: 'VND', moneyIn: 0, moneyOut: 0, totalCount: 0 },
};

const openPeriods = [
  { currency: 'VND', id: 'period-2026-08', period: '2026-08', status: 'DRAFT' as const, updatedAt: '2026-08-10T00:00:00.000Z' },
];

describe('CustomerWalletAdjustmentPanel', () => {
  it('does not show the request form without finance wallet adjustment access', () => {
    const markup = renderToStaticMarkup(
      <CustomerWalletAdjustmentPanel
        actionHref="/customers/customer-1?action=wallet#customer-wallet-adjustment-request"
        actionOpen
        auditHref="/audit-log?q=customer-1"
        closeHref="/customers/customer-1#customer-wallet-adjustment-request"
        currentBalance={160000}
        customerId="customer-1"
        customerLabel="Customer One"
        canCreateRequest={false}
        openPeriods={openPeriods}
        returnTo="/customers?view=all&page=2&q=mai"
        walletLedger={emptyWalletLedger}
        walletPage={1}
      />,
    );

    expect(markup).toContain('Financial adjustment');
    expect(markup).toContain('Financial adjustment');
    expect(markup).not.toContain('Create approval request');
    expect(markup).not.toContain('name="ownerType"');
    expect(markup).not.toContain('Pending wallet requests');
  });

  it('creates a request that requires a separate finance approver', () => {
    const markup = renderToStaticMarkup(
      <CustomerWalletAdjustmentPanel
        actionHref="/customers/customer-1?action=wallet#customer-wallet-adjustment-request"
        actionOpen
        auditHref="/audit-log?q=customer-1"
        closeHref="/customers/customer-1#customer-wallet-adjustment-request"
        currentBalance={160000}
        customerId="customer-1"
        customerLabel="Customer One"
        canCreateRequest
        notice="requested"
        openPeriods={openPeriods}
        returnTo="/customers?view=all&page=2&q=mai"
        walletLedger={emptyWalletLedger}
        walletPage={1}
      />,
    );

    expect(markup).toContain('type="hidden" name="ownerType" value="CUSTOMER"');
    expect(markup).toContain('type="hidden" name="ownerId" value="customer-1"');
    expect(markup).toContain(
      'name="redirectTo" value="/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai#customer-wallet-adjustment-request"',
    );
    expect(markup).toContain('Separate finance approval');
    expect(markup).toContain('Accounting month');
    expect(markup).toContain('Before');
    expect(markup).toContain('After');
    expect(markup).toContain('Approval request created');
    expect(markup).not.toContain('customer-direct');
    expect(markup).not.toContain('Applies immediately');
  });

  it('shows manual adjustments, service payments, and wallet withdrawals in one ledger', () => {
    const walletLedger: AdminCustomerWalletLedgerPage = {
      pagination: { skip: 0, take: 10 },
      rows: [
        {
          afterBalance: 900000,
          amount: 1000000,
          beforeBalance: -100000,
          bookingId: null,
          createdAt: '2026-07-17T03:00:00.000Z',
          currency: 'VND',
          direction: 'CREDIT',
          id: 'ledger-adjustment',
          notes: 'Customer compensation',
          reference: 'manual-adjustment-1',
          referralRewardId: null,
          sourceKey: 'manual-wallet-adjustment:manual-adjustment-1',
          type: 'ADMIN_ADJUSTMENT',
        },
        {
          afterBalance: -100000,
          amount: -600000,
          beforeBalance: 500000,
          bookingId: 'booking-1',
          createdAt: '2026-07-16T03:00:00.000Z',
          currency: 'VND',
          direction: 'DEBIT',
          id: 'ledger-payment',
          notes: 'Paid for service with wallet',
          reference: 'payment-1',
          referralRewardId: null,
          sourceKey: 'customer-wallet-payment:booking-1:settlement',
          type: 'CUSTOMER_WALLET_PAYMENT',
        },
        {
          afterBalance: 500000,
          amount: -500000,
          beforeBalance: 1000000,
          bookingId: null,
          createdAt: '2026-07-15T03:00:00.000Z',
          currency: 'VND',
          direction: 'DEBIT',
          id: 'ledger-cashout',
          notes: 'Referral wallet cashout',
          reference: 'cashout-1',
          referralRewardId: 'reward-1',
          sourceKey: 'customer-referral-cashout:reward-1',
          type: 'CUSTOMER_REFERRAL_CASHOUT',
        },
      ],
      summary: {
        balance: 900000,
        currency: 'VND',
        moneyIn: 2000000,
        moneyOut: 1100000,
        totalCount: 3,
      },
    };

    const markup = renderToStaticMarkup(
      <CustomerWalletAdjustmentPanel
        actionHref="/customers/customer-1?action=wallet#customer-wallet-adjustment-request"
        actionOpen={false}
        auditHref="/audit-log?q=customer-1"
        closeHref="/customers/customer-1#customer-wallet-adjustment-request"
        currentBalance={900000}
        customerId="customer-1"
        customerLabel="Customer One"
        canCreateRequest
        openPeriods={openPeriods}
        returnTo="/customers?view=all&page=2&q=mai"
        walletLedger={walletLedger}
        walletPage={1}
      />,
    );

    expect(markup).toContain('Wallet transaction history');
    expect(markup).toContain('Manual adjustment');
    expect(markup).toContain('Service payment');
    expect(markup).toContain('Wallet withdrawal');
    expect(markup).toContain('Money in');
    expect(markup).toContain('Money out');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/referrals/customers');
    expect(markup).not.toContain('Pending wallet requests');
    expect(markup).not.toContain('Recent manual wallet adjustments');
  });

  it('preserves the customer-list return in wallet ledger pagination', () => {
    const markup = renderToStaticMarkup(
      <CustomerWalletAdjustmentPanel
        actionHref="/customers/customer-1?action=wallet#customer-wallet-adjustment-request"
        actionOpen={false}
        auditHref="/audit-log?q=customer-1"
        closeHref="/customers/customer-1#customer-wallet-adjustment-request"
        currentBalance={160000}
        customerId="customer-1"
        customerLabel="Customer One"
        canCreateRequest
        openPeriods={openPeriods}
        returnTo="/customers?view=all&page=2&q=mai"
        walletLedger={{
          ...emptyWalletLedger,
          summary: { ...emptyWalletLedger.summary, totalCount: 21 },
        }}
        walletPage={1}
      />,
    );

    expect(markup).toContain(
      'href="/customers/customer-1?returnTo=%2Fcustomers%3Fview%3Dall%26page%3D2%26q%3Dmai&amp;walletPage=2#customer-wallet-history"',
    );
  });
});
