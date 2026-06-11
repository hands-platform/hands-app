import { formatMoney } from '../../lib/admin-format';

export type PayoutServiceEvidenceItem = {
  readonly batchCount: number;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly earningCount: number;
  readonly grossAmount: number;
  readonly groupKey: string;
  readonly key: string;
  readonly label: string;
  readonly netAmount: number;
  readonly platformFee: number;
  readonly withholdingAmount: number;
};

type PayoutServiceEvidenceSectionProps = {
  readonly batchCount: number;
  readonly currency: string;
  readonly items: readonly PayoutServiceEvidenceItem[];
};

export function PayoutServiceEvidenceSection({ batchCount, currency, items }: PayoutServiceEvidenceSectionProps) {
  return (
    <div className="card admin-card-scroll admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Payout service evidence</h2>
          <p className="muted">
            Shows which service duration options are inside payout batches, so finance can reconcile partner
            net, HANDS fee, tax withholding, and cash wallet debt before bank transfer.
          </p>
        </div>
        <a className="text-link" href="/services">
          Review service pricing
        </a>
      </div>
      <div className="service-trace-summary">
        <div>
          <span>Service options</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>Batches</span>
          <strong>{batchCount}</strong>
        </div>
        <div>
          <span>Gross</span>
          <strong>{formatMoney(sumEvidence(items, 'grossAmount'), currency)}</strong>
        </div>
        <div>
          <span>Partner net</span>
          <strong>{formatMoney(sumEvidence(items, 'netAmount'), currency)}</strong>
        </div>
        <div>
          <span>Platform fee</span>
          <strong>{formatMoney(sumEvidence(items, 'platformFee'), currency)}</strong>
        </div>
        <div>
          <span>Tax withheld</span>
          <strong>{formatMoney(sumEvidence(items, 'withholdingAmount'), currency)}</strong>
        </div>
      </div>
      {items.length ? (
        <table className="table service-trace">
          <thead>
            <tr>
              <th>Service option</th>
              <th>Batches</th>
              <th>Earnings</th>
              <th>Gross</th>
              <th>Partner net</th>
              <th>Platform fee</th>
              <th>Tax</th>
              <th>Cash debt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.groupKey}</p>
                </td>
                <td>{item.batchCount}</td>
                <td>{item.earningCount}</td>
                <td>{formatMoney(item.grossAmount, item.currency)}</td>
                <td>{formatMoney(item.netAmount, item.currency)}</td>
                <td>{formatMoney(item.platformFee, item.currency)}</td>
                <td>{formatMoney(item.withholdingAmount, item.currency)}</td>
                <td>
                  <span className={`pill ${item.cashDebtAmount ? 'pill-danger' : 'pill-success'}`}>
                    {formatMoney(item.cashDebtAmount, item.currency)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No payout batch has linked service evidence yet.</p>
      )}
    </div>
  );
}

function sumEvidence(
  items: readonly PayoutServiceEvidenceItem[],
  field: 'grossAmount' | 'netAmount' | 'platformFee' | 'withholdingAmount',
) {
  return items.reduce((sum, item) => sum + item[field], 0);
}
