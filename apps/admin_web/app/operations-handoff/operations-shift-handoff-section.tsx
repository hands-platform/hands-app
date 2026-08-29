'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminFormControlButton, AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminErrorState, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/admin-format';
import type {
  AdminOperationsHandoffOpenCasePage,
  AdminOperationsHandoffOperator,
  AdminShiftHandoff,
  AdminShiftHandoffPage,
} from '../../lib/admin-api';
import { acknowledgeOperationsShiftHandoff, type OperationsHandoffActionState } from './actions';
import { OperationsShiftHandoffForm } from './operations-shift-handoff-form';

type CurrentHandoffProps = {
  readonly assignedBaseHref?: string;
  readonly assignedData?: AdminShiftHandoffPage;
  readonly currentOperator: { id: string; label: string };
  readonly defaultShiftLabel?: string;
  readonly filterContent?: ReactNode;
  readonly mode: 'current';
  readonly openCaseBaseHref?: string;
  readonly openCases?: AdminOperationsHandoffOpenCasePage;
  readonly openCasesUnavailable?: boolean;
  readonly operators?: readonly AdminOperationsHandoffOperator[];
  readonly operatorsUnavailable?: boolean;
  readonly waitingBaseHref?: string;
  readonly waitingData?: AdminShiftHandoffPage;
};

type HandoffHistoryProps = {
  readonly currentOperator: { id: null; label: string };
  readonly data: AdminShiftHandoffPage;
  readonly historyBaseHref?: string;
  readonly mode: 'history';
};

type OperationsShiftHandoffSectionProps = CurrentHandoffProps | HandoffHistoryProps;

export function OperationsShiftHandoffSection(props: OperationsShiftHandoffSectionProps) {
  return props.mode === 'history' ? <ShiftHandoffHistory {...props} /> : <CurrentShiftHandoff {...props} />;
}

function CurrentShiftHandoff(props: CurrentHandoffProps) {
  const assignedTotal = handoffTotal(props.assignedData);
  const waitingTotal = handoffTotal(props.waitingData);
  const queuesAvailable = assignedTotal !== null && waitingTotal !== null;
  const showNoOpenHandoffs =
    queuesAvailable &&
    assignedTotal === 0 &&
    waitingTotal === 0 &&
    props.openCases?.openCount !== 0;

  return (
    <>
      <AdminSection
        description="Follow-up responsibility is recorded here. Source cases remain owned by their original queues."
        id="current-shift-handoff-summary"
        statusLabel="Current"
        statusTone="neutral"
        title="Current shift summary"
      >
        <div className="operations-handoff-summary-strip">
          <HandoffSummaryValue label="Assigned to me" value={assignedTotal} />
          <HandoffSummaryValue label="Waiting for others" value={waitingTotal} />
          <HandoffSummaryValue label="Open cases" value={props.openCases?.openCount ?? null} />
        </div>
        {showNoOpenHandoffs ? (
          <AdminEmptyState
            framed
            message="No open handoff is assigned to you or waiting for another operator."
            title="No open handoffs"
          />
        ) : null}
      </AdminSection>

      {assignedTotal ? (
        <CurrentHandoffQueue
          currentOperatorId={props.currentOperator.id}
          data={props.assignedData!}
          pageBaseHref={props.assignedBaseHref ?? '/operations-handoff'}
          pageParam="assignedPage"
          title="Assigned to me"
        />
      ) : null}
      {waitingTotal ? (
        <CurrentHandoffQueue
          currentOperatorId={props.currentOperator.id}
          data={props.waitingData!}
          pageBaseHref={props.waitingBaseHref ?? '/operations-handoff'}
          pageParam="waitingPage"
          title="Waiting for others"
        />
      ) : null}

      {props.openCases?.openCount === 0 ? null : props.filterContent}
      <AdminSection
        description="Choose who receives the shift and which open cases need follow-up."
        id="create-shift-handoff"
        statusLabel={props.openCases ? `${props.openCases.openCount} open cases` : 'Unavailable'}
        statusTone={props.openCases?.openCount ? 'warning' : 'neutral'}
        title="Create handoff"
      >
        {props.openCasesUnavailable ? (
          <AdminErrorState
            message="Open cases could not be loaded. Retry before sending a handoff."
            title="Open cases unavailable"
          />
        ) : null}
        {props.operatorsUnavailable ? (
          <AdminErrorState
            message="Eligible incoming operators could not be loaded. Creating a handoff is disabled."
            title="Operator directory unavailable"
          />
        ) : null}
        {props.openCases && !props.operatorsUnavailable ? (
          <OperationsShiftHandoffForm
            currentOperator={props.currentOperator}
            defaultShiftLabel={props.defaultShiftLabel ?? ''}
            openCaseBaseHref={props.openCaseBaseHref ?? '/operations-handoff'}
            openCases={props.openCases}
            operators={props.operators ?? []}
          />
        ) : null}
      </AdminSection>
    </>
  );
}

function HandoffSummaryValue({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value === null ? 'Unavailable' : value}</strong>
    </div>
  );
}

function CurrentHandoffQueue({
  currentOperatorId,
  data,
  pageBaseHref,
  pageParam,
  title,
}: {
  readonly currentOperatorId: string;
  readonly data: AdminShiftHandoffPage;
  readonly pageBaseHref: string;
  readonly pageParam: 'assignedPage' | 'waitingPage';
  readonly title: string;
}) {
  const pagination = data.pagination ?? {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    totalRows: data.totalCount,
  };
  const from = (pagination.page - 1) * pagination.pageSize + 1;
  const to = from + data.items.length - 1;

  return (
    <AdminSection
      description={
        title === 'Assigned to me'
          ? 'Confirm receipt before starting transferred follow-up.'
          : 'Sent handoffs awaiting confirmation.'
      }
      statusLabel={`${pagination.totalRows} open`}
      statusTone="warning"
      title={title}
    >
      {data.items.map((handoff) => (
        <CurrentHandoffRow currentOperatorId={currentOperatorId} handoff={handoff} key={handoff.id} />
      ))}
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel={`${title} pagination`}
        from={from}
        hrefForPage={(page) => paginatedHref(pageBaseHref, pageParam, page)}
        itemLabel="handoffs"
        to={to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminSection>
  );
}

function CurrentHandoffRow({
  currentOperatorId,
  handoff,
}: {
  readonly currentOperatorId: string;
  readonly handoff: AdminShiftHandoff;
}) {
  return (
    <div className="ops-row operations-handoff-current-row">
      <div>
        <div className="participant-list">
          <StatusBadge tone="warning">Awaiting confirmation</StatusBadge>
          <StatusBadge tone="neutral">Created {formatDateTime(handoff.createdAt)}</StatusBadge>
        </div>
        <strong>
          {handoff.outgoingShift}: {operatorLabel(handoff.outgoingOperator)} → {handoff.incomingOperator}
        </strong>
        <p className="muted">{handoff.note || 'No open cases at handoff time'}</p>
        <p className="muted">
          Follow-up owner: {handoff.followUpOwner ?? handoff.owner} ·{' '}
          {caseCountLabel(handoff.unresolvedCaseIds.length)}
        </p>
        {handoff.unresolvedCases?.length ? (
          <div className="participant-list">
            {handoff.unresolvedCases.map((item) => (
              <Link
                className="text-link"
                href={handoffCaseHref(item)}
                key={`${item.queueKey}:${item.caseId}`}
                prefetch={false}
              >
                {handoffCaseActionLabel(item.queueKey)}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {handoff.incomingOperatorId === currentOperatorId ? <AcknowledgeButton handoffId={handoff.id} /> : null}
    </div>
  );
}

function AcknowledgeButton({ handoffId }: { readonly handoffId: string }) {
  const router = useRouter();
  const [state, setState] = useState<OperationsHandoffActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function acknowledge() {
    if (isPending || !window.confirm('Confirm that you received this handoff and will own its follow-up?'))
      return;
    const formData = new FormData();
    formData.set('handoffId', handoffId);
    startTransition(async () => {
      const result = await acknowledgeOperationsShiftHandoff(formData);
      setState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  return (
    <div className="operations-handoff-acknowledge">
      <AdminFormControlButton
        className="button-primary"
        disabled={isPending}
        onClick={acknowledge}
        type="button"
      >
        <Check aria-hidden="true" size={16} />
        {isPending ? 'Confirming…' : 'Confirm receipt'}
      </AdminFormControlButton>
      {state ? (
        <small
          aria-live="polite"
          className={state.status === 'error' ? 'admin-form-error' : 'admin-form-success'}
        >
          {state.message}
        </small>
      ) : null}
    </div>
  );
}

function ShiftHandoffHistory({ data, historyBaseHref }: HandoffHistoryProps) {
  const pagination = data.pagination ?? {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    totalRows: data.totalCount,
  };
  if (data.items.length === 0) {
    return (
      <AdminSection
        description="Created handoffs and their acknowledgement records."
        id="operations-shift-handoffs"
        title="History"
      >
        <AdminEmptyState
          framed
          message="No handoff records match the current filters."
          title="No handoff history"
        />
      </AdminSection>
    );
  }
  const from = (pagination.page - 1) * pagination.pageSize + 1;
  const to = from + data.items.length - 1;

  return (
    <AdminSection
      description="Created handoffs and their acknowledgement records. Dates use the handoff created time."
      id="operations-shift-handoffs"
      statusLabel={`${pagination.totalRows} records`}
      statusTone="neutral"
      title="History"
    >
      <AdminTableScroll ariaLabel="Shift handoff history">
        <AdminDataTable
          className="operations-handoff-history-table"
          emptyMessage={null}
          headers={[
            'Sent at',
            'Shift',
            'Outgoing',
            'Incoming',
            'Cases',
            'Follow-up owner',
            'Status',
            'Confirmed at',
            'Open',
          ]}
          rowCount={data.items.length}
        >
          {data.items.map((handoff) => (
            <tr key={handoff.id}>
              <td>{formatDateTime(handoff.createdAt)}</td>
              <td>
                <strong>{handoff.outgoingShift}</strong>
                <span className="muted admin-table-cell-secondary">
                  {handoff.note || 'No open cases at handoff time'}
                </span>
              </td>
              <td>{operatorLabel(handoff.outgoingOperator)}</td>
              <td>{handoff.incomingOperator}</td>
              <td>{handoffCaseLabel(handoff)}</td>
              <td>{handoff.followUpOwner ?? handoff.owner}</td>
              <td>
                {handoff.acknowledgedAt ? (
                  <StatusBadge tone="success">Confirmed</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Waiting</StatusBadge>
                )}
              </td>
              <td>{handoff.acknowledgedAt ? formatDateTime(handoff.acknowledgedAt) : 'Not confirmed'}</td>
              <td>
                <AdminFormControlLink
                  className="button-secondary button-sm"
                  href={`/audit-log?q=${encodeURIComponent(handoff.id)}`}
                >
                  Open audit record
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Shift handoff history pagination"
        from={from}
        hrefForPage={(page) =>
          paginatedHref(historyBaseHref ?? '/operations-handoff?view=history', 'page', page)
        }
        itemLabel="handoffs"
        to={to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminSection>
  );
}

function handoffTotal(data?: AdminShiftHandoffPage) {
  return data ? (data.pagination?.totalRows ?? data.totalCount) : null;
}

function handoffCaseHref(item: { caseId: string; queueKey: string }) {
  const params = new URLSearchParams({ q: item.caseId, queue: item.queueKey });
  return `/operations-handoff?${params.toString()}`;
}

function handoffCaseActionLabel(queueKey: string) {
  return `Open ${queueKey.replaceAll('-', ' ')}`;
}

function handoffCaseLabel(handoff: AdminShiftHandoff) {
  if (handoff.unresolvedCases?.length) {
    return handoff.unresolvedCases.map((item) => `${item.queueKey} · ${item.caseId}`).join(', ');
  }
  return handoff.unresolvedCaseIds.length ? handoff.unresolvedCaseIds.join(', ') : 'Clear';
}

function caseCountLabel(count: number) {
  return `${count} ${count === 1 ? 'case' : 'cases'}`;
}

function paginatedHref(baseHref: string, pageParam: string, page: number) {
  const url = new URL(baseHref, 'http://admin.local');
  if (page <= 1) url.searchParams.delete(pageParam);
  else url.searchParams.set(pageParam, String(page));
  return `${url.pathname}${url.search}`;
}

function operatorLabel(operator?: AdminShiftHandoff['acknowledgedBy']) {
  return operator?.fullName || operator?.email || operator?.phone || operator?.id || 'Unknown operator';
}
