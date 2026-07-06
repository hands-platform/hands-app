import { AdminEmptyState } from '../../../components/admin-empty-state';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormControlStack,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminOpsNoteForm } from '../../../components/admin-ops-note-form';
import {
  AdminActionCard,
  AdminCard,
  AdminDetailGrid,
  AdminSection,
  AdminTaskCard,
} from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { ActionLink, OpsTaskAction } from './booking-operator-actions';
import { BookingOperatorNotesEditor } from './booking-operator-notes-editor';
import type { BookingOutcomeReviewPanel, BookingOutcomeReviewRow } from './booking-outcome-review-panel';
import {
  addBookingOpsNote,
  approvePostMatchCancellationFromDetail,
  closeoutCompletedBooking,
  expireBooking,
  holdPostMatchCancellationFromDetail,
  markBookingNoShow,
  repairBookingChatRoom,
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
  opsTaskCards: OpsTaskCard[];
  operatorNotesPlacement?: 'before-actions' | 'after-actions';
  outcomeReview: BookingOutcomeReviewPanel;
  showDispatchChecklist?: boolean;
  showLiveServiceBoard?: boolean;
  showOutcomeReview?: boolean;
  showStructuredOpsStatus?: boolean;
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
  notes,
  operatorNotesPlacement = 'before-actions',
  opsTaskCards,
  outcomeReview,
  showDispatchChecklist = true,
  showLiveServiceBoard = true,
  showOutcomeReview = true,
  showStructuredOpsStatus = true,
}: BookingActionStatusSectionsProps) {
  const operatorNotes = <BookingOperatorNotesSection bookingId={bookingId} notes={notes} />;

  return (
    <>
      {showDispatchChecklist && <BookingDispatchChecklistSection dispatchSteps={dispatchSteps} />}
      {showStructuredOpsStatus && (
        <BookingStructuredOpsStatusSection bookingId={bookingId} opsTaskCards={opsTaskCards} />
      )}
      {operatorNotesPlacement === 'before-actions' && operatorNotes}
      {showOutcomeReview && (
        <BookingOutcomeReviewSection bookingId={bookingId} outcomeReview={outcomeReview} />
      )}
      {shouldShowChatRepairSection(chatRepair) && (
        <BookingChatRepairSection bookingId={bookingId} chatRepair={chatRepair} />
      )}
      {closeout.canSubmit && <BookingCompletedCloseoutSection bookingId={bookingId} closeout={closeout} />}
      {matchingExpiry.canSubmit && (
        <BookingMatchingExpirySection bookingId={bookingId} matchingExpiry={matchingExpiry} />
      )}
      {noShow.canSubmit && <BookingNoShowHandlingSection bookingId={bookingId} noShow={noShow} />}
      {showLiveServiceBoard && <BookingLiveServiceBoardSection liveSignals={liveSignals} />}
      {operatorNotesPlacement === 'after-actions' && operatorNotes}
    </>
  );
}

function shouldShowChatRepairSection(chatRepair: ChatRepairState) {
  return chatRepair.canSubmit || chatRepair.tone === 'pill-danger' || chatRepair.tone === 'pill-warn';
}

function BookingOutcomeReviewSection({
  bookingId,
  outcomeReview,
}: {
  bookingId: string;
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
            <AdminFormControlLink className="button-secondary admin-inline-action" href={outcomeReview.primaryHref}>
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
      <div className="ops-task-grid">
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
      </div>
      {outcomeReview.postMatchDecision.visible ? (
        <BookingOutcomePostMatchDecision bookingId={bookingId} outcomeReview={outcomeReview} />
      ) : null}
    </AdminSection>
  );
}

function bookingOutcomeReviewRowValue(row: BookingOutcomeReviewRow) {
  return row.dateTimeValue ? <DateTimeText fallback={row.value} value={row.dateTimeValue} /> : row.value;
}

function BookingOutcomePostMatchDecision({
  bookingId,
  outcomeReview,
}: {
  readonly bookingId: string;
  readonly outcomeReview: BookingOutcomeReviewPanel;
}) {
  const decision = outcomeReview.postMatchDecision;

  return (
    <AdminCard className="booking-outcome-decision-panel">
      <div className="booking-outcome-decision-copy">
        <StatusBadgeFromPillClass pillClass={decision.resolutionTone}>
          {decision.resolutionLabel}
        </StatusBadgeFromPillClass>
        <StatusBadgeFromPillClass pillClass={decision.feeTone}>
          {decision.feeLabel}
        </StatusBadgeFromPillClass>
        <StatusBadgeFromPillClass pillClass={decision.timingTone}>
          {decision.timingLabel}
        </StatusBadgeFromPillClass>
      </div>
      {decision.canResolve ? (
        <div className="booking-outcome-decision-actions">
          <AdminFormShell action={approvePostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.approveNote} />
            <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
              Approve cancellation
            </AdminFormControlButton>
          </AdminFormShell>
          <AdminFormShell action={holdPostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.holdNote} />
            <AdminFormControlButton className="button-secondary admin-inline-action" type="submit">
              Hold fee deduction
            </AdminFormControlButton>
          </AdminFormShell>
        </div>
      ) : (
        <span className="muted">This cancellation decision is already closed.</span>
      )}
    </AdminCard>
  );
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
          <StatusBadgeFromPillClass pillClass={chatRepair.tone}>
            {chatRepair.status}
          </StatusBadgeFromPillClass>
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
          <small>{chatRepair.helper}</small>
        </AdminOpsNoteForm>
      ) : null}
      <p className="muted">{chatRepair.helper}</p>
    </AdminSection>
  );
}

function BookingDispatchChecklistSection({ dispatchSteps }: BookingDispatchChecklistSectionProps) {
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
      title="Dispatch checklist"
    >
      <div className="dispatch-checklist">
        {dispatchSteps.map((step) => (
            <AdminTaskCard
              className={`dispatch-step-card dispatch-${step.priority.toLowerCase()}`}
              key={step.title}
              leading={
                <StatusBadgeFromPillClass pillClass={step.tone}>
                  {step.priority}
                </StatusBadgeFromPillClass>
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

function BookingStructuredOpsStatusSection({
  bookingId,
  opsTaskCards,
}: {
  bookingId: string;
  opsTaskCards: OpsTaskCard[];
}) {
  if (opsTaskCards.length === 0) {
    return null;
  }

  const doneCount = opsTaskCards.filter((task) => task.status === 'DONE').length;
  const visibleTasks = opsTaskCards.filter((task) => task.status !== 'DONE' || task.note);
  const allDone = doneCount === opsTaskCards.length;

  return (
    <AdminSection
      actions={
        <StatusBadge tone={allDone ? 'success' : 'info'}>
          {allDone ? 'All done' : `${visibleTasks.length} open / ${opsTaskCards.length}`}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Open handling checkpoints for this booking."
      title="Structured ops status"
    >
      {visibleTasks.length > 0 ? (
        <div className="ops-task-grid">
          {visibleTasks.map((task) => (
            <AdminTaskCard
              className={`ops-task-${task.status.toLowerCase()}`}
              detail={<span title={task.helper}>{compactOpsTaskHelper(task.helper)}</span>}
              key={task.type}
              leading={
                <StatusBadgeFromPillClass pillClass={opsTaskTone(task.status)}>
                  {task.status}
                </StatusBadgeFromPillClass>
              }
              title={task.label}
            >
              <small>{task.updatedBy}</small>
              {task.note && <small className="muted">Note: {task.note}</small>}
              <div className="ops-task-actions">
                <OpsTaskAction bookingId={bookingId} type={task.type} status="DONE" label="Mark done" />
                <OpsTaskAction bookingId={bookingId} type={task.type} status="BLOCKED" label="Blocked" />
                <OpsTaskAction bookingId={bookingId} type={task.type} status="PENDING" label="Reset" />
              </div>
            </AdminTaskCard>
          ))}
        </div>
      ) : (
        <p className="muted admin-mt-12">All structured handling checkpoints are complete.</p>
      )}
    </AdminSection>
  );
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
  if (helper.length > 64) {
    return 'Review handling detail.';
  }

  return helper;
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function BookingOperatorNotesSection({
  bookingId,
  notes,
}: {
  bookingId: string;
  notes?: string | null;
}) {
  const recentNotes = notes?.trim() ? notes.trim().split('\n').slice(-6) : [];

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
          recentNotes.map((note) => <p key={note}>{note}</p>)
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
        <StatusBadgeFromPillClass pillClass={closeout.tone}>
          {closeout.label}
        </StatusBadgeFromPillClass>
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
            <small className="admin-form-control-help">Use retained chat, payment, and Partner evidence.</small>
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

function BookingMatchingExpirySection({
  bookingId,
  matchingExpiry,
}: {
  bookingId: string;
  matchingExpiry: MatchingExpiryState;
}) {
  return (
    <AdminSection
      className="ops-command-center admin-mb-16"
      description="Close an open matching request when the customer should stop waiting."
      id="matching-expiry"
      title="Matching expiry handling"
    >
      {matchingExpiry.canSubmit ? (
        <AdminOpsNoteForm action={expireBooking}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormTextarea
            label="Expiry reason"
            name="reason"
            placeholder="Example: Matching window passed and no suitable Partner was available."
          />
          <AdminFormControlButton type="submit">Expire matching</AdminFormControlButton>
        </AdminOpsNoteForm>
      ) : (
        <StatusBadge tone={matchingExpiry.status === 'EXPIRED' ? 'warning' : 'neutral'}>
          {matchingExpiry.status === 'EXPIRED' ? 'Already expired' : 'Expiry not available for this status'}
        </StatusBadge>
      )}
    </AdminSection>
  );
}

function BookingNoShowHandlingSection({
  bookingId,
  noShow,
}: {
  bookingId: string;
  noShow: NoShowState;
}) {
  return (
    <AdminSection
      className="ops-command-center admin-mb-16"
      description="Mark no-show when operations must close a live booking path."
      id="no-show-handling"
      title="No-show handling"
    >
      {noShow.canSubmit ? (
        <AdminOpsNoteForm action={markBookingNoShow}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormTextarea
            label="No-show reason"
            name="reason"
            placeholder="Example: Customer did not answer calls after Partner arrival."
          />
          <AdminFormControlButton type="submit">Mark no-show</AdminFormControlButton>
        </AdminOpsNoteForm>
      ) : (
        <StatusBadge tone={noShow.status === 'NO_SHOW' ? 'danger' : 'neutral'}>
          {noShow.status === 'NO_SHOW' ? 'Already no-show' : 'No-show not available for this status'}
        </StatusBadge>
      )}
    </AdminSection>
  );
}

function BookingLiveServiceBoardSection({ liveSignals }: BookingLiveServiceBoardSectionProps) {
  return (
    <AdminSection
      className="ops-command-center admin-mb-16"
      description="Last-known location monitoring for the live service."
      title="Live service board"
    >
      <AdminDetailGrid className="admin-mt-12">
        {liveSignals.map((signal) => (
          <AdminTaskCard
            detail={signal.helper}
            key={signal.label}
            leading={
              <StatusBadgeFromPillClass pillClass={signal.tone}>
                {signal.label}
              </StatusBadgeFromPillClass>
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
