import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';

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

export function PayoutServiceEvidenceSection({
  batchCount,
  currency,
  items,
}: PayoutServiceEvidenceSectionProps) {
  return (
    <AdminTablePanel
      description="Shows which service duration options are inside payout batches, so finance can reconcile partner net, HANDS fee, tax withholding, and cash wallet debt before bank transfer."
      resultLabel={`${items.length} option(s)`}
      resultTone={items.length > 0 ? 'info' : 'warning'}
      title="Payout service evidence"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/services">
          Review service pricing
        </AdminTextLink>
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
          <strong>
            <MoneyText amount={sumEvidence(items, 'grossAmount')} currency={currency} />
          </strong>
        </div>
        <div>
          <span>Partner net</span>
          <strong>
            <MoneyText amount={sumEvidence(items, 'netAmount')} currency={currency} />
          </strong>
        </div>
        <div>
          <span>Platform fee</span>
          <strong>
            <MoneyText amount={sumEvidence(items, 'platformFee')} currency={currency} />
          </strong>
        </div>
        <div>
          <span>Tax withheld</span>
          <strong>
            <MoneyText amount={sumEvidence(items, 'withholdingAmount')} currency={currency} />
          </strong>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No payout batch has linked service evidence yet."
          headers={[
            'Service option',
            'Batches',
            'Earnings',
            'Gross',
            'Partner net',
            'Platform fee',
            'Tax',
            'Cash debt',
          ]}
          rowCount={items.length}
        >
          {items.map((item) => (
            <tr key={item.key}>
              <td>
                <strong>{item.label}</strong>
                <p className="muted">{item.groupKey}</p>
              </td>
              <td>{item.batchCount}</td>
              <td>{item.earningCount}</td>
              <td>
                <MoneyText amount={item.grossAmount} currency={item.currency} />
              </td>
              <td>
                <MoneyText amount={item.netAmount} currency={item.currency} />
              </td>
              <td>
                <MoneyText amount={item.platformFee} currency={item.currency} />
              </td>
              <td>
                <MoneyText amount={item.withholdingAmount} currency={item.currency} />
              </td>
              <td>
                <StatusBadge tone={item.cashDebtAmount ? 'danger' : 'success'}>
                  <MoneyText amount={item.cashDebtAmount} currency={item.currency} />
                </StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

function sumEvidence(
  items: readonly PayoutServiceEvidenceItem[],
  field: 'grossAmount' | 'netAmount' | 'platformFee' | 'withholdingAmount',
) {
  return items.reduce((sum, item) => sum + item[field], 0);
}
