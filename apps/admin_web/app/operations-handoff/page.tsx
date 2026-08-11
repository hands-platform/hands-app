import { ArrowRightLeft, History, RotateCcw, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormGridFields,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState } from '../../components/admin-surface';
import type {
  AdminOperationsHandoffOpenCasePage,
  AdminOperationsHandoffOperator,
  AdminShiftHandoffPage,
} from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { OperationsShiftHandoffSection } from './operations-shift-handoff-section';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const EMPTY_OPEN_CASES: AdminOperationsHandoffOpenCasePage = {
  items: [],
  openCount: 0,
  pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
};
const EMPTY_HANDOFFS: AdminShiftHandoffPage = {
  items: [],
  openCount: 0,
  pagination: { page: 1, pageSize: 25, totalPages: 1, totalRows: 0 },
  totalCount: 0,
};

export const metadata: Metadata = { title: 'Shift Handoff · HANDS Admin' };

export default async function OperationsHandoffPage({ searchParams }: { searchParams?: SearchParams }) {
  const query = searchParams ? await searchParams : {};
  const view = value(query.view);
  if (view === 'handoff') redirect(canonicalCurrentHref(query));

  return view === 'history' ? HandoffHistory({ query }) : CurrentHandoff({ query });
}

async function CurrentHandoff({ query }: { readonly query: Record<string, string | string[] | undefined> }) {
  const filters = {
    age: value(query.age) || 'all',
    assignedPage: positiveInt(value(query.assignedPage)),
    page: positiveInt(value(query.page)),
    q: value(query.q),
    queue: value(query.queue) || 'all',
    waitingPage: positiveInt(value(query.waitingPage)),
  };
  const currentOperator = await getCurrentAdminOperatorAccess();
  const currentOperatorLabel = operatorLabel(currentOperator);
  if (!currentOperator) {
    return (
      <AdminPageTemplate
        actions={<HandoffViewLinks active="current" />}
        contentClassName="operations-handoff-page"
        description="Transfer unresolved work to the next operator and confirm receipt."
        title="Shift Handoff"
      >
        <AdminErrorState
          action={
            <AdminFormControlLink className="text-link" href={currentHref(filters)}>
              Retry
            </AdminFormControlLink>
          }
          message="Your Admin operator session could not be resolved. Current handoff counts and actions are hidden."
          title="Current operator unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const [assignedResult, waitingResult, openCaseResult, operatorResult] = await Promise.all([
    adminGetResult<AdminShiftHandoffPage>(
      currentHandoffApiHref('assigned', filters.assignedPage),
      EMPTY_HANDOFFS,
    ),
    adminGetResult<AdminShiftHandoffPage>(
      currentHandoffApiHref('waiting', filters.waitingPage),
      EMPTY_HANDOFFS,
    ),
    adminGetResult<AdminOperationsHandoffOpenCasePage>(openCaseApiHref(filters), EMPTY_OPEN_CASES),
    adminGetResult<AdminOperationsHandoffOperator[]>('/admin/operations-handoff/operators', []),
  ]);

  return (
    <AdminPageTemplate
      actions={<HandoffViewLinks active="current" />}
      contentClassName="operations-handoff-page"
      description="Transfer unresolved work to the next operator and confirm receipt."
      title="Shift Handoff"
    >
      {!assignedResult.ok || !waitingResult.ok ? (
        <AdminErrorState
          action={
            <AdminFormControlLink className="text-link" href={currentHref(filters)}>
              Retry
            </AdminFormControlLink>
          }
          message="One or more current handoff queues could not be loaded. Unavailable totals are not shown as zero."
          title="Current handoffs unavailable"
        />
      ) : null}
      <OperationsShiftHandoffSection
        assignedBaseHref={currentHref({ ...filters, assignedPage: 1 })}
        assignedData={assignedResult.ok ? assignedResult.data : undefined}
        currentOperator={{ id: currentOperator.id, label: currentOperatorLabel }}
        defaultShiftLabel={defaultShiftLabel()}
        filterContent={
          <CurrentCaseFilters
            filters={filters}
            result={openCaseResult.ok ? openCaseResult.data.pagination.totalRows : null}
          />
        }
        mode="current"
        openCaseBaseHref={currentHref({ ...filters, page: 1 })}
        openCases={openCaseResult.ok ? openCaseResult.data : undefined}
        operators={operatorResult.data}
        openCasesUnavailable={!openCaseResult.ok}
        operatorsUnavailable={!operatorResult.ok}
        waitingBaseHref={currentHref({ ...filters, waitingPage: 1 })}
        waitingData={waitingResult.ok ? waitingResult.data : undefined}
      />
    </AdminPageTemplate>
  );
}

async function HandoffHistory({ query }: { readonly query: Record<string, string | string[] | undefined> }) {
  const filters = {
    operator: value(query.operator),
    page: positiveInt(value(query.page)),
    q: value(query.q),
    range: historyRange(value(query.range)),
    status: historyStatus(value(query.status)),
  };
  const result = await adminGetResult<AdminShiftHandoffPage>(historyApiHref(filters), EMPTY_HANDOFFS);

  return (
    <AdminPageTemplate
      actions={<HandoffViewLinks active="history" />}
      contentClassName="operations-handoff-page"
      description="Transfer unresolved work to the next operator and confirm receipt."
      title="Shift Handoff"
    >
      <HistoryFilters
        filters={filters}
        result={result.ok ? (result.data.pagination?.totalRows ?? 0) : null}
      />
      {result.ok ? (
        <OperationsShiftHandoffSection
          currentOperator={{ id: null, label: 'Current operator' }}
          data={result.data}
          historyBaseHref={historyHref({ ...filters, page: 1 })}
          mode="history"
        />
      ) : (
        <AdminErrorState
          action={
            <AdminFormControlLink className="text-link" href={historyHref(filters)}>
              Retry
            </AdminFormControlLink>
          }
          message="Handoff history could not be loaded. No empty history is shown."
          title="Handoff history unavailable"
        />
      )}
    </AdminPageTemplate>
  );
}

function HandoffViewLinks({ active }: { readonly active: 'current' | 'history' }) {
  return (
    <>
      <AdminFormControlLink
        aria-current={active === 'current' ? 'page' : undefined}
        className={active === 'current' ? 'button-primary' : 'button-secondary'}
        href="/operations-handoff"
      >
        <ArrowRightLeft aria-hidden="true" size={16} /> Current
      </AdminFormControlLink>
      <AdminFormControlLink
        aria-current={active === 'history' ? 'page' : undefined}
        className={active === 'history' ? 'button-primary' : 'button-secondary'}
        href="/operations-handoff?view=history"
      >
        <History aria-hidden="true" size={16} /> Handoff history
      </AdminFormControlLink>
    </>
  );
}

function CurrentCaseFilters({
  filters,
  result,
}: {
  readonly filters: CurrentFilters;
  readonly result: number | null;
}) {
  return (
    <AdminFilterPanel
      description="Filter the server-backed open-case queue. Changing a filter resets pagination."
      resultLabel={result === null ? 'Unavailable' : `${result} matching`}
      resultTone={result === null ? 'danger' : result ? 'warning' : 'neutral'}
      title="Open case filters"
    >
      <AdminFormGrid
        action="/operations-handoff"
        className="admin-filter-form operations-handoff-filter-form"
        method="get"
      >
        <AdminFormGridFields className="compact-form">
          <AdminFormSearch defaultValue={filters.q} label="Search" name="q" placeholder="Case ID or queue" />
          <AdminFormSelect
            defaultValue={filters.queue}
            label="Queue"
            labelVisibility="visible"
            name="queue"
            options={queueOptions}
          />
          <AdminFormSelect
            defaultValue={filters.age}
            label="Age"
            labelVisibility="visible"
            name="age"
            options={ageOptions}
          />
        </AdminFormGridFields>
        <div className="actions">
          <AdminFormControlButton className="button-primary" type="submit">
            <Search aria-hidden="true" size={16} /> Apply filters
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href="/operations-handoff">
            <RotateCcw aria-hidden="true" size={16} /> Reset
          </AdminFormControlLink>
        </div>
      </AdminFormGrid>
    </AdminFilterPanel>
  );
}

function HistoryFilters({
  filters,
  result,
}: {
  readonly filters: HistoryFilterValues;
  readonly result: number | null;
}) {
  return (
    <AdminFilterPanel
      description="Created date is the range basis. Acknowledgement time remains a separate field."
      resultLabel={result === null ? 'Unavailable' : `${result} records`}
      resultTone={result === null ? 'danger' : 'neutral'}
      title="Handoff history filters"
    >
      <AdminFormGrid
        action="/operations-handoff"
        className="admin-filter-form operations-handoff-filter-form"
        method="get"
      >
        <input name="view" type="hidden" value="history" />
        <AdminFormGridFields className="compact-form">
          <AdminFormSearch
            defaultValue={filters.q}
            label="Search"
            name="q"
            placeholder="Shift, case, operator, or note"
          />
          <AdminFormSearch
            defaultValue={filters.operator}
            label="Operator"
            name="operator"
            placeholder="Name or operator ID"
          />
          <AdminFormSelect
            defaultValue={filters.status}
            label="Status"
            labelVisibility="visible"
            name="status"
            options={statusOptions}
          />
          <AdminFormSelect
            defaultValue={filters.range}
            label="Created range"
            labelVisibility="visible"
            name="range"
            options={rangeOptions}
          />
        </AdminFormGridFields>
        <div className="actions">
          <AdminFormControlButton className="button-primary" type="submit">
            <Search aria-hidden="true" size={16} /> Apply filters
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href="/operations-handoff?view=history">
            <RotateCcw aria-hidden="true" size={16} /> Reset
          </AdminFormControlLink>
        </div>
      </AdminFormGrid>
    </AdminFilterPanel>
  );
}

type CurrentFilters = {
  age: string;
  assignedPage: number;
  page: number;
  q: string;
  queue: string;
  waitingPage: number;
};
type HistoryFilterValues = { operator: string; page: number; q: string; range: string; status: string };

const queueOptions = [
  { label: 'All permitted queues', value: 'all' },
  { label: 'Payment holds', value: 'payment-holds' },
  { label: 'Cancellation review', value: 'cancellation-review' },
  { label: 'Refund review', value: 'refund-review' },
  { label: 'Matching delays', value: 'matching-delays' },
  { label: 'Partner approvals', value: 'partner-approvals' },
  { label: 'Cash reconciliation', value: 'cash-reconciliation' },
  { label: 'Notification failures', value: 'notification-failures' },
];
const ageOptions = [
  { label: 'All ages', value: 'all' },
  { label: 'Under 1 hour', value: 'under-1h' },
  { label: '1–4 hours', value: '1-4h' },
  { label: '4–24 hours', value: '4-24h' },
  { label: 'Over 24 hours', value: 'over-24h' },
];
const statusOptions = [
  { label: 'All handoffs', value: 'all' },
  { label: 'Waiting', value: 'open' },
  { label: 'Acknowledged', value: 'acknowledged' },
];
const rangeOptions = [
  { label: 'Today (Vietnam)', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All records', value: 'all' },
];

function openCaseApiHref(filters: CurrentFilters) {
  const query = new URLSearchParams({
    age: filters.age,
    page: String(filters.page),
    pageSize: '25',
    queue: filters.queue,
  });
  if (filters.q) query.set('q', filters.q);
  return `/admin/operations-handoff/open-cases?${query}`;
}

function currentHandoffApiHref(relationship: 'assigned' | 'waiting', page: number) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: '25',
    relationship,
    scope: 'current',
    status: 'open',
  });
  return `/admin/operations-handoff/shift?${query}`;
}

function currentHref(filters: CurrentFilters) {
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.queue !== 'all') query.set('queue', filters.queue);
  if (filters.age !== 'all') query.set('age', filters.age);
  if (filters.page > 1) query.set('page', String(filters.page));
  if (filters.assignedPage > 1) query.set('assignedPage', String(filters.assignedPage));
  if (filters.waitingPage > 1) query.set('waitingPage', String(filters.waitingPage));
  const value = query.toString();
  return value ? `/operations-handoff?${value}` : '/operations-handoff';
}

function historyApiHref(filters: HistoryFilterValues) {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: '25',
    range: filters.range,
    status: filters.status,
  });
  if (filters.q) query.set('q', filters.q);
  if (filters.operator) query.set('operator', filters.operator);
  return `/admin/operations-handoff/shift?${query}`;
}

function historyHref(filters: HistoryFilterValues) {
  const query = new URLSearchParams({ view: 'history' });
  if (filters.q) query.set('q', filters.q);
  if (filters.operator) query.set('operator', filters.operator);
  if (filters.status !== 'all') query.set('status', filters.status);
  if (filters.range !== '7d') query.set('range', filters.range);
  if (filters.page > 1) query.set('page', String(filters.page));
  return `/operations-handoff?${query}`;
}

function canonicalCurrentHref(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, input]) => {
    if (key === 'view') return;
    const next = value(input);
    if (next) params.set(key, next);
  });
  const search = params.toString();
  return search ? `/operations-handoff?${search}` : '/operations-handoff';
}

function defaultShiftLabel() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(new Date());
  return `${parts} Vietnam shift`;
}

function operatorLabel(
  operator: {
    email?: string | null;
    fullName?: string | null;
    id: string;
    phone?: string | null;
    roles?: readonly string[];
  } | null,
) {
  if (!operator) return 'Current Admin session';
  const identity = operator.email ?? operator.phone ?? operator.id;
  const role = operator.roles?.includes('MASTER_ADMIN') ? 'Master Admin' : 'Admin';
  return operator.fullName && operator.fullName !== identity
    ? `${operator.fullName} · ${role} · ${identity}`
    : `${role} · ${identity}`;
}

function value(input: string | string[] | undefined) {
  return (Array.isArray(input) ? input[0] : input)?.trim() ?? '';
}

function positiveInt(input: string) {
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function historyRange(input: string) {
  return ['today', '30d', 'all'].includes(input) ? input : '7d';
}

function historyStatus(input: string) {
  return ['open', 'acknowledged'].includes(input) ? input : 'all';
}
