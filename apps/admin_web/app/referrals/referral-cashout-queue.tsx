import { ActionMenuDropdownForm, ActionMenuDropdownSurface } from '../../components/action-menu';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminTableSection } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { AdminPageTemplate, type AdminPageMetric } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import type {
  AdminReferralAudience,
  AdminReferralCashoutPayoutProfile,
  AdminReferralCashoutQueueRow,
  AdminReferralCashoutQueueSummary,
  AdminReferralRewardStatus,
} from '../../lib/admin-api';
import { readSearchParam } from '../../lib/date-range';
import { referralRewardCreditState } from '../../lib/referral-reward-credit-state';
import {
  approveReferralRewardCashout,
  markReferralRewardCashoutPaid,
  requestReferralCashoutBankCorrection,
  requireReferralRewardTaxReview,
} from './actions';

export type ReferralCashoutAudienceFilter = 'all' | 'customer' | 'partner';
export type ReferralCashoutStatusFilter = 'needs-action' | 'all' | 'requested' | 'approved' | 'tax-review' | 'paid';

export type ReferralCashoutFilters = {
  readonly audience: ReferralCashoutAudienceFilter;
  readonly q: string;
  readonly status: ReferralCashoutStatusFilter;
};

type ReferralCashoutQueuePageProps = {
  readonly currentPage: number;
  readonly filters: ReferralCashoutFilters;
  readonly rows: readonly AdminReferralCashoutQueueRow[];
  readonly summary: AdminReferralCashoutQueueSummary;
};

type ReferralCashoutAction = {
  readonly action: (formData: FormData) => Promise<void>;
  readonly formNoValidate?: boolean;
  readonly label: string;
};

const referralCashoutPageSize = 10;
const referralCashoutHeaders = [
  'Requested',
  'Audience',
  'Parent',
  'Referred',
  'Amount',
  'Payout profile',
  'State',
  'Latest decision',
  'Actions',
];

const emptyReferralCashoutSummary: AdminReferralCashoutQueueSummary = {
  totalAmount: 0,
  totalCount: 0,
  statusSummaries: [
    { amount: 0, count: 0, status: 'requested' },
    { amount: 0, count: 0, status: 'approved' },
    { amount: 0, count: 0, status: 'tax-review' },
    { amount: 0, count: 0, status: 'paid' },
  ],
};

export function ReferralCashoutQueuePage({
  currentPage,
  filters,
  rows,
  summary,
}: ReferralCashoutQueuePageProps) {
  const totalPages = Math.max(1, Math.ceil(summary.totalCount / referralCashoutPageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = rows.length === 0 ? 0 : (activePage - 1) * referralCashoutPageSize + 1;
  const endItem = rows.length === 0 ? 0 : startItem + rows.length - 1;
  const metrics: AdminPageMetric[] = [
    {
      label: 'Cashout rows',
      value: summary.totalCount,
      helper: 'Bounded referral reward queue, not full parent account payload.',
    },
    {
      label: 'Cashout exposure',
      value: <MoneyText amount={summary.totalAmount} fallback="0 VND" />,
      helper: 'Total amount in the current cashout filter.',
    },
    {
      label: 'Needs action',
      value: referralCashoutNeedsActionCount(summary),
      helper: 'Requested, approved, or tax-review cashouts before paid closeout.',
    },
  ];

  return (
    <AdminPageTemplate
      title="Referral Cashouts"
      description="Finance queue for referral wallet cashout requests, tax-review holds, and manual paid closeout."
      metrics={metrics}
      actions={
        <AdminFormControlLink className="button-secondary" href="/referrals/customers">
          Customer referrals
        </AdminFormControlLink>
      }
    >
      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16"
        resultLabel={`${summary.totalCount} cashout(s)`}
        resultTone="info"
        title="Referral cashout filters"
      >
        <AdminFormGrid method="get">
          <AdminFormSearch defaultValue={filters.q} label="Search cashouts" name="q" placeholder="Search parent, referred, booking, reward" />
          <AdminFormSelect
            defaultValue={filters.audience}
            label="Audience"
            name="audience"
            options={[
              { label: 'All audiences', value: 'all' },
              { label: 'Customers', value: 'customer' },
              { label: 'Partners', value: 'partner' },
            ]}
          />
          <AdminFormSelect
            defaultValue={filters.status}
            label="Cashout state"
            name="status"
            options={[
              { label: 'Needs action', value: 'needs-action' },
              { label: 'All cashouts', value: 'all' },
              { label: 'Requested', value: 'requested' },
              { label: 'Approved', value: 'approved' },
              { label: 'Tax review', value: 'tax-review' },
              { label: 'Paid', value: 'paid' },
            ]}
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Apply filters
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href="/referrals/cashouts">
            Reset
          </AdminFormControlLink>
        </AdminFormGrid>
        <AdminSegmentedControl
          activeValue={filters.status}
          ariaLabel="Referral cashout queue summary"
          className="referral-reward-queue"
          options={summary.statusSummaries.map((item) => ({
            href: buildReferralCashoutListHref(filters, { status: item.status }, 1),
            label: (
              <>
                <span>{referralCashoutStatusFilterLabel(item.status)}</span>
                <strong>
                  {item.count} · <MoneyText amount={item.amount} fallback="0 VND" />
                </strong>
              </>
            ),
            value: item.status,
          }))}
        />
      </AdminFilterPanel>

      <AdminTableSection
        actions={<StatusBadge tone="neutral">{rows.length} shown</StatusBadge>}
        bodyClassName="booking-monitor"
        className="booking-monitor-filter-panel admin-mt-16"
        description="Open only the parent detail when deeper attribution evidence is needed."
        title="Referral cashout queue"
      >
          <AdminTableScroll>
            <AdminDataTable
              className="vuexy-booking-table"
              emptyMessage="No referral cashouts match the current filters."
              headers={referralCashoutHeaders}
              rowCount={rows.length}
            >
              {rows.map((row) => (
                <ReferralCashoutTableRow key={row.id} row={row} />
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          <AdminTablePaginationFooter
            activePage={activePage}
            ariaLabel="Referral cashout queue pages"
            from={startItem}
            hrefForPage={(page) => buildReferralCashoutListHref(filters, {}, page)}
            to={endItem}
            totalPages={totalPages}
            totalRows={summary.totalCount}
          />
      </AdminTableSection>
    </AdminPageTemplate>
  );
}

function ReferralCashoutTableRow({ row }: { readonly row: AdminReferralCashoutQueueRow }) {
  const creditState = referralRewardCreditState(row);

  return (
    <tr>
      <td>
        <AdminTextLink href={row.detailHref}>
          {shortRewardId(row.id)}
        </AdminTextLink>
        <div className="muted">
          <DateTimeText value={row.createdAt} />
        </div>
        {row.qualifyingBookingId ? (
          <AdminTextLink href={`/bookings/${encodeURIComponent(row.qualifyingBookingId)}`}>
            Booking {shortRewardId(row.qualifyingBookingId)}
          </AdminTextLink>
        ) : null}
      </td>
      <td>{referralCashoutAudienceLabel(row.audience)}</td>
      <td>
        <ReferralCashoutPersonCell person={row.parent} />
      </td>
      <td>
        <ReferralCashoutPersonCell person={row.referred} />
      </td>
      <td>
        <strong>
          <MoneyText amount={row.amount} currency={row.currency} fallback="0 VND" />
        </strong>
        {row.walletLedgerReference ? (
          <div className="muted">{row.walletLedgerReference}</div>
        ) : (
          <AdminInlineFallback className="admin-mt-6">No wallet credit yet</AdminInlineFallback>
        )}
      </td>
      <td>
        <ReferralCashoutPayoutProfileCell profile={row.payoutProfile} />
      </td>
      <td>
        <StatusBadge tone={creditState.tone}>{creditState.label}</StatusBadge>
        <div className="muted">{creditState.helper}</div>
      </td>
      <td>
        {row.latestDecision ? (
          <>
            <strong>{row.latestDecision.actor?.fullName ?? row.latestDecision.actor?.phone ?? 'Admin'}</strong>
            <div className="muted">{row.latestDecision.reason ?? row.latestDecision.action}</div>
            <div className="muted">
              <DateTimeText value={row.latestDecision.createdAt} />
            </div>
          </>
        ) : (
          <AdminInlineFallback>No decision yet</AdminInlineFallback>
        )}
      </td>
      <td>
        <ReferralCashoutActions row={row} />
      </td>
    </tr>
  );
}

function ReferralCashoutPersonCell({ person }: { readonly person: AdminReferralCashoutQueueRow['parent'] }) {
  const content = (
    <>
      <strong>{person.label}</strong>
      {person.phone ? <span className="muted">{person.phone}</span> : null}
    </>
  );

  return person.href ? (
    <AdminTextLink className="admin-person-cell-link" href={person.href}>
      {content}
    </AdminTextLink>
  ) : (
    <span className="admin-person-cell-link">{content}</span>
  );
}

function ReferralCashoutPayoutProfileCell({ profile }: { readonly profile: AdminReferralCashoutPayoutProfile }) {
  const account = profile.account;

  return (
    <div className="referral-cashout-payout-profile">
      <StatusBadge tone={referralCashoutPayoutProfileTone(profile.status)}>{profile.label}</StatusBadge>
      {account ? (
        <div className="admin-mt-6">
          <strong>{account.bankName}</strong>
          <div className="muted">
            {account.accountNumberMasked ?? account.accountNumberLast4 ?? 'Masked account unavailable'}
          </div>
          <div className="muted">{account.accountHolderName}</div>
          {account.updatedAt ? (
            <div className="muted">
              Updated <DateTimeText value={account.updatedAt} />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="muted">{profile.helper}</div>
    </div>
  );
}

function referralCashoutPayoutProfileTone(status: AdminReferralCashoutPayoutProfile['status']): StatusBadgeTone {
  if (status === 'READY' || status === 'WALLET_ONLY') return 'success';
  if (status === 'CORRECTION_REQUIRED' || status === 'MISSING') return 'danger';
  return 'warning';
}

function ReferralCashoutActions({ row }: { readonly row: AdminReferralCashoutQueueRow }) {
  const actions = referralCashoutActionsForRow(row);
  if (actions.length === 0) {
    return <span className="muted">Closed</span>;
  }
  const bankAccountId = referralCashoutBankCorrectionAccountId(row);

  return (
    <ActionMenuDropdownSurface
      className="referral-reward-action-dropdown"
      label={`Referral cashout actions for ${row.id}`}
      menuClassName="action-menu-panel referral-reward-action-panel"
      title="Cashout actions"
    >
      <ActionMenuDropdownForm action={actions[0]?.action} className="referral-reward-action-form">
        <input name="audience" type="hidden" value={row.audience === 'PARTNER' ? 'partner' : 'customer'} />
        <input name="parentId" type="hidden" value={row.parent.id} />
        <input name="rewardId" type="hidden" value={row.id} />
        {bankAccountId ? <input name="bankAccountId" type="hidden" value={bankAccountId} /> : null}
        <div className="referral-reward-action-reason">
          <span>Reason</span>
          <AdminFormInput
            className="referral-reward-action-reason-input"
            label="Cashout decision reason"
            name="reason"
            placeholder="Operator decision reason"
          />
        </div>
        {row.status === 'CASHOUT_APPROVED' ? (
          <>
            <div className="referral-reward-action-reason">
              <span>Approving admin</span>
              <AdminFormInput
                className="referral-reward-action-reason-input"
                label="Approving admin id"
                name="approvalAdminId"
                placeholder="Different admin user id"
                required
              />
            </div>
            <div className="referral-reward-action-reason">
              <span>Transfer reference</span>
              <AdminFormInput
                className="referral-reward-action-reason-input"
                label="Transfer reference"
                name="transferRef"
                placeholder="Bank transfer reference"
                required
              />
            </div>
          </>
        ) : null}
        <div className="referral-reward-action-button-list">
          {actions.map((item) => (
            <AdminFormControlButton
              className="button-secondary admin-action-item admin-action-button"
              formAction={item.action}
              formNoValidate={item.formNoValidate}
              key={item.label}
              role="menuitem"
              type="submit"
            >
              <span>{item.label}</span>
            </AdminFormControlButton>
          ))}
        </div>
      </ActionMenuDropdownForm>
    </ActionMenuDropdownSurface>
  );
}

function referralCashoutActionsForRow(row: AdminReferralCashoutQueueRow) {
  const actions = referralCashoutActionsForStatus(row.status);
  if (referralCashoutBankCorrectionAccountId(row)) {
    actions.push({
      action: requestReferralCashoutBankCorrection,
      formNoValidate: true,
      label: 'Request bank correction',
    });
  }
  return actions;
}

function referralCashoutActionsForStatus(status: AdminReferralRewardStatus): ReferralCashoutAction[] {
  if (status === 'CASHOUT_REQUESTED') {
    return [
      { action: approveReferralRewardCashout, label: 'Approve cashout' },
      { action: requireReferralRewardTaxReview, label: 'Require tax review' },
    ];
  }
  if (status === 'CASHOUT_APPROVED') {
    return [
      { action: markReferralRewardCashoutPaid, label: 'Mark paid' },
      { action: requireReferralRewardTaxReview, label: 'Require tax review' },
    ];
  }
  return [];
}

function referralCashoutBankCorrectionAccountId(row: AdminReferralCashoutQueueRow) {
  if (row.payoutProfile.type !== 'PROVIDER_BANK_ACCOUNT') return null;
  if (row.payoutProfile.status !== 'CORRECTION_REQUIRED' && row.payoutProfile.status !== 'NEEDS_REVIEW') return null;
  return row.payoutProfile.account?.id ?? null;
}

export function buildReferralCashoutFilters(
  params: Record<string, string | string[] | undefined>,
): ReferralCashoutFilters {
  return {
    audience: normalizeReferralCashoutAudienceFilter(readSearchParam(params.audience)),
    q: readSearchParam(params.q),
    status: normalizeReferralCashoutStatusFilter(readSearchParam(params.status)),
  };
}

export function buildReferralCashoutPage(params: Record<string, string | string[] | undefined>) {
  const page = Number.parseInt(readSearchParam(params.page), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildReferralCashoutApiHref(filters: ReferralCashoutFilters, currentPage: number) {
  const params = new URLSearchParams();
  const page = Math.max(1, Math.trunc(currentPage));
  const skip = (page - 1) * referralCashoutPageSize;
  params.set('take', String(referralCashoutPageSize));
  if (skip > 0) params.set('skip', String(skip));
  appendReferralCashoutApiFilterParams(params, filters);

  return `/admin/referrals/cashouts?${params.toString()}`;
}

export function buildReferralCashoutSummaryApiHref(filters: ReferralCashoutFilters) {
  const params = new URLSearchParams();
  appendReferralCashoutApiFilterParams(params, filters);
  const query = params.toString();
  return query ? `/admin/referrals/cashouts/summary?${query}` : '/admin/referrals/cashouts/summary';
}

export function referralCashoutSummaryFallback(): AdminReferralCashoutQueueSummary {
  return emptyReferralCashoutSummary;
}

function buildReferralCashoutListHref(
  filters: ReferralCashoutFilters,
  overrides: Partial<ReferralCashoutFilters> = {},
  page = 1,
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.audience !== 'all') params.set('audience', next.audience);
  if (next.status !== 'needs-action') params.set('status', next.status);
  if (next.q) params.set('q', next.q);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/referrals/cashouts?${query}` : '/referrals/cashouts';
}

function appendReferralCashoutApiFilterParams(params: URLSearchParams, filters: ReferralCashoutFilters) {
  if (filters.audience !== 'all') params.set('audience', filters.audience);
  if (filters.status !== 'needs-action') params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
}

function referralCashoutNeedsActionCount(summary: AdminReferralCashoutQueueSummary) {
  return summary.statusSummaries
    .filter((item) => item.status !== 'paid')
    .reduce((total, item) => total + item.count, 0);
}

function referralCashoutAudienceLabel(audience: AdminReferralAudience) {
  return audience === 'PARTNER' ? 'Partner' : 'Customer';
}

function referralCashoutStatusFilterLabel(status: ReferralCashoutStatusFilter | AdminReferralCashoutQueueSummary['statusSummaries'][number]['status']) {
  if (status === 'requested') return 'Requested';
  if (status === 'approved') return 'Cashout approved';
  if (status === 'tax-review') return 'Tax review';
  if (status === 'paid') return 'Paid';
  if (status === 'all') return 'All cashouts';
  return 'Needs action';
}

function normalizeReferralCashoutAudienceFilter(value: string): ReferralCashoutAudienceFilter {
  if (value === 'customer' || value === 'partner') return value;
  return 'all';
}

function normalizeReferralCashoutStatusFilter(value: string): ReferralCashoutStatusFilter {
  if (
    value === 'all' ||
    value === 'requested' ||
    value === 'approved' ||
    value === 'tax-review' ||
    value === 'paid'
  ) {
    return value;
  }
  return 'needs-action';
}

function shortRewardId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}
