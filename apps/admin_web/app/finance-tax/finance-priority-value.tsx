import type { ReactNode } from 'react';

import { MoneyText } from '../../components/money-text';

type FinancePriorityValueInput = {
  readonly amount: number | null;
  readonly amountSuffix: string | null;
  readonly count: number | null;
  readonly currency: string | null;
};

export function renderFinancePriorityValue(link: FinancePriorityValueInput): ReactNode {
  if (typeof link.amount === 'number' && link.currency) {
    return (
      <>
        <MoneyText amount={link.amount} currency={link.currency} />
        {link.amountSuffix ? ` ${link.amountSuffix}` : null}
      </>
    );
  }

  if (typeof link.count === 'number') {
    return `${link.count} open`;
  }

  return 'Open queue';
}

export function hasFinancePriorityWork(link: FinancePriorityValueInput) {
  return (link.count ?? 0) > 0 || Math.abs(link.amount ?? 0) > 0;
}
