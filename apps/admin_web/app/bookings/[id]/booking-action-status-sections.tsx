import { AdminEmptyState } from '../../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormControlStack,
  AdminFormDateTime,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminStageItem, AdminStageItemLink, AdminStageList } from '../../../components/admin-stage-item';
import { AdminOpsNoteForm } from '../../../components/admin-ops-note-form';
import {
  AdminActionCard,
  AdminCard,
  AdminDetailGrid,
  AdminDisclosure,
  AdminSection,
  AdminTaskCard,
  AdminTaskGrid,
} from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { ActionLink, OpsTaskAction } from './booking-operator-actions';
import { BookingOperatorNotesEditor } from './booking-operator-notes-editor';
import type { BookingOperatorAuditNote } from '../../../lib/booking-operator-action-rules';
import type { BookingOutcomeReviewPanel, BookingOutcomeReviewRow } from './booking-outcome-review-panel';
import {
  addBookingOpsNote,
  closeoutCompletedBooking,
  expireBooking,
  markBookingNoShow,
  repairBookingChatRoom,
  updateBookingOpsTask,
} from './actions';

type DispatchStep = {
  priority: string;
  title: string;
  detail: string;
  owner: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

type OpsTaskCard = {
  type: string;
  label: string;
  helper: string;
  status: string;
  note: string | null;
  updatedBy: string;
};

type LiveSignal = {
  label: string;
  value: string;
  helper: string;
  tone: string;
};

type ChatRepairState = {
  canSubmit: boolean;
  status: string;
  tone: string;
  helper: string;
};

type CloseoutState = {
  canSubmit: boolean;
  label: string;
  tone: string;
};

type MatchingExpiryState = {
  canSubmit: boolean;
  status: string;
};

type NoShowState = {
  canSubmit: boolean;
  status: string;
};

export type BookingActionStatusSectionsProps = {
  bookingId: string;
  chatRepair: ChatRepairState;
  closeout: CloseoutState;
  dispatchSteps: DispatchStep[];
  liveSignals: LiveSignal[];
  matchingExpiry: MatchingExpiryState;
  noShow: NoShowState;
  notes?: string | null;
  operatorNotes?: readonly BookingOperatorAuditNote[];
  opsTaskCards: OpsTaskCard[];
  operatorNotesPlacement?: 'before-actions' | 'after-actions' | 'hidden';
  outcomeReview: BookingOutcomeReviewPanel;
  showDispatchChecklist?: boolean;
  showLiveServiceBoard?: boolean;
  showOutcomeReview?: boolean;
  showStructuredOpsStatus?: boolean;
  selectedOpsTaskType?: string | null;
};

type BookingDispatchChecklistSectionProps = {
  dispatchSteps: DispatchStep[];
};

type BookingLiveServiceBoardSectionProps = {
  liveSignals: LiveSignal[];
};

export function BookingActionStatusSections({
  bookingId,
  chatRepair,
  closeout,
  dispatchSteps,
  liveSignals,
  matchingExpiry,
  noShow,
  operatorNotes = [],
  operatorNotesPlacement = 'before-actions',
  opsTaskCards,
  outcomeReview,
  showDispatchChecklist = true,
  showLiveServiceBoard = true,
  showOutcomeReview = true,
  showStructuredOpsStatus = true,
  selectedOpsTaskType = null,
}: BookingActionStatusSectionsProps) {
  const operatorNotesSection = (
    <BookingOperatorNotesSection auditNotes={operatorNotes} bookingId={bookingId} />
  );

  return (
    <>
      {showDispatchChecklist && <BookingDispatchChecklistSection dispatchSteps={dispatchSteps} />}
      {showStructuredOpsStatus && (
        <BookingStructuredOpsStatusSection
          bookingId={bookingId}
          opsTaskCards={opsTaskCards}
          selectedOpsTaskType={selectedOpsTaskType}
        />
      )}
      {operatorNotesPlacement === 'before-actions' && operatorNotesSection}
      {showOutcomeReview && (
        <BookingOutcomeReviewSection outcomeReview={outcomeReview} />
      )}
      {shouldShowChatRepairSection(chatRepair) && (
        <BookingChatRepairSection bookingId={bookingId} chatRepair={chatRepair} />
      )}
      {closeout.canSubmit && <BookingCompletedCloseoutSection bookingId={bookingId} closeout={closeout} />}
      <BookingCannotCompleteServiceSection
        bookingId={bookingId}
        matchingExpiry={matchingExpiry}
        noShow={noShow}
      />
      {showLiveServiceBoard && <BookingLiveServiceBoardSection liveSignals={liveSignals} />}
      {operatorNotesPlacement === 'after-actions' && operatorNotesSection}
    </>
  );
}

function shouldShowChatRepairSection(chatRepair: ChatRepairState) {
  return chatRepair.canSubmit || chatRepair.tone === 'pill-danger' || chatRepair.tone === 'pill-warn';
}

export function BookingOutcomeReviewSection({
  outcomeReview,
}: {
  outcomeReview: BookingOutcomeReviewPanel;
}) {
  if (!outcomeReview.visible) {
    return null;
  }

  return (
    <AdminSection
      actions={
        <div className="booking-outcome-review-actions">
          <StatusBadgeFromPillClass pillClass={outcomeReview.tone}>
            {outcomeReview.status}
          </StatusBadgeFromPillClass>
          {outcomeReview.primaryHref && outcomeReview.primaryLabel ? (
            <AdminFormControlLink
              className="button-secondary admin-inline-action"
              href={outcomeReview.primaryHref}
            >
              {outcomeReview.primaryLabel}
            </AdminFormControlLink>
          ) : null}
        </div>
      }
      className="admin-mb-16"
      description={outcomeReview.helper}
      id="booking-outcome-review"
      title={outcomeReview.title}
    >
      <AdminTaskGrid>
        {outcomeReview.rows.map((row) => (
          <AdminActionCard
            detail={row.helper}
            href={row.href}
            key={row.label}
            signalClassName={outcomeSignalClass(row.tone)}
            signalLabel={row.label}
            title={bookingOutcomeReviewRowValue(row)}
            variant="ops-task"
          />
        ))}
      </AdminTaskGrid>
      {outcomeReview.postMatchDecision.visible ? (
        <AdminFormControlLink
          className="button-secondary admin-inline-action"
          href="#booking-post-match-cancellation-decision"
        >
          Continue to cancellation decision
        </AdminFormControlLink>
      ) : null}
    </AdminSection>
  );
}

function bookingOutcomeReviewRowValue(row: BookingOutcomeReviewRow) {
  return row.dateTimeValue ? <DateTimeText fallback={row.value} value={row.dateTimeValue} /> : row.value;
}

function BookingChatRepairSection({
  bookingId,
  chatRepair,
}: {
  bookingId: string;
  chatRepair: ChatRepairState;
}) {
  return (
    <AdminSection
      actions={
        !chatRepair.canSubmit ? (
          <StatusBadgeFromPillClass pillClass={chatRepair.tone}>{chatRepair.status}</StatusBadgeFromPillClass>
        ) : null
      }
      className="ops-command-center admin-mb-16"
      description="Create the retained booking chat room after a final Partner exists."
      id="chat-repair"
      title="Chat room repair"
    >
      {chatRepair.canSubmit ? (
        <AdminOpsNoteForm action={repairBookingChatRoom}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormControlButton type="submit">Repair chat room</AdminFormControlButton>
        </AdminOpsNoteForm>
      ) : null}
      <p className="muted">{chatRepair.helper}</p>
    </AdminSection>
  );
}

export function BookingDispatchChecklistSection({ dispatchSteps }: BookingDispatchChecklistSectionProps) {
  const sameShiftCount = dispatchSteps.filter((step) => step.priority === 'Now').length;

  return (
    <AdminSection
      actions={
        <StatusBadge tone={sameShiftCount > 0 ? 'warning' : 'success'}>
          {sameShiftCount} same-shift
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Next handling steps for this booking."
      id="booking-dispatch-checklist"
      title="Dispatch checklist"
    >
      <div className="dispatch-checklist">
        {dispatchSteps.map((step) => (
          <AdminTaskCard
            className={`dispatch-step-card dispatch-${step.priority.toLowerCase()}`}
            key={step.title}
            leading={
              <StatusBadgeFromPillClass pillClass={step.tone}>{step.priority}</StatusBadgeFromPillClass>
            }
          >
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <small>{step.owner}</small>
            {step.actionHref && <ActionLink href={step.actionHref} label={step.actionLabel ?? 'Open'} />}
          </AdminTaskCard>
        ))}
      </div>
    </AdminSection>
  );
}

export function BookingStructuredOpsStatusSection({
  bookingId,
  opsTaskCards,
  selectedOpsTaskType,
}: {
  bookingId: string;
  opsTaskCards: OpsTaskCard[];
  selectedOpsTaskType?: string | null;
}) {
  if (opsTaskCards.length === 0) {
    return null;
  }

  const doneCount = opsTaskCards.filter((task) => task.status === 'DONE').length;
  const openCount = opsTaskCards.filter((task) => task.status !== 'DONE').length;
  const allDone = doneCount === opsTaskCards.length;
  const resolvedSelectedTaskType =
    selectedOpsTaskType ?? opsTaskCards.find((task) => task.status !== 'DONE')?.type ?? opsTaskCards[0]?.type;

  return (
    <AdminSection
      actions={
        <StatusBadge tone={allDone ? 'success' : 'warning'}>
          {allDone ? 'All checkpoints complete' : `${openCount} checkpoints remaining`}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Open handling checkpoints for this booking."
      id="booking-structured-ops-status"
      title="Structured ops status"
    >
      <AdminStageList className="booking-checkpoint-list">
        {opsTaskCards.map((task) => {
          const selected = task.type === resolvedSelectedTaskType;
          const content = (
            <>
              <span className="booking-checkpoint-copy">
                <strong>{task.label}</strong>
                <small title={task.helper}>{compactOpsTaskHelper(task.helper)}</small>
                <small>{task.updatedBy}</small>
                {task.note ? <small className="muted">Note: {task.note}</small> : null}
              </span>
              <StatusBadgeFromPillClass pillClass={opsTaskTone(task.status)}>
                {task.status}
              </StatusBadgeFromPillClass>
            </>
          );

          if (!selected) {
            return (
              <AdminStageItemLink
                className="booking-checkpoint-row"
                href={`/bookings/${encodeURIComponent(bookingId)}?checkpoint=${encodeURIComponent(task.type)}#booking-structured-ops-status`}
                key={task.type}
              >
                {content}
              </AdminStageItemLink>
            );
          }

          return (
            <AdminStageItem className="booking-checkpoint-row is-selected" key={task.type}>
              {content}
              <div className="ops-task-actions booking-checkpoint-actions">
                {task.status === 'DONE' ? (
                  <OpsTaskNoteAction
                    bookingId={bookingId}
                    label="Reopen checkpoint"
                    noteLabel="Reason for reopening"
                    placeholder="Explain why this completed checkpoint needs another review."
                    status="PENDING"
                    type={task.type}
                  />
                ) : (
                  <>
                    <OpsTaskAction
                      bookingId={bookingId}
                      label={opsTaskCompletionLabel(task.type)}
                      status="DONE"
                      type={task.type}
                    />
                    {task.status === 'PENDING' ? (
                      <OpsTaskNoteAction
                        bookingId={bookingId}
                        label="Record unable to confirm"
                        noteLabel="Reason"
                        placeholder="Record what could not be confirmed."
                        status="BLOCKED"
                        type={task.type}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </AdminStageItem>
          );
        })}
      </AdminStageList>
    </AdminSection>
  );
}

function OpsTaskNoteAction({
  bookingId,
  label,
  noteLabel,
  placeholder,
  status,
  type,
}: {
  readonly bookingId: string;
  readonly label: string;
  readonly noteLabel: string;
  readonly placeholder: string;
  readonly status: 'BLOCKED' | 'PENDING';
  readonly type: string;
}) {
  return (
    <AdminDisclosure ariaLabel={`${label}: ${type}`}>
      <summary>{label}</summary>
      <AdminOpsNoteForm action={updateBookingOpsTask}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="status" value={status} />
        <AdminFormTextarea label={noteLabel} name="note" placeholder={placeholder} required />
        {status === 'BLOCKED' ? (
          <AdminFormDateTime label="Next check" labelVisibility="visible" name="nextCheckAt" required />
        ) : null}
        <AdminFormControlButton className="button-secondary" type="submit">
          {label}
        </AdminFormControlButton>
      </AdminOpsNoteForm>
    </AdminDisclosure>
  );
}

function opsTaskCompletionLabel(type: string) {
  if (type === 'CUSTOMER_CONTACTED') return 'Customer contact confirmed';
  if (type === 'PROVIDER_CONTACTED') return 'Partner contact confirmed';
  if (type === 'LOCATION_CHECKED') return 'Location verified';
  if (type === 'PAYMENT_REVIEWED') return 'Payment checked';
  return 'Checkpoint completed';
}

function compactOpsTaskHelper(helper: string): string {
  if (
    helper.startsWith('Confirm the guest has been updated') ||
    helper.startsWith('Confirm the customer has been updated')
  ) {
    return 'Customer update checkpoint.';
  }
  if (helper.startsWith('Confirm the Partner has been reached')) {
    return 'Partner contact checkpoint.';
  }
  return helper;
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function BookingOperatorNotesSection({
  auditNotes,
  bookingId,
}: {
  auditNotes?: readonly BookingOperatorAuditNote[];
  bookingId: string;
}) {
  const recentNotes = (auditNotes ?? []).slice(0, 6);

  return (
    <AdminSection
      actions={<StatusBadge tone="info">{countLabel(recentNotes.length, 'note')}</StatusBadge>}
      className="admin-mb-16"
      description="Keep short internal notes for the booking audit trail."
      id="operator-notes"
      title="Operator notes"
    >
      <div className="ops-note-history">
        {recentNotes.length > 0 ? (
          recentNotes.map((note) => (
            <div className="ops-note-history-row" key={note.id}>
              <strong>{note.actorLabel}</strong>
              <DateTimeText value={note.createdAt} />
              <p>{note.content}</p>
            </div>
          ))
        ) : (
          <AdminEmptyState framed message="No internal notes yet." />
        )}
      </div>
      <AdminOpsNoteForm action={addBookingOpsNote} className="booking-action-note-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <AdminCard className="booking-action-note-panel">
          <AdminFormControlStack className="admin-form-control-fluid">
            <BookingOperatorNotesEditor />
            <small className="admin-form-control-help">Use one short note per action or decision.</small>
          </AdminFormControlStack>
          <div className="booking-action-note-actions">
            <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
              Add note
            </AdminFormControlButton>
          </div>
        </AdminCard>
      </AdminOpsNoteForm>
    </AdminSection>
  );
}

function BookingCompletedCloseoutSection({
  bookingId,
  closeout,
}: {
  bookingId: string;
  closeout: CloseoutState;
}) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={closeout.tone}>{closeout.label}</StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Confirm the final finance state for this completed booking."
      id="completed-closeout"
      title="Completed closeout"
    >
      <AdminOpsNoteForm action={closeoutCompletedBooking} className="booking-action-note-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <AdminCard className="booking-action-note-panel">
          <AdminFormControlStack className="admin-form-control-fluid">
            <AdminFormTextarea
              className="admin-form-control-fluid"
              label="Closeout note"
              labelVisibility="visible"
              name="note"
              placeholder="Add a short reconciliation note."
              rows={3}
            />
            <small className="admin-form-control-help">
              Use retained chat, payment, and Partner evidence.
            </small>
          </AdminFormControlStack>
          <div className="booking-action-note-actions">
            <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
              Reconcile booking
            </AdminFormControlButton>
          </div>
        </AdminCard>
      </AdminOpsNoteForm>
    </AdminSection>
  );
}

function BookingCannotCompleteServiceSection({
  bookingId,
  matchingExpiry,
  noShow,
}: {
  bookingId: string;
  matchingExpiry: MatchingExpiryState;
  noShow: NoShowState;
}) {
  if (!matchingExpiry.canSubmit && !noShow.canSubmit) {
    return null;
  }

  const handleNoShow = !matchingExpiry.canSubmit && noShow.canSubmit;

  return (
    <AdminSection
      className="ops-command-center admin-mb-16"
      description="Choose the single outcome supported by the current booking state and retained evidence."
      id="cannot-complete-service"
      title={handleNoShow ? 'No-show review' : 'Close matching without a Partner'}
    >
      <span aria-hidden="true" id="matching-expiry" />
      <span aria-hidden="true" id="no-show-handling" />
      {handleNoShow ? (
        <AdminOpsNoteForm action={markBookingNoShow}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormTextarea
            label="No-show reason"
            name="reason"
            placeholder="Example: Customer did not answer calls after Partner arrival."
            required
          />
          <AdminFormControlButton type="submit">Review and confirm no-show</AdminFormControlButton>
        </AdminOpsNoteForm>
      ) : (
        <AdminDisclosure ariaLabel="Review matching expiry impact">
          <summary>Review matching expiry impact</summary>
          <AdminCard className="booking-action-note-panel">
            <AdminDetailGrid>
              <DecisionImpact label="Booking" value="OPEN_MATCHING becomes EXPIRED" />
              <DecisionImpact label="Matching" value="Redis matching and Partner participation close" />
              <DecisionImpact label="Payment" value="Only PENDING or AUTHORIZED payment is released" />
              <DecisionImpact
                label="Customer"
                value="Contact checkpoint remains pending; no automatic message"
              />
              <DecisionImpact
                label="Recovery"
                value="No automatic recovery action is defined"
              />
            </AdminDetailGrid>
            <AdminOpsNoteForm action={expireBooking}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <AdminFormTextarea
                label="Expiry reason"
                name="reason"
                placeholder="Example: Matching deadline passed and no selectable Partner remained."
                required
              />
              <AdminFormControlButton type="submit">Expire booking and close matching</AdminFormControlButton>
            </AdminOpsNoteForm>
          </AdminCard>
        </AdminDisclosure>
      )}
    </AdminSection>
  );
}

function DecisionImpact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export function BookingLiveServiceBoardSection({ liveSignals }: BookingLiveServiceBoardSectionProps) {
  return (
    <AdminSection
      className="ops-command-center admin-mb-16"
      description="Last-known location monitoring for the live service."
      id="booking-live-service-board"
      title="Live service board"
    >
      <AdminDetailGrid className="admin-mt-12">
        {liveSignals.map((signal) => (
          <AdminTaskCard
            detail={signal.helper}
            key={signal.label}
            leading={
              <StatusBadgeFromPillClass pillClass={signal.tone}>{signal.label}</StatusBadgeFromPillClass>
            }
            value={signal.value}
            variant="ops-signal"
          />
        ))}
      </AdminDetailGrid>
    </AdminSection>
  );
}

function opsTaskTone(status: string) {
  if (status === 'DONE') {
    return 'pill-success';
  }
  if (status === 'BLOCKED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function outcomeSignalClass(pillClass: string) {
  if (pillClass.includes('success')) {
    return 'signal-ok';
  }
  if (pillClass.includes('warn') || pillClass.includes('danger')) {
    return 'signal-warn';
  }
  return 'signal-info';
}
