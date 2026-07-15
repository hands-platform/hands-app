import { PaymentMethod } from '@prisma/client';
import type { PaymentAdapter } from './payment-adapter';

export type CustomerCheckoutMethod = {
  method: PaymentMethod;
  label: string;
  requiresRedirect: boolean;
};

const checkoutLabels: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.CASH]: 'Cash',
  [PaymentMethod.MOMO]: 'MoMo',
  [PaymentMethod.VNPAY]: 'VNPay',
  [PaymentMethod.CARD]: 'Card',
};

export function availableCustomerCheckoutMethods(
  adapters: readonly PaymentAdapter[],
  options: {
    isProduction: boolean;
    allowPlaceholder: boolean;
    allowRedirectMethods: boolean;
  },
): CustomerCheckoutMethod[] {
  return adapters.flatMap((adapter) => {
    const label = checkoutLabels[adapter.method];
    const redirectFlowAvailable = adapter.mode === 'INTERNAL' || options.allowRedirectMethods;
    const available =
      label !== undefined &&
      redirectFlowAvailable &&
      (adapter.mode !== 'PLACEHOLDER' || (!options.isProduction && options.allowPlaceholder));

    return available
      ? [
          {
            method: adapter.method,
            label,
            requiresRedirect: adapter.mode !== 'INTERNAL',
          },
        ]
      : [];
  });
}
