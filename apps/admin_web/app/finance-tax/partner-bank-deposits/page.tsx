import { BanknoteArrowDown, CircleCheckBig, CircleX, ReceiptText } from 'lucide-react';

import {
  type AdminPartnerBankDepositRequestHistory,
  type AdminPartnerBankDepositReconciliationStatus,
  type AdminPartnerBankDepositRequestStatus,
  adminGet,
} from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFinanceOperatorEvidence } from '../../../components/admin-finance-operator-evidence';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge } from '../../../components/status-badge';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';

type PartnerBankDepositsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 25;
const EMPTY_HISTORY: AdminPartnerBankDepositRequestHistory = {
  items: [],
  pagination: { skip: 0, take: PAGE_SIZE, total: 0 },
  statusCounts: {},
  reconciliationSummary: { openAmount: 0, openCount: 0, period: null },
};

export default async function PartnerBankDepositsPage({ searchParams }: PartnerBankDepositsPageProps) {
  const params = searchParams ? await searchParams : {};
  const page = positiveInteger(readParam(params.page), 1);
  const status = normalizeStatus(readParam(params.status));
  const owner = normalizeOwner(readParam(params.owner));
  const sla = normalizeSla(readParam(params.sla));
  const requestedReview = normalizeReview(readParam(params.review));
  const review = requestedReview || owner || sla ? 'needs-reconciliation' : '';
  const period = normalizePeriod(readParam(params.period));
  const q = readParam(params.q).trim();
  const currentOperatorAccess = owner === 'mine' ? await getCurrentAdminOperatorAccess() : null;
  const query = new URLSearchParams({ take: String(PAGE_SIZE), skip: String((page - 1) * PAGE_SIZE) });
  if (status) query.set('status', status);
  if (review) query.set('review', review);
  if (owner === 'unassigned') query.set('owner', 'unassigned');
  if (owner === 'mine' && currentOperatorAccess?.id) {
    query.set('assigneeAdminId', currentOperatorAccess.id);
  }
  if (sla) query.set('sla', sla);
  if (period) query.set('period', period);
  if (q) query.set('q', q);
  const history = await adminGet<AdminPartnerBankDepositRequestHistory>(
    `/admin/provider-wallet/deposit-requests/history?${query.toString()}`,
    EMPTY_HISTORY,
  );
  const totalPages = Math.max(1, Math.ceil(history.pagination.total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = history.pagination.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(history.pagination.total, (safePage - 1) * PAGE_SIZE + history.items.length);

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/cash-settlements">Cash debt</AdminFormControlLink>
          <AdminFormControlLink href="/finance-tax/approval-queue">Approval queue</AdminFormControlLink>
        </>
      }
      description="Approved bank evidence, Partner wallet impact, GL posting, and explicit cash-debt allocation history."
      metrics={[
        {
          icon: ReceiptText,
          kind: 'action',
          label: 'Pending approval',
          scope: 'Needs action',
          value: history.statusCounts.REQUESTED ?? 0,
        },
        {
          icon: CircleCheckBig,
          kind: 'period',
          label: 'Executed deposits',
          scope: 'Records',
          value: history.statusCounts.EXECUTED ?? 0,
        },
        {
          icon: CircleX,
          kind: 'record',
          label: 'Rejected requests',
          scope: 'History',
          value: history.statusCounts.REJECTED ?? 0,
        },
        {
          icon: BanknoteArrowDown,
          kind: history.reconciliationSummary.openCount > 0 ? 'risk' : 'record',
          label: 'Needs reconciliation',
          scope: period ? `Period ${period}` : 'All records',
          value: history.reconciliationSummary.openCount,
          helper: `${formatVnd(history.reconciliationSummary.openAmount)} remains unmatched to company bank evidence.`,
        },
      ]}
      title="Partner Bank Deposits"
    >
      <AdminFilterPanel
        className="admin-mb-16"
        description="Search by Partner, request ID, or bank transaction reference. Results are paginated on the server."
        resultLabel={`${history.pagination.total} request(s)`}
        resultTone={history.statusCounts.REQUESTED ? 'warning' : 'info'}
        title="Deposit history filters"
      >
        <AdminFormShell action="/finance-tax/partner-bank-deposits" className="filter-form" method="get">
          <AdminFormSearch
            defaultValue={q}
            label="Search deposits"
            name="q"
            placeholder="Partner, request, bank reference"
          />
          <AdminFormSelect
            defaultValue={status}
            label="Deposit status"
            name="status"
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Pending approval', value: 'REQUESTED' },
              { label: 'Executed', value: 'EXECUTED' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Cancelled', value: 'CANCELLED' },
            ]}
          />
          <AdminFormSelect
            defaultValue={owner}
            label="Review owner"
            name="owner"
            options={[
              { label: 'All owners', value: '' },
              { label: 'Unassigned', value: 'unassigned' },
              { label: 'Assigned to me', value: 'mine' },
            ]}
          />
          <AdminFormSelect
            defaultValue={sla}
            label="Reconciliation SLA"
            name="sla"
            options={[
              { label: 'All SLA states', value: '' },
              { label: 'Within 24 hours', value: 'within-24h' },
              { label: 'Over 24 hours', value: 'over-24h' },
              { label: 'Escalate after 48 hours', value: 'escalate' },
            ]}
          />
          <AdminFormSelect
            defaultValue={review}
            label="Bank reconciliation"
            name="review"
            options={[
              { label: 'All reconciliation states', value: '' },
              { label: 'Needs reconciliation', value: 'needs-reconciliation' },
            ]}
          />
          {period ? <input name="period" type="hidden" value={period} /> : null}
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink href="/finance-tax/partner-bank-deposits">Clear</AdminFormControlLink>
        </AdminFormShell>
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Open a request to inspect attachment evidence, wallet entry, balanced journal, and cash-debt allocations."
        resultLabel={`${from}-${to} of ${history.pagination.total}`}
        resultTone="info"
        title="Deposit requests"
      >
        <FinanceDataTable
          emptyMessage="No Partner bank deposits match the current filters."
          headers={['Partner', 'Bank evidence', 'Amount', 'Receivable allocation', 'Bank reconciliation', 'Status', 'Timeline', 'Evidence']}
          rowCount={history.items.length}
        >
          {history.items.map((request) => {
            const allocatedAmount = request.allocatedCashDebtAmount ?? 0;
            return (
              <tr key={request.id}>
                <td>
                  <AdminTextLink href={`/partners/${request.providerProfileId}?section=full`}>
                    <strong>{request.providerProfile?.displayName ?? request.providerProfile?.user?.fullName ?? 'Partner'}</strong>
                  </AdminTextLink>
                  <div className="muted">{request.providerProfile?.user?.phone ?? request.providerProfileId}</div>
                </td>
                <td>
                  <AdminTextLink href={`/finance-tax/partner-bank-deposits/${request.id}`}>
                    <strong>{request.bankTransactionId}</strong>
                  </AdminTextLink>
                  <div className="muted">Request {shortId(request.id)}</div>
                </td>
                <td><MoneyText amount={request.amount} currency={request.currency} /></td>
                <td>
                  <strong><MoneyText amount={allocatedAmount} currency={request.currency} /></strong>
                  <div className="muted">
                    of <MoneyText amount={request.requestedReceivableRecovery} currency={request.currency} /> recoverable
                  </div>
                </td>
                <td>
                  <ReconciliationStatus status={request.reconciliationStatus ?? 'NOT_APPLICABLE'} />
                  {request.reconciliationStatus !== 'NOT_APPLICABLE' ? (
                    <>
                      <div className="muted">
                        <MoneyText
                          amount={request.reconciliationRemainingAmount ?? request.amount}
                          currency={request.currency}
                        />{' '}
                        remaining
                      </div>
                      <div className="admin-mt-8">
                        <ReconciliationSla
                          status={request.reconciliationSlaStatus}
                          waitingHours={request.reconciliationWaitingHours}
                        />
                      </div>
                      <div className="muted">
                        Owner {request.reconciliationReviewAssignment?.assignee.fullName ??
                          request.reconciliationReviewAssignment?.assignee.email ??
                          request.reconciliationReviewAssignment?.assignee.id ??
                          'Unassigned'}
                      </div>
                    </>
                  ) : null}
                </td>
                <td>
                  <DepositStatus status={request.status} />
                  <AdminFinanceOperatorEvidence
                    lines={[
                      {
                        fallbackId: request.requestedByAdminId,
                        key: 'requested-by',
                        label: 'Requested by',
                        operator: request.requestedBy,
                      },
                      ...(request.status === 'EXECUTED'
                        ? [{
                            fallbackId: request.approvedByAdminId,
                            key: 'approved-executed-by',
                            label: 'Approved & executed by',
                            operator: request.approvedBy,
                          }]
                        : []),
                      ...(request.status === 'REJECTED'
                        ? [{
                            fallbackId: request.rejectedByAdminId,
                            key: 'rejected-by',
                            label: 'Rejected by',
                            operator: request.rejectedBy,
                          }]
                        : []),
                    ]}
                  />
                </td>
                <td>
                  <DateTimeText value={request.depositDate} />
                  <div className="muted">Recorded <DateTimeText value={request.createdAt} /></div>
                  {request.executedAt ? (
                    <div className="muted">Executed <DateTimeText value={request.executedAt} /></div>
                  ) : null}
                  {request.rejectedAt ? (
                    <div className="muted">Rejected <DateTimeText value={request.rejectedAt} /></div>
                  ) : null}
                </td>
                <td>
                  <AdminTextLink href={`/finance-tax/partner-bank-deposits/${request.id}`}>Open evidence</AdminTextLink>
                </td>
              </tr>
            );
          })}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Partner bank deposit history pagination"
          hrefForPage={(nextPage) => historyHref({ owner, page: nextPage, period, q, review, sla, status })}
          pagination={{ from, page: safePage, to, totalPages, totalRows: history.pagination.total }}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function DepositStatus({ status }: { readonly status: AdminPartnerBankDepositRequestStatus }) {
  const tone = status === 'EXECUTED' ? 'success' : status === 'REQUESTED' ? 'warning' : status === 'REJECTED' ? 'danger' : 'neutral';
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function ReconciliationStatus({
  status,
}: {
  readonly status: AdminPartnerBankDepositReconciliationStatus;
}) {
  const tone = status === 'MATCHED'
    ? 'success'
    : status === 'PARTIALLY_MATCHED'
      ? 'warning'
      : status === 'UNMATCHED'
        ? 'danger'
        : 'neutral';
  return <StatusBadge tone={tone}>{status.replaceAll('_', ' ')}</StatusBadge>;
}

function ReconciliationSla({
  status,
  waitingHours,
}: {
  readonly status?: AdminPartnerBankDepositRequestHistory['items'][number]['reconciliationSlaStatus'];
  readonly waitingHours?: number | null;
}) {
  const tone = status === 'ESCALATE'
    ? 'danger'
    : status === 'OVER_24H'
      ? 'warning'
      : status === 'RECONCILED'
        ? 'success'
        : 'info';
  const label = status === 'ESCALATE'
    ? `ESCALATE · ${waitingHours ?? 48}H`
    : status === 'OVER_24H'
      ? `OVER 24H · ${waitingHours ?? 24}H`
      : status === 'RECONCILED'
        ? 'RECONCILED'
        : `WITHIN 24H · ${waitingHours ?? 0}H`;
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function historyHref(input: {
  owner: string;
  page: number;
  period: string;
  q: string;
  review: string;
  sla: string;
  status: string;
}) {
  const query = new URLSearchParams();
  if (input.page > 1) query.set('page', String(input.page));
  if (input.q) query.set('q', input.q);
  if (input.review) query.set('review', input.review);
  if (input.owner) query.set('owner', input.owner);
  if (input.sla) query.set('sla', input.sla);
  if (input.period) query.set('period', input.period);
  if (input.status) query.set('status', input.status);
  const suffix = query.toString();
  return suffix ? `/finance-tax/partner-bank-deposits?${suffix}` : '/finance-tax/partner-bank-deposits';
}

function normalizeReview(value: string) {
  return value === 'needs-reconciliation' ? value : '';
}

function normalizeOwner(value: string) {
  return value === 'unassigned' || value === 'mine' ? value : '';
}

function normalizeSla(value: string) {
  return value === 'within-24h' || value === 'over-24h' || value === 'escalate' ? value : '';
}

function normalizePeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '';
}

function normalizeStatus(value: string): AdminPartnerBankDepositRequestStatus | '' {
  return ['REQUESTED', 'EXECUTED', 'REJECTED', 'CANCELLED'].includes(value)
    ? (value as AdminPartnerBankDepositRequestStatus)
    : '';
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}
