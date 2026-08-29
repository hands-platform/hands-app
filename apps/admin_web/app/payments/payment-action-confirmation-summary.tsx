import type { PaymentActionConfirmation } from './payment-action-confirmation';
import { DateTimeText } from '../../components/date-time-text';

export function PaymentActionConfirmationSummary({
  confirmation,
}: {
  readonly confirmation: PaymentActionConfirmation;
}) {
  return (
    <div className="payment-confirmation-summary">
      <p>{confirmation.description}</p>
      <dl>
        {confirmation.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.format === 'datetime' ? <DateTimeText fallback="Not recorded" value={fact.value} /> : fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
