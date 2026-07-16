import { CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { AdminTablePaginationFooter } from '../../components/admin-data-table';

import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../components/admin-filter-summary';
import { AdminFinanceOperatorEvidence } from '../../components/admin-finance-operator-evidence';
import {
  AdminFormControlButton,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminStageItem, AdminStageList } from '../../components/admin-stage-item';
import { AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
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
const WALLET_ADJUSTMENT_HISTORY_TAKE = 10;
const WALLET_ADJUSTMENT_HISTORY_MAX_TAKE = 50;

export default async function WalletAdjustmentsPage({ searchParams }: WalletAdjustmentsPageProps) {
  const params = searchParams ? await searchParams : {};
  const workspaceView = readWalletAdjustmentWorkspaceView(params);
  const formState = readWalletAdjustmentFormState(params);
  const historyFilters = readWalletAdjustmentHistoryFilters(params);
  const notice = walletAdjustmentNotice(readParam(params, 'adjustmentNotice'));
  const [preview, adjustmentRows, adjustmentSummary] = await Promise.all([
    workspaceView === 'request' && formState.intent === 'preview'
      ? fetchPreview(formState)
      : Promise.resolve(null),
    workspaceView === 'records'
      ? fetchAdjustmentHistory(formState, historyFilters)
      : Promise.resolve([] as AdminManualWalletAdjustmentRow[]),
    workspaceView === 'records'
      ? fetchAdjustmentHistorySummary(formState, historyFilters)
      : Promise.resolve({ total: 0 } as AdminManualWalletAdjustmentSummary),
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
      actions={
        <AdminSegmentedControl
          activeValue={workspaceView}
          ariaLabel="Wallet adjustment workspace"
          options={[
            {
              href: walletAdjustmentWorkspaceHref('request', formState, historyFilters),
              label: 'New request',
              value: 'request',
            },
            {
              href: walletAdjustmentWorkspaceHref('records', formState, historyFilters),
              label: 'Records',
              value: 'records',
            },
          ]}
        />
      }
      description="Create an approval-controlled wallet adjustment or inspect immutable wallet and accounting records. Manual adjustments never move bank or cash accounts."
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

      {workspaceView === 'request' ? (
        <AdminSection
          description="Enter the customer or partner profile id, preview the accounting impact, then submit a persistent request for a separate finance approver."
          statusLabel={preview ? 'Preview ready' : 'Preview required'}
          statusTone={preview ? 'success' : 'warning'}
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
          <AdminFilterSummary
            ariaLabel="Active wallet adjustment request filters"
            labels={walletAdjustmentRequestLabels(formState)}
            tone="info"
          />
          <AdjustmentPolicyChecklist />
        </AdminSection>
      ) : null}

      {workspaceView === 'records' ? (
        <>
          <AdminFilterPanel
            className="admin-mb-16"
            description="Filter immutable manual adjustment ledger entries by wallet owner. Results stay server paginated and do not load account balances or unrelated finance evidence."
            resultLabel={`${adjustmentTotal} matching record(s)`}
            resultTone={adjustmentTotal > 0 ? 'info' : 'warning'}
            title="Record filters"
          >
            <AdminFormGrid method="get">
              <input name="view" type="hidden" value="records" />
              <AdminFormSelect
                defaultValue={walletAdjustmentHistoryOwnerType(formState, historyFilters) ?? ''}
                label="Wallet owner"
                name="ownerType"
                options={[{ label: 'All wallet owners', value: '' }, ...ownerOptions]}
              />
              <AdminFormInput
                defaultValue={formState.ownerId}
                label="Owner profile id"
                name="ownerId"
                placeholder="Optional customer or partner profile id"
              />
              <AdminFormSelect
                defaultValue={String(historyFilters.pageSize)}
                label="Rows per page"
                name="pageSize"
                options={[
                  { label: '10 rows', value: '10' },
                  { label: '25 rows', value: '25' },
                  { label: '50 rows', value: '50' },
                ]}
              />
              <AdminFormControlButton>Apply filters</AdminFormControlButton>
            </AdminFormGrid>
            <AdminFilterSummary
              ariaLabel="Active wallet adjustment record filters"
              labels={walletAdjustmentRecordFilterLabels(formState, historyFilters)}
              tone="info"
            />
          </AdminFilterPanel>

          <AdminTablePanel
            description={
              formState.ownerId
                ? `Showing recent manual wallet adjustments for ${formState.ownerType.toLowerCase()} ${formState.ownerId}.`
                : historyFilters.ownerType
                  ? `Showing manual wallet adjustments for ${optionLabel(ownerOptions, historyFilters.ownerType).toLowerCase()} records.`
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
                    <strong>
                      <DateTimeText value={row.createdAt} />
                    </strong>
                    <p className="muted">{row.ledgerType}</p>
                  </td>
                  <td>
                    <strong>{row.ownerLabel}</strong>
                    <p className="muted">{row.ownerType}</p>
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
                    {row.approvalId ? (
                      <strong>{row.approvalId}</strong>
                    ) : (
                      <AdminInlineFallback>Missing approval</AdminInlineFallback>
                    )}
                    <AdminFinanceOperatorEvidence
                      lines={[
                        {
                          fallbackId: row.requestedByAdminId,
                          key: 'requested-by',
                          label: 'Requested by',
                          operator: row.requestedBy,
                        },
                        {
                          fallbackId: row.approvalAdminId,
                          key: 'approved-by',
                          label: 'Approved by',
                          operator: row.approvalAdmin,
                        },
                      ]}
                    />
                    {!row.approvalAdminId ? (
                      <AdminInlineFallback className="admin-mt-6">
                        Approving admin not stored
                      </AdminInlineFallback>
                    ) : null}
                    {row.attachmentUrl ? (
                      <p className="muted">Attachment saved</p>
                    ) : (
                      <AdminInlineFallback className="admin-mt-6">No attachment</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    <strong>{formatBalanceChange(row)}</strong>
                    <p className="muted">{walletImpactLabel(row)}</p>
                  </td>
                  <td>
                    {row.reason ? row.reason : <AdminInlineFallback>No reason stored</AdminInlineFallback>}
                  </td>
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
          </AdminTablePanel>
        </>
      ) : null}

      {workspaceView === 'request' && preview ? (
        <AdminSection
          className="admin-mt-16"
          description="Preview the balance, approval, accounting impact, and audit evidence before saving this adjustment."
          statusLabel={preview ? 'No direct DB write' : 'Waiting'}
          statusTone={preview ? 'success' : 'info'}
          title="Accounting preview"
        >
          <AdminStageList>
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
              helper={
                preview.requiresAttachment
                  ? 'Attach approval/evidence before create'
                  : 'Approval id still required'
              }
              icon={<FileWarning aria-hidden="true" size={18} />}
              label="Approval gate"
              value={preview.requiresAttachment ? 'Attachment required' : 'Attachment optional'}
            />
          </AdminStageList>
        </AdminSection>
      ) : null}

      {preview ? (
        <AdminTablePanel
          description="Debit and credit legs are shown as an operator preview. No booking revenue or company VAT is created here."
          footer={<CreateAdjustmentForm formState={formState} preview={preview} />}
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
        </AdminTablePanel>
      ) : null}
    </AdminPageTemplate>
  );
}

function AdjustmentPolicyChecklist() {
  return (
    <AdminStageList className="admin-mt-16" aria-label="Manual wallet adjustment policy gates">
      <PreviewFact
        helper="A different finance approver must review the saved request before any wallet or ledger write"
        icon={<ShieldCheck aria-hidden="true" size={18} />}
        label="Approval gate"
        value="Separate approver"
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
    </AdminStageList>
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
    <AdminStageItem>
      <span>{icon}</span>
      <div>
        <strong>{label}</strong>
        <p className="muted">{helper}</p>
      </div>
      <small>{value}</small>
    </AdminStageItem>
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
  const bookingSettlementOnly = preview.adjustmentType === 'CASH_BOOKING_DEDUCTION';
  const blockedAccountingImpact =
    bookingSettlementOnly ||
    preview.affects.revenue ||
    preview.affects.taxPayable ||
    preview.affects.bankCash;

  return (
    <AdminFormShell action={createManualWalletAdjustment}>
      <HiddenAdjustmentInputs formState={formState} />
      <AdminFilterChipGroup ariaLabel="Create manual wallet adjustment gates">
        {blockedAccountingImpact ? <StatusBadge tone="danger">Blocked accounting impact</StatusBadge> : null}
        {bookingSettlementOnly ? <StatusBadge tone="danger">Use booking settlement</StatusBadge> : null}
        {missingRequiredAttachment ? <StatusBadge tone="warning">Attachment required</StatusBadge> : null}
        <AdminFormControlButton disabled={missingRequiredAttachment || blockedAccountingImpact}>
          Submit for approval
        </AdminFormControlButton>
      </AdminFilterChipGroup>
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

async function fetchAdjustmentHistorySummary(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  return adminGet<AdminManualWalletAdjustmentSummary>(
    buildAdjustmentHistorySummaryHref(formState, historyFilters),
    { total: 0 },
  );
}

function buildAdjustmentHistoryHref(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  const params = new URLSearchParams();
  const ownerType = walletAdjustmentHistoryOwnerType(formState, historyFilters);
  if (ownerType) {
    params.set('ownerType', ownerType);
  }
  if (formState.ownerId) {
    params.set('ownerId', formState.ownerId);
  }
  params.set('take', String(historyFilters.pageSize));
  const skip = (historyFilters.page - 1) * historyFilters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }
  return `/admin/wallet-adjustments?${params.toString()}`;
}

function buildAdjustmentHistorySummaryHref(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  const params = new URLSearchParams();
  const ownerType = walletAdjustmentHistoryOwnerType(formState, historyFilters);
  if (ownerType) {
    params.set('ownerType', ownerType);
  }
  if (formState.ownerId) {
    params.set('ownerId', formState.ownerId);
  }
  const query = params.toString();
  return query ? `/admin/wallet-adjustments/summary?${query}` : '/admin/wallet-adjustments/summary';
}

type WalletAdjustmentHistoryFilters = {
  readonly ownerType: AdminManualWalletAdjustmentOwnerType | null;
  readonly page: number;
  readonly pageSize: number;
};

type WalletAdjustmentWorkspaceView = 'request' | 'records';

type WalletAdjustmentFormState = {
  readonly adjustmentType: AdminManualWalletAdjustmentType;
  readonly amount: string;
  readonly attachmentUrl: string;
  readonly direction: AdminManualWalletAdjustmentDirection;
  readonly intent: string;
  readonly monthlyPeriod: string;
  readonly ownerId: string;
  readonly ownerType: AdminManualWalletAdjustmentOwnerType;
  readonly reason: string;
};

function readWalletAdjustmentFormState(
  params: Record<string, string | string[] | undefined>,
): WalletAdjustmentFormState {
  return {
    adjustmentType: readParam(params, 'adjustmentType', 'PARTNER_BONUS') as AdminManualWalletAdjustmentType,
    amount: readParam(params, 'amount'),
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
  const ownerType = readParam(params, 'ownerType');
  return {
    ownerType: ownerOptions.some((option) => option.value === ownerType)
      ? (ownerType as AdminManualWalletAdjustmentOwnerType)
      : null,
    page: readPositiveIntParam(params, 'page', 1),
    pageSize: Math.min(
      readPositiveIntParam(params, 'pageSize', WALLET_ADJUSTMENT_HISTORY_TAKE),
      WALLET_ADJUSTMENT_HISTORY_MAX_TAKE,
    ),
  };
}

function readWalletAdjustmentWorkspaceView(
  params: Record<string, string | string[] | undefined>,
): WalletAdjustmentWorkspaceView {
  const requestedView = readParam(params, 'view');
  if (requestedView === 'records') return 'records';
  if (requestedView === 'request') return 'request';
  return readParam(params, 'ownerType') && !readParam(params, 'ownerId') ? 'records' : 'request';
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
  const params = new URLSearchParams({ view: 'records' });
  const ownerType = walletAdjustmentHistoryOwnerType(formState, filters);
  if (ownerType) {
    params.set('ownerType', ownerType);
  }
  if (formState.ownerId) {
    params.set('ownerId', formState.ownerId);
  }
  if (filters.pageSize !== WALLET_ADJUSTMENT_HISTORY_TAKE) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  return `/wallet-adjustments?${params.toString()}`;
}

function walletAdjustmentRequestLabels(formState: WalletAdjustmentFormState) {
  const labels = [
    `Owner: ${optionLabel(ownerOptions, formState.ownerType)}`,
    `Direction: ${optionLabel(directionOptions, formState.direction)}`,
    `Type: ${optionLabel(adjustmentTypeOptions, formState.adjustmentType)}`,
  ];

  if (formState.ownerId) {
    labels.push(`Owner id: ${formState.ownerId}`);
  }
  if (formState.amount) {
    labels.push(`Amount: ${formState.amount} VND`);
  }
  if (formState.monthlyPeriod) {
    labels.push(`Period: ${formState.monthlyPeriod}`);
  }

  return labels;
}

function walletAdjustmentRecordFilterLabels(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  const ownerType = walletAdjustmentHistoryOwnerType(formState, historyFilters);
  const ownerLabel = ownerType ? optionLabel(ownerOptions, ownerType) : 'All wallet owners';
  const labels = [`Owner: ${ownerLabel}`, `Rows per page: ${historyFilters.pageSize}`];
  if (formState.ownerId) {
    labels.push(`Owner id: ${formState.ownerId}`);
  }
  return labels;
}

function walletAdjustmentWorkspaceHref(
  view: WalletAdjustmentWorkspaceView,
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  const params = new URLSearchParams();
  params.set('view', view);
  const ownerType = walletAdjustmentHistoryOwnerType(formState, historyFilters);
  if (ownerType) {
    params.set('ownerType', ownerType);
  }
  if (formState.ownerId) {
    params.set('ownerId', formState.ownerId);
  }
  if (view === 'records' && historyFilters.pageSize !== WALLET_ADJUSTMENT_HISTORY_TAKE) {
    params.set('pageSize', String(historyFilters.pageSize));
  }
  const query = params.toString();
  return `/wallet-adjustments?${query}`;
}

function walletAdjustmentHistoryOwnerType(
  formState: WalletAdjustmentFormState,
  historyFilters: WalletAdjustmentHistoryFilters,
) {
  return historyFilters.ownerType ?? (formState.ownerId ? formState.ownerType : null);
}

function optionLabel<Value extends string>(
  options: readonly { readonly label: string; readonly value: Value }[],
  value: Value,
) {
  return options.find((option) => option.value === value)?.label ?? value;
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
  if (notice === 'requested') {
    return {
      badge: 'Pending',
      detail:
        'The request is stored in Finance Approval Queue. No wallet or accounting ledger has been written yet.',
      title: 'Manual adjustment submitted',
      tone: 'success' as const,
    };
  }

  if (notice === 'created') {
    return {
      badge: 'Saved',
      detail: 'Wallet impact and admin audit log were written through the Admin API.',
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
      detail: 'No approval request was saved. Check owner id, attachment, and closed-period rules.',
      title: 'Manual adjustment request was not saved',
      tone: 'danger' as const,
    };
  }

  if (notice === 'attachment-required') {
    return {
      badge: 'Evidence',
      detail:
        'No wallet impact record was saved. High amount adjustments and receivable write-offs need an attachment URL.',
      title: 'Attachment evidence is required',
      tone: 'danger' as const,
    };
  }

  if (notice === 'attachment-invalid') {
    return {
      badge: 'Evidence',
      detail: 'No wallet impact record was saved. Attachment evidence must be a valid http or https URL.',
      title: 'Attachment URL is invalid',
      tone: 'danger' as const,
    };
  }

  if (notice === 'monthly-period-invalid') {
    return {
      badge: 'Period',
      detail:
        'No wallet impact record was saved. Monthly period must use YYYY-MM before finance can save it.',
      title: 'Monthly period is invalid',
      tone: 'danger' as const,
    };
  }

  if (notice === 'settlement-required') {
    return {
      badge: 'Settlement',
      detail:
        'No wallet impact record was saved. Cash booking deductions must use booking settlement logic so revenue and tax are calculated correctly.',
      title: 'Use booking settlement instead',
      tone: 'danger' as const,
    };
  }

  return null;
}
