import { CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { AdminTablePaginationFooter } from '../../components/admin-data-table';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminNoticeCard } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type {
  AdminManualWalletAdjustmentDirection,
  AdminManualWalletAdjustmentOwnerType,
  AdminManualWalletAdjustmentPreview,
  AdminManualWalletAdjustmentRow,
  AdminManualWalletAdjustmentSummary,
  AdminManualWalletAdjustmentType,
} from '../../lib/admin-api';
import { adminGet, adminPost } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
import { FinanceDataTable } from '../finance-tax/finance-data-table';
import { createManualWalletAdjustment } from './actions';

type WalletAdjustmentsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ownerOptions: Array<{ label: string; value: AdminManualWalletAdjustmentOwnerType }> = [
  { label: 'Partner wallet', value: 'PARTNER' },
  { label: 'Customer wallet', value: 'CUSTOMER' },
];

const directionOptions: Array<{ label: string; value: AdminManualWalletAdjustmentDirection }> = [
  { label: 'Credit wallet', value: 'CREDIT' },
  { label: 'Debit wallet', value: 'DEBIT' },
];

const adjustmentTypeOptions: Array<{ label: string; value: AdminManualWalletAdjustmentType }> = [
  { label: 'Promotion credit', value: 'PROMOTION_CREDIT' },
  { label: 'Customer compensation', value: 'CUSTOMER_COMPENSATION' },
  { label: 'Partner bonus', value: 'PARTNER_BONUS' },
  { label: 'Referral correction', value: 'REFERRAL_CORRECTION' },
  { label: 'Error correction', value: 'ERROR_CORRECTION' },
  { label: 'Penalty', value: 'PENALTY' },
  { label: 'Receivable write-off', value: 'RECEIVABLE_WRITE_OFF' },
  { label: 'Manual reversal', value: 'MANUAL_REVERSAL' },
  { label: 'Cash booking deduction - blocked here', value: 'CASH_BOOKING_DEDUCTION' },
];
const WALLET_ADJUSTMENT_HISTORY_TAKE = 25;
const WALLET_ADJUSTMENT_HISTORY_MAX_TAKE = 100;

export default async function WalletAdjustmentsPage({ searchParams }: WalletAdjustmentsPageProps) {
  const params = searchParams ? await searchParams : {};
  const formState = readWalletAdjustmentFormState(params);
  const historyFilters = readWalletAdjustmentHistoryFilters(params);
  const notice = walletAdjustmentNotice(readParam(params, 'adjustmentNotice'));
  const [preview, adjustmentRows, adjustmentSummary] = await Promise.all([
    formState.intent === 'preview' ? fetchPreview(formState) : Promise.resolve(null),
    fetchAdjustmentHistory(formState, historyFilters),
    fetchAdjustmentHistorySummary(formState),
  ]);
  const currency = preview?.currency ?? 'VND';
  const adjustmentTotal = walletAdjustmentSummaryTotal(adjustmentSummary);
  const historyPagination = buildWalletAdjustmentHistoryPagination(
    adjustmentRows,
    historyFilters,
    adjustmentTotal,
  );

  return (
    <AdminPageTemplate
      description="Manual wallet credits, debits, reversals, approval evidence, and accounting preview. This workspace never moves bank or cash accounts."
      metrics={[
        {
          helper: 'Preview from NestJS before any write',
          label: 'Business boundary',
          value: 'API preview',
        },
        {
          helper: 'Manual adjustments do not create platform fee revenue',
          label: 'Revenue impact',
          value: preview?.affects.revenue ? 'Review' : 'None',
        },
        {
          helper: 'Output VAT belongs to booking settlement, not manual wallet edits',
          label: 'Tax impact',
          value: preview?.affects.taxPayable ? 'Review' : 'None',
        },
        {
          helper: 'High amount or tax-sensitive corrections require evidence',
          label: 'Attachment',
          value: preview?.requiresAttachment ? 'Required' : 'Conditional',
        },
      ]}
      title="Wallet Adjustments"
    >
      {notice ? (
        <AdminNoticeCard
          className="admin-mb-16"
          role="status"
          tone={notice.tone === 'success' ? 'success' : 'danger'}
        >
          <div>
            <h2>{notice.title}</h2>
            <p className="muted">{notice.detail}</p>
          </div>
          <StatusBadge tone={notice.tone}>{notice.badge}</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      <AdminFilterPanel
        description="Enter the customer or partner profile id, preview the accounting impact, then create only after approval evidence is ready."
        resultLabel={preview ? 'Preview ready' : 'Preview required'}
        resultTone={preview ? 'success' : 'warning'}
        title="Manual adjustment request"
      >
        <AdminFormGrid method="get">
          <input name="intent" type="hidden" value="preview" />
          <AdminFormSelect
            defaultValue={formState.ownerType}
            label="Wallet owner type"
            name="ownerType"
            options={ownerOptions}
          />
          <AdminFormInput
            defaultValue={formState.ownerId}
            label="Owner profile id"
            name="ownerId"
            placeholder="customer or partner profile id"
            required
          />
          <AdminFormSelect
            defaultValue={formState.direction}
            label="Adjustment direction"
            name="direction"
            options={directionOptions}
          />
          <AdminFormSelect
            defaultValue={formState.adjustmentType}
            label="Adjustment type"
            name="adjustmentType"
            options={adjustmentTypeOptions}
          />
          <AdminFormInput
            defaultValue={formState.amount}
            label="Amount"
            min={1}
            name="amount"
            placeholder="Amount in VND"
            required
            step={1}
            type="number"
          />
          <AdminFormInput
            defaultValue={formState.monthlyPeriod}
            label="Monthly period"
            name="monthlyPeriod"
            placeholder="YYYY-MM"
          />
          <AdminFormInput
            defaultValue={formState.approvalId}
            label="Approval id"
            name="approvalId"
            placeholder="Required before create"
          />
          <AdminFormInput
            defaultValue={formState.approvalAdminId}
            label="Approving admin id"
            name="approvalAdminId"
            placeholder="Different admin user id"
          />
          <AdminFormInput
            defaultValue={formState.attachmentUrl}
            label="Attachment URL"
            name="attachmentUrl"
            placeholder="Evidence URL for high-risk adjustments"
          />
          <AdminFormTextarea
            className="admin-grid-span-2"
            defaultValue={formState.reason}
            label="Reason"
            name="reason"
            placeholder="Operational reason visible in audit log"
            required
            rows={3}
          />
          <AdminFormControlButton>Preview accounting</AdminFormControlButton>
        </AdminFormGrid>
        <AdjustmentPolicyChecklist />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description={
          formState.ownerId
            ? `Showing recent manual wallet adjustments for ${formState.ownerType.toLowerCase()} ${formState.ownerId}.`
            : 'Showing the latest manual wallet adjustments only. Use owner id to narrow the list before reviewing old data.'
        }
        resultLabel={`${adjustmentTotal} total`}
        resultTone={adjustmentTotal > 0 ? 'info' : 'warning'}
        title="Manual adjustment history"
      >
        <FinanceDataTable
          emptyMessage="No manual wallet adjustment ledger rows found for this filter."
          headers={['Created', 'Owner', 'Adjustment', 'Amount', 'Approval', 'Balance', 'Reason']}
          rowCount={historyPagination.rows.length}
        >
          {historyPagination.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{formatDateTime(row.createdAt)}</strong>
                <p className="muted">{row.ledgerType}</p>
              </td>
              <td>
                <strong>{row.ownerLabel}</strong>
                <p className="muted">
                  {row.ownerType} / {row.ownerPhone}
                </p>
              </td>
              <td>
                <StatusBadge tone={row.direction === 'CREDIT' ? 'success' : 'warning'}>
                  {row.direction}
                </StatusBadge>
                <p className="muted admin-mt-6">{row.adjustmentType}</p>
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.amount} currency={row.currency} />
                </strong>
                <p className="muted">
                  Delta <MoneyText amount={row.walletDelta} currency={row.currency} />
                </p>
              </td>
              <td>
                <strong>{row.approvalId ?? 'Missing approval'}</strong>
                <p className="muted">
                  {row.approvalAdminId ? `Approved by ${row.approvalAdminId}` : 'Approving admin not stored'}
                </p>
                <p className="muted">{row.attachmentUrl ? 'Attachment saved' : 'No attachment'}</p>
              </td>
              <td>
                <strong>{formatBalanceChange(row)}</strong>
                <p className="muted">{walletImpactLabel(row)}</p>
              </td>
              <td>{row.reason ?? 'No reason stored'}</td>
            </tr>
          ))}
        </FinanceDataTable>
        <AdminTablePaginationFooter
          activePage={historyPagination.page}
          ariaLabel="Manual wallet adjustment history pages"
          from={historyPagination.from}
          hrefForPage={(page) => walletAdjustmentHistoryPageHref(formState, historyFilters, page)}
          to={historyPagination.to}
          totalPages={historyPagination.totalPages}
          totalRows={historyPagination.totalRows}
        />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mt-16"
        description="The preview below is returned by the NestJS Admin API. Create writes a wallet ledger entry plus admin audit log."
        resultLabel={preview ? 'No direct DB write' : 'Waiting'}
        resultTone={preview ? 'success' : 'info'}
        title="Accounting preview"
      >
        {preview ? (
          <div className="setup-stage-list">
            <PreviewFact
              helper={
                <>
                  <MoneyText amount={preview.beforeBalance} currency={currency} /> to{' '}
                  <MoneyText amount={preview.afterBalance} currency={currency} />
                </>
              }
              icon={<ShieldCheck aria-hidden="true" size={18} />}
              label="Wallet balance"
              value={<MoneyText amount={preview.walletDelta} currency={currency} />}
            />
            <PreviewFact
              helper="Manual wallet adjustment only"
              icon={<CheckCircle2 aria-hidden="true" size={18} />}
              label="Bank/Cash"
              value={preview.affects.bankCash ? 'Review required' : 'No bank/cash movement'}
            />
            <PreviewFact
              helper={
                <>
                  Platform revenue: <MoneyText amount={preview.platformRevenueAmount} currency={currency} />
                </>
              }
              icon={<CheckCircle2 aria-hidden="true" size={18} />}
              label="Output VAT"
              value={
                preview.companyOutputVat > 0 ? (
                  <MoneyText amount={preview.companyOutputVat} currency={currency} />
                ) : (
                  'No output VAT'
                )
              }
            />
            <PreviewFact
              helper={preview.requiresAttachment ? 'Attach approval/evidence before create' : 'Approval id still required'}
              icon={<FileWarning aria-hidden="true" size={18} />}
              label="Approval gate"
              value={preview.requiresAttachment ? 'Attachment required' : 'Attachment optional'}
            />
          </div>
        ) : (
          <p className="muted">Preview an adjustment to see before/after balance, ledger allocation, tax, revenue, and attachment gates.</p>
        )}
      </AdminFilterPanel>

      {preview ? (
        <AdminFilterPanel
          className="admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
          description="Debit and credit legs are shown as an operator preview. No booking revenue or company VAT is created here."
          footer={
            <CreateAdjustmentForm
              formState={formState}
              preview={preview}
            />
          }
          resultLabel={preview.requiresApproval ? 'Approval required' : undefined}
          resultTone="warning"
          title="Accounting entries"
        >
          <FinanceDataTable
            emptyMessage="No accounting entries returned."
            headers={['Debit account', 'Credit account', 'Amount']}
            rowCount={preview.accountingEntries.length}
          >
            {preview.accountingEntries.map((entry) => (
              <tr key={`${entry.accountDebit}:${entry.accountCredit}:${entry.amount}`}>
                <td>
                  <strong>{formatAccountName(entry.accountDebit)}</strong>
                  <p className="muted">{entry.accountDebit}</p>
                </td>
                <td>
                  <strong>{formatAccountName(entry.accountCredit)}</strong>
                  <p className="muted">{entry.accountCredit}</p>
                </td>
                <td>
                  <MoneyText amount={entry.amount} currency={currency} />
                </td>
              </tr>
            ))}
          </FinanceDataTable>
        </AdminFilterPanel>
      ) : null}
    </AdminPageTemplate>
  );
}

function AdjustmentPolicyChecklist() {
  return (
    <div className="setup-stage-list admin-mt-16" aria-label="Manual wallet adjustment policy gates">
      <PreviewFact
        helper="Approval id and a different approving admin id are required for every creation"
        icon={<ShieldCheck aria-hidden="true" size={18} />}
        label="Approval gate"
        value="Required"
      />
      <PreviewFact
        helper="Evidence is required from 10.000.000 VND or more"
        icon={<FileWarning aria-hidden="true" size={18} />}
        label="High amount evidence"
        value="10.000.000 VND"
      />
      <PreviewFact
        helper="Receivable write-off always needs evidence"
        icon={<FileWarning aria-hidden="true" size={18} />}
        label="Tax-sensitive adjustment"
        value="Evidence"
      />
    </div>
  );
}

function PreviewFact({
  helper,
  icon,
  label,
  value,
}: {
  readonly helper: React.ReactNode;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div className="setup-stage-item">
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p className="muted">{helper}</p>
      </div>
      <small>{value}</small>
    </div>
  );
}

function CreateAdjustmentForm({
  formState,
  preview,
}: {
  readonly formState: WalletAdjustmentFormState;
  readonly preview: AdminManualWalletAdjustmentPreview;
}) {
  const missingRequiredAttachment = preview.requiresAttachment && !formState.attachmentUrl;
  const missingApproval = !formState.approvalId;
  const missingApprovalAdmin = !formState.approvalAdminId;
  const bookingSettlementOnly = preview.adjustmentType === 'CASH_BOOKING_DEDUCTION';
  const blockedAccountingImpact =
    bookingSettlementOnly ||
    preview.affects.revenue ||
    preview.affects.taxPayable ||
    preview.affects.bankCash;

  return (
    <AdminFormShell action={createManualWalletAdjustment} className="participant-list">
      <HiddenAdjustmentInputs formState={formState} />
      {blockedAccountingImpact ? (
        <StatusBadge tone="danger">Blocked accounting impact</StatusBadge>
      ) : null}
      {bookingSettlementOnly ? <StatusBadge tone="danger">Use booking settlement</StatusBadge> : null}
      {missingRequiredAttachment ? <StatusBadge tone="warning">Attachment required</StatusBadge> : null}
      {missingApproval ? <StatusBadge tone="warning">Approval id required</StatusBadge> : null}
      {missingApprovalAdmin ? <StatusBadge tone="warning">Approving admin id required</StatusBadge> : null}
      <AdminFormControlButton
        disabled={missingApproval || missingApprovalAdmin || missingRequiredAttachment || blockedAccountingImpact}
      >
        Create manual adjustment
      </AdminFormControlButton>
    </AdminFormShell>
  );
}

function HiddenAdjustmentInputs({ formState }: { readonly formState: WalletAdjustmentFormState }) {
  return (
    <>
      {[
        ['ownerType', formState.ownerType],
        ['ownerId', formState.ownerId],
        ['direction', formState.direction],
        ['adjustmentType', formState.adjustmentType],
        ['amount', formState.amount],
        ['approvalAdminId', formState.approvalAdminId],
        ['approvalId', formState.approvalId],
        ['reason', formState.reason],
        ['monthlyPeriod', formState.monthlyPeriod],
        ['attachmentUrl', formState.attachmentUrl],
      ].map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
    </>
  );
}

async function fetchPreview(formState: WalletAdjustmentFormState) {
  if (!formState.ownerId || !formState.amount || !formState.reason) {
    return null;
  }

  return adminPost<AdminManualWalletAdjustmentPreview | null>(
    '/admin/wallet-adjustments/preview',
    {
      adjustmentType: formState.adjustmentType,
      amount: Number(formState.amount),
      ...(formState.approvalAdminId ? { approvalAdminId: formState.approvalAdminId } : {}),
      ...(formState.approvalId ? { approvalId: formState.approvalId } : {}),
      ...(formState.attachmentUrl ? { attachmentUrl: formState.attachmentUrl } : {}),
      direction: formState.direction,
      ...(formState.monthlyPeriod ? { monthlyPeriod: formState.monthlyPeriod } : {}),
      ownerId: formState.ownerId,
      ownerType: formState.ownerType,
      reason: formState.reason,
    },
    null,
  );
}

async function fetchAdjustmentHistory(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  return adminGet<AdminManualWalletAdjustmentRow[]>(
    buildAdjustmentHistoryHref(formState, historyFilters),
    [],
  );
}

async function fetchAdjustmentHistorySummary(formState: WalletAdjustmentFormState) {
  return adminGet<AdminManualWalletAdjustmentSummary>(
    buildAdjustmentHistorySummaryHref(formState),
    { total: 0 },
  );
}

function buildAdjustmentHistoryHref(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  const params = new URLSearchParams();
  if (formState.ownerId) {
    params.set('ownerType', formState.ownerType);
    params.set('ownerId', formState.ownerId);
  }
  params.set('take', String(historyFilters.pageSize));
  const skip = (historyFilters.page - 1) * historyFilters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }
  return `/admin/wallet-adjustments?${params.toString()}`;
}

function buildAdjustmentHistorySummaryHref(formState: WalletAdjustmentFormState) {
  const params = new URLSearchParams();
  if (formState.ownerId) {
    params.set('ownerType', formState.ownerType);
    params.set('ownerId', formState.ownerId);
  }
  const query = params.toString();
  return query ? `/admin/wallet-adjustments/summary?${query}` : '/admin/wallet-adjustments/summary';
}

type WalletAdjustmentHistoryFilters = {
  readonly page: number;
  readonly pageSize: number;
};

type WalletAdjustmentFormState = {
  readonly adjustmentType: AdminManualWalletAdjustmentType;
  readonly amount: string;
  readonly approvalAdminId: string;
  readonly approvalId: string;
  readonly attachmentUrl: string;
  readonly direction: AdminManualWalletAdjustmentDirection;
  readonly intent: string;
  readonly monthlyPeriod: string;
  readonly ownerId: string;
  readonly ownerType: AdminManualWalletAdjustmentOwnerType;
  readonly reason: string;
};

function readWalletAdjustmentFormState(params: Record<string, string | string[] | undefined>): WalletAdjustmentFormState {
  return {
    adjustmentType: readParam(params, 'adjustmentType', 'PARTNER_BONUS') as AdminManualWalletAdjustmentType,
    amount: readParam(params, 'amount'),
    approvalAdminId: readParam(params, 'approvalAdminId'),
    approvalId: readParam(params, 'approvalId'),
    attachmentUrl: readParam(params, 'attachmentUrl'),
    direction: readParam(params, 'direction', 'CREDIT') as AdminManualWalletAdjustmentDirection,
    intent: readParam(params, 'intent'),
    monthlyPeriod: readParam(params, 'monthlyPeriod'),
    ownerId: readParam(params, 'ownerId'),
    ownerType: readParam(params, 'ownerType', 'PARTNER') as AdminManualWalletAdjustmentOwnerType,
    reason: readParam(params, 'reason'),
  };
}

function readWalletAdjustmentHistoryFilters(
  params: Record<string, string | string[] | undefined>,
): WalletAdjustmentHistoryFilters {
  return {
    page: readPositiveIntParam(params, 'page', 1),
    pageSize: Math.min(
      readPositiveIntParam(params, 'pageSize', WALLET_ADJUSTMENT_HISTORY_TAKE),
      WALLET_ADJUSTMENT_HISTORY_MAX_TAKE,
    ),
  };
}

function buildWalletAdjustmentHistoryPagination(
  rows: readonly AdminManualWalletAdjustmentRow[],
  filters: WalletAdjustmentHistoryFilters,
  totalRows: number,
) {
  const safeTotalRows = Number.isFinite(totalRows) ? Math.max(0, Math.trunc(totalRows)) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

function walletAdjustmentSummaryTotal(summary: AdminManualWalletAdjustmentSummary) {
  return typeof summary.total === 'number' && Number.isFinite(summary.total)
    ? Math.max(0, Math.trunc(summary.total))
    : 0;
}

function walletAdjustmentHistoryPageHref(
  formState: WalletAdjustmentFormState,
  filters: WalletAdjustmentHistoryFilters,
  page: number,
) {
  const params = new URLSearchParams();
  if (formState.ownerId) {
    params.set('ownerType', formState.ownerType);
    params.set('ownerId', formState.ownerId);
  }
  if (filters.pageSize !== WALLET_ADJUSTMENT_HISTORY_TAKE) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `/wallet-adjustments?${query}` : '/wallet-adjustments';
}

function readParam(params: Record<string, string | string[] | undefined>, key: string, fallback = '') {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);
}

function readPositiveIntParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback: number,
) {
  const value = Number.parseInt(readParam(params, key), 10);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function formatAccountName(value: string) {
  return value
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatBalanceChange(row: AdminManualWalletAdjustmentRow) {
  if (typeof row.beforeBalance !== 'number' || typeof row.afterBalance !== 'number') {
    return 'Balance preview unavailable';
  }

  return (
    <>
      <MoneyText amount={row.beforeBalance} currency={row.currency} /> -&gt;{' '}
      <MoneyText amount={row.afterBalance} currency={row.currency} />
    </>
  );
}

function walletImpactLabel(row: AdminManualWalletAdjustmentRow) {
  const impacts = [
    row.affects?.walletLiability ? 'wallet liability' : null,
    row.affects?.partnerReceivable ? 'partner receivable' : null,
    row.affects?.expense ? 'expense' : null,
    row.affects?.revenue ? 'revenue review' : null,
    row.affects?.taxPayable ? 'tax review' : null,
  ].filter(Boolean);

  return impacts.length > 0 ? impacts.join(', ') : 'No accounting impact metadata';
}

function walletAdjustmentNotice(notice: string) {
  if (notice === 'created') {
    return {
      badge: 'Saved',
      detail: 'Wallet ledger and admin audit log were written through the Admin API.',
      title: 'Manual adjustment created',
      tone: 'success' as const,
    };
  }

  if (notice === 'admin-auth') {
    return {
      badge: 'Auth',
      detail: 'Admin API credentials are missing or expired. Refresh the admin session before trying again.',
      title: 'Manual adjustment was not saved',
      tone: 'danger' as const,
    };
  }

  if (notice === 'failed') {
    return {
      badge: 'Blocked',
      detail: 'No wallet ledger was written. Check owner id, approval id, attachment, and closed-period rules.',
      title: 'Manual adjustment was not saved',
      tone: 'danger' as const,
    };
  }

  if (notice === 'approval-required') {
    return {
      badge: 'Approval',
      detail: 'No wallet ledger was written. Every manual wallet adjustment needs an approval id.',
      title: 'Approval id is required',
      tone: 'danger' as const,
    };
  }

  if (notice === 'approval-admin-required') {
    return {
      badge: 'Approval',
      detail: 'No wallet ledger was written. A different approving admin id is required.',
      title: 'Approving admin id is required',
      tone: 'danger' as const,
    };
  }

  if (notice === 'attachment-required') {
    return {
      badge: 'Evidence',
      detail:
        'No wallet ledger was written. High amount adjustments and receivable write-offs need an attachment URL.',
      title: 'Attachment evidence is required',
      tone: 'danger' as const,
    };
  }

  if (notice === 'attachment-invalid') {
    return {
      badge: 'Evidence',
      detail: 'No wallet ledger was written. Attachment evidence must be a valid http or https URL.',
      title: 'Attachment URL is invalid',
      tone: 'danger' as const,
    };
  }

  if (notice === 'monthly-period-invalid') {
    return {
      badge: 'Period',
      detail: 'No wallet ledger was written. Monthly period must use YYYY-MM before the wallet ledger can be written.',
      title: 'Monthly period is invalid',
      tone: 'danger' as const,
    };
  }

  if (notice === 'settlement-required') {
    return {
      badge: 'Settlement',
      detail:
        'No wallet ledger was written. Cash booking deductions must use booking settlement logic so revenue and tax are calculated correctly.',
      title: 'Use booking settlement instead',
      tone: 'danger' as const,
    };
  }

  return null;
}
