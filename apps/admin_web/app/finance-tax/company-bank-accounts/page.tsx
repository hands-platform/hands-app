import type { AdminCompanyBankAccount } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { formatWholeNumber } from '../../../lib/admin-format';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { StatusBadge } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceTablePanel } from '../finance-table-panel';

export default async function CompanyBankAccountsPage() {
  const accounts = await adminGet<AdminCompanyBankAccount[]>('/admin/company-bank-accounts?status=ALL', []);
  const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length;
  const inactiveCount = Math.max(accounts.length - activeCount, 0);

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button button-outline" href="/finance-tax/bank-reconciliation">
          Open bank reconciliation
        </AdminFormControlLink>
      }
      description="Read-only operating view for company settlement bank accounts used by manual transaction import and reconciliation evidence."
      metrics={[
        {
          helper: 'Company bank accounts returned by the bounded admin API.',
          label: 'Total accounts',
          value: formatWholeNumber(accounts.length),
        },
        {
          helper: 'Accounts available for bank transaction import and reconciliation matching.',
          label: 'Active accounts',
          value: formatWholeNumber(activeCount),
        },
        {
          helper: 'Accounts retained for audit history but not used for new import flows.',
          label: 'Inactive accounts',
          value: formatWholeNumber(inactiveCount),
        },
      ]}
      title="Company Bank Accounts"
    >
      <FinanceTablePanel
        grouped
        description="Bank account management is read-only until create/update API approval is added. Use this page to confirm which accounts can be selected during bank reconciliation import."
        resultLabel={`${formatWholeNumber(accounts.length)} account(s)`}
        resultTone="info"
        title="Bank account management"
      >
        <FinanceDataTable
          emptyMessage="No company bank accounts were returned by the bounded admin API."
          headers={['Account', 'Bank', 'Masked number', 'Currency', 'Status']}
          rowCount={accounts.length}
        >
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <strong>{account.name}</strong>
                <span className="muted">#{account.id}</span>
              </td>
              <td>{account.bankName}</td>
              <td>{account.accountNumberMasked ?? account.accountNumberLast4 ?? 'Not provided'}</td>
              <td>{account.currency}</td>
              <td>
                <StatusBadge tone={statusTone(account.status)}>{account.status}</StatusBadge>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function statusTone(status: string) {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}
