'use client';

import { Eye, Pencil, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState, useTransition } from 'react';

import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSelect,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminOpsNoteForm } from '../../components/admin-ops-note-form';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, formatMoney } from '../../lib/admin-format';
import type { AdminOperationsHandoffOpenCasePage, AdminOperationsHandoffOperator } from '../../lib/admin-api';
import { createOperationsShiftHandoff, type OperationsHandoffActionState } from './actions';

type OperationsShiftHandoffFormProps = {
  readonly currentOperator: { id: string; label: string };
  readonly defaultShiftLabel: string;
  readonly openCaseBaseHref: string;
  readonly openCases: AdminOperationsHandoffOpenCasePage;
  readonly operators: readonly AdminOperationsHandoffOperator[];
};

export function OperationsShiftHandoffForm({
  currentOperator,
  defaultShiftLabel,
  openCaseBaseHref,
  openCases,
  operators,
}: OperationsShiftHandoffFormProps) {
  const router = useRouter();
  const [incomingOperatorId, setIncomingOperatorId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [outgoingShift, setOutgoingShift] = useState(defaultShiftLabel);
  const [note, setNote] = useState('');
  const [selectedCaseRefs, setSelectedCaseRefs] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [actionState, setActionState] = useState<OperationsHandoffActionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedQueueKeys = useMemo(
    () => [...new Set(selectedCaseRefs.map((value) => value.slice(0, value.indexOf(':'))))],
    [selectedCaseRefs],
  );
  const eligibleOperators = operators.filter((operator) =>
    selectedQueueKeys.every((queueKey) => operator.queueKeys.includes(queueKey)),
  );
  const operatorOptions = [
    { label: 'Select an eligible operator', value: '' },
    ...eligibleOperators.map((operator) => ({ label: operatorLabel(operator), value: operator.id })),
  ];
  const effectiveIncomingOperatorId = eligibleOperators.some((operator) => operator.id === incomingOperatorId)
    ? incomingOperatorId
    : '';
  const effectiveOwnerId =
    ownerId === currentOperator.id || eligibleOperators.some((operator) => operator.id === ownerId)
      ? ownerId
      : effectiveIncomingOperatorId;
  const selectedCount = selectedCaseRefs.length;
  const remainingCount = Math.max(0, openCases.openCount - selectedCount);
  const canSend = Boolean(
    outgoingShift.trim() &&
    effectiveIncomingOperatorId &&
    effectiveOwnerId &&
    (selectedCount === 0 || note.trim()) &&
    (selectedCount > 0 || openCases.openCount === 0),
  );

  function toggleCase(caseRef: string, checked: boolean) {
    setActionState(null);
    setIsPreviewing(false);
    setSelectedCaseRefs((current) =>
      checked ? [...current, caseRef] : current.filter((value) => value !== caseRef),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || isPending) return;
    if (!isPreviewing) {
      setIsPreviewing(true);
      return;
    }
    const formData = new FormData(event.currentTarget);
    selectedCaseRefs.forEach((value) => formData.append('unresolvedCases', value));
    formData.set(
      'incomingOperatorLabel',
      operatorOptions.find((option) => option.value === effectiveIncomingOperatorId)?.label ??
        effectiveIncomingOperatorId,
    );
    startTransition(async () => {
      const result = await createOperationsShiftHandoff(formData);
      setActionState(result);
      if (result.status === 'success') router.refresh();
    });
  }

  return (
    <AdminOpsNoteForm className="operations-handoff-create-form" onSubmit={submit}>
      <input name="expectedOpenCaseCount" type="hidden" value={openCases.openCount} />
      <input name="ownerId" type="hidden" value={effectiveOwnerId} />
      <AdminFormGridFields className="compact-form">
        <AdminFormStaticValue
          label="Outgoing operator"
          labelVisibility="visible"
          value={currentOperator.label}
        />
        <AdminFormInput
          label="Shift label"
          labelVisibility="visible"
          name="outgoingShift"
          onChange={(event) => {
            setIsPreviewing(false);
            setOutgoingShift(event.target.value);
          }}
          required
          value={outgoingShift}
        />
        <AdminFormSelect
          label="Incoming operator"
          labelVisibility="visible"
          name="incomingOperatorId"
          onChange={(event) => {
            const nextOperatorId = event.target.value;
            setActionState(null);
            setIncomingOperatorId(nextOperatorId);
            setIsPreviewing(false);
            setOwnerId('');
          }}
          options={operatorOptions}
          required
          value={effectiveIncomingOperatorId}
        />
      </AdminFormGridFields>

      <div className="operations-handoff-selection-toolbar">
        <div>
          <strong>Cases to hand over</strong>
          <p className="muted">
            {selectedCount > 0
              ? `${selectedCount} selected · ${remainingCount} remain open`
              : `${openCases.openCount} open across your permitted queues`}
          </p>
        </div>
        <AdminFormControlButton
          className="button-secondary"
          disabled={openCases.items.length === 0}
          onClick={() => setSelectedCaseRefs(openCases.items.map(caseRef))}
          type="button"
        >
          Select visible page
        </AdminFormControlButton>
      </div>

      <AdminTableScroll ariaLabel="Selectable open handoff cases">
        <AdminDataTable
          className="operations-handoff-case-table"
          emptyMessage={
            openCases.openCount === 0
              ? 'No open cases are waiting for handoff.'
              : 'No open cases match this search.'
          }
          headers={['Select', 'Queue / case', 'Occurred', 'Age / SLA', 'Amount', 'State', 'Owner', 'Action']}
          rowCount={openCases.items.length}
        >
          {openCases.items.map((item) => {
            const value = caseRef(item);
            return (
              <tr key={value}>
                <td>
                  <AdminFormCheckbox
                    checked={selectedCaseRefs.includes(value)}
                    label={`Select ${item.queueLabel} ${item.caseId}`}
                    onChange={(event) => toggleCase(value, event.target.checked)}
                  />
                </td>
                <td>
                  <strong>{item.queueLabel}</strong>
                  <span className="muted admin-table-cell-secondary">{item.caseId}</span>
                </td>
                <td>{formatDateTime(item.occurredAt)}</td>
                <td>
                  {ageLabel(item.ageMinutes)} / {item.slaMinutes}m
                </td>
                <td>{item.currency ? formatMoney(item.amount, item.currency) : '—'}</td>
                <td>
                  <StatusBadge tone={item.overdue ? 'danger' : 'warning'}>{item.state}</StatusBadge>
                </td>
                <td>{item.owner || 'Unassigned'}</td>
                <td>
                  <a className="text-link" href={item.href}>{`Open ${item.queueLabel.toLowerCase()}`}</a>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminTableScroll>

      <AdminTablePaginationFooter
        activePage={openCases.pagination.page}
        ariaLabel="Open handoff cases pagination"
        from={
          openCases.items.length ? (openCases.pagination.page - 1) * openCases.pagination.pageSize + 1 : 0
        }
        itemLabel="open cases"
        onPageChange={(page) => {
          if (
            selectedCaseRefs.length > 0 &&
            !window.confirm('Changing pages clears the cases selected on this page. Continue?')
          )
            return;
          setSelectedCaseRefs([]);
          router.push(openCasePageHref(openCaseBaseHref, page));
        }}
        to={
          openCases.items.length
            ? (openCases.pagination.page - 1) * openCases.pagination.pageSize + openCases.items.length
            : 0
        }
        totalPages={openCases.pagination.totalPages}
        totalRows={openCases.pagination.totalRows}
      />

      <details className="operations-handoff-owner-override">
        <summary>Advanced follow-up owner override</summary>
        <AdminFormSelect
          disabled={!effectiveIncomingOperatorId}
          label="Follow-up owner"
          labelVisibility="visible"
          name="ownerOverride"
          onChange={(event) => {
            setIsPreviewing(false);
            setOwnerId(event.target.value);
          }}
          options={[
            { label: 'Use incoming operator', value: '' },
            { label: `${currentOperator.label} (outgoing operator)`, value: currentOperator.id },
            ...eligibleOperators.map((operator) => ({ label: operatorLabel(operator), value: operator.id })),
          ]}
          value={ownerId}
        />
        <p className="muted">
          This records post-handoff follow-up responsibility. Source records are not reassigned.
        </p>
      </details>

      <AdminFormTextarea
        label="Handoff note"
        labelVisibility="visible"
        name="note"
        onChange={(event) => {
          setIsPreviewing(false);
          setNote(event.target.value);
        }}
        placeholder={'Current state:\nEvidence checked:\nNext action and due time:'}
        required={selectedCount > 0}
        rows={3}
        value={note}
      />
      {selectedCount === 0 && openCases.openCount > 0 ? (
        <AdminInlineNotice role="alert" tone="danger">
          Select at least one open case, or resolve the queue before sending a clear handoff.
        </AdminInlineNotice>
      ) : null}
      {openCases.openCount === 0 ? (
        <StatusBadge tone="neutral">Clear-shift confirmation · No open cases at handoff time</StatusBadge>
      ) : null}
      {isPreviewing ? (
        <div aria-label="Handoff preview" className="operations-handoff-preview" role="region">
          <strong>Preview handoff</strong>
          <p>
            {currentOperator.label} → {ownerLabel(effectiveIncomingOperatorId, currentOperator, operators)}
          </p>
          <p className="muted">
            {outgoingShift} · {selectedCount} selected · {remainingCount} remain open
          </p>
          <p className="muted">Follow-up owner: {ownerLabel(effectiveOwnerId, currentOperator, operators)}</p>
          <p className="muted">
            {selectedCount
              ? selectedCaseRefs.join(', ')
              : 'Clear-shift confirmation · the server will confirm the queue is still empty.'}
          </p>
          <p className="muted">{note || 'No handoff note for a clear queue.'}</p>
        </div>
      ) : null}
      {actionState ? (
        <AdminInlineNotice
          role={actionState.status === 'error' ? 'alert' : 'status'}
          tone={actionState.status === 'error' ? 'danger' : 'success'}
        >
          {actionState.message}
        </AdminInlineNotice>
      ) : null}
      <AdminFormActionRow className="operations-handoff-form-actions" wide={false}>
        {isPreviewing ? (
          <AdminFormControlButton
            className="button-secondary"
            disabled={isPending}
            onClick={() => setIsPreviewing(false)}
            type="button"
          >
            <Pencil aria-hidden="true" size={16} /> Edit handoff
          </AdminFormControlButton>
        ) : null}
        <AdminFormControlButton className="button-primary" disabled={!canSend || isPending} type="submit">
          {isPreviewing ? <Send aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          {isPending
            ? 'Sending…'
            : isPreviewing
              ? `Send to ${incomingOperatorName(effectiveIncomingOperatorId, operators)}`
              : 'Preview handoff'}
        </AdminFormControlButton>
      </AdminFormActionRow>
    </AdminOpsNoteForm>
  );
}

function caseRef(item: AdminOperationsHandoffOpenCasePage['items'][number]) {
  return `${item.queueKey}:${item.caseId}`;
}

function operatorLabel(operator: AdminOperationsHandoffOperator) {
  const identity = operator.email ?? operator.phone ?? operator.id;
  const role = operator.roles.includes('MASTER_ADMIN') ? 'Master Admin' : 'Admin';
  return operator.fullName && operator.fullName !== identity
    ? `${operator.fullName} · ${role} · ${identity}`
    : `${role} · ${identity}`;
}

function incomingOperatorName(operatorId: string, operators: readonly AdminOperationsHandoffOperator[]) {
  const operator = operators.find((item) => item.id === operatorId);
  return operator?.fullName || operator?.email || operator?.phone || 'operator';
}

function ownerLabel(
  ownerId: string,
  currentOperator: OperationsShiftHandoffFormProps['currentOperator'],
  operators: readonly AdminOperationsHandoffOperator[],
) {
  if (ownerId === currentOperator.id) return `${currentOperator.label} (current operator)`;
  const owner = operators.find((operator) => operator.id === ownerId);
  return owner ? operatorLabel(owner) : currentOperator.label;
}

function openCasePageHref(baseHref: string, page: number) {
  const url = new URL(baseHref, 'http://admin.local');
  if (page <= 1) url.searchParams.delete('page');
  else url.searchParams.set('page', String(page));
  return `${url.pathname}${url.search}`;
}

function ageLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1_440)}d ${Math.floor((minutes % 1_440) / 60)}h`;
}
