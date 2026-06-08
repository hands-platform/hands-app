import { formatMoney } from '../lib/admin-format';

type MoneyTextProps = {
  readonly amount?: number | null;
  readonly currency?: string;
  readonly fallback?: string;
};

export function moneyTextClassName(amount?: number | null) {
  if (amount === undefined || amount === null) {
    return 'money-text money-text-muted';
  }
  if (amount < 0) {
    return 'money-text money-text-negative';
  }
  if (amount > 0) {
    return 'money-text money-text-positive';
  }
  return 'money-text money-text-zero';
}

export function MoneyText({ amount, currency = 'VND', fallback = 'Not set' }: MoneyTextProps) {
  return <span className={moneyTextClassName(amount)}>{formatMoney(amount, currency, fallback)}</span>;
}
