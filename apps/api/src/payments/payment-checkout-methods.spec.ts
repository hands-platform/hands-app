import { PaymentMethod } from '@prisma/client';
import type { PaymentAdapter, PaymentAdapterMode } from './payment-adapter';
import { availableCustomerCheckoutMethods } from './payment-checkout-methods';

describe('availableCustomerCheckoutMethods', () => {
  it('returns only internal cash when placeholder authorizations are disabled', () => {
    expect(
      availableCustomerCheckoutMethods(adapters(), {
        isProduction: false,
        allowPlaceholder: false,
        allowRedirectMethods: false,
      }),
    ).toEqual([
      {
        method: PaymentMethod.CASH,
        label: 'Cash',
        requiresRedirect: false,
      },
      {
        method: PaymentMethod.CUSTOMER_WALLET,
        label: 'Wallet',
        requiresRedirect: false,
      },
    ]);
  });

  it('allows local placeholder methods only outside production', () => {
    expect(
      availableCustomerCheckoutMethods(adapters(), {
        isProduction: false,
        allowPlaceholder: true,
        allowRedirectMethods: true,
      }).map((item) => item.method),
    ).toEqual([
      PaymentMethod.CASH,
      PaymentMethod.CUSTOMER_WALLET,
      PaymentMethod.MOMO,
      PaymentMethod.VNPAY,
      PaymentMethod.CARD,
    ]);

    expect(
      availableCustomerCheckoutMethods(adapters(), {
        isProduction: true,
        allowPlaceholder: true,
        allowRedirectMethods: true,
      }).map((item) => item.method),
    ).toEqual([PaymentMethod.CASH, PaymentMethod.CUSTOMER_WALLET]);
  });

  it('exposes configured gateway adapters in production', () => {
    expect(
      availableCustomerCheckoutMethods(
        adapters({ momo: 'GATEWAY', vnpay: 'GATEWAY' }),
        { isProduction: true, allowPlaceholder: false, allowRedirectMethods: true },
      ),
    ).toEqual([
      { method: PaymentMethod.CASH, label: 'Cash', requiresRedirect: false },
      { method: PaymentMethod.CUSTOMER_WALLET, label: 'Wallet', requiresRedirect: false },
      { method: PaymentMethod.MOMO, label: 'MoMo', requiresRedirect: true },
      { method: PaymentMethod.VNPAY, label: 'VNPay', requiresRedirect: true },
    ]);
  });

  it('does not expose gateway methods before the customer redirect flow is enabled', () => {
    expect(
      availableCustomerCheckoutMethods(
        adapters({ momo: 'GATEWAY', vnpay: 'GATEWAY' }),
        { isProduction: true, allowPlaceholder: false, allowRedirectMethods: false },
      ).map((item) => item.method),
    ).toEqual([PaymentMethod.CASH, PaymentMethod.CUSTOMER_WALLET]);
  });
});

function adapters(
  modes: { momo?: PaymentAdapterMode; vnpay?: PaymentAdapterMode } = {},
): PaymentAdapter[] {
  return [
    adapter(PaymentMethod.CASH, 'INTERNAL'),
    adapter(PaymentMethod.CUSTOMER_WALLET, 'INTERNAL'),
    adapter(PaymentMethod.MOMO, modes.momo ?? 'PLACEHOLDER'),
    adapter(PaymentMethod.VNPAY, modes.vnpay ?? 'PLACEHOLDER'),
    adapter(PaymentMethod.CARD, 'PLACEHOLDER'),
  ];
}

function adapter(method: PaymentMethod, mode: PaymentAdapterMode): PaymentAdapter {
  return { method, mode } as PaymentAdapter;
}
