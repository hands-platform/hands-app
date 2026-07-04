import Link from 'next/link';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFormControlButton, AdminFormControlLink, AdminFormTextarea } from '../../../components/admin-form-controls';
import { AdminCard, AdminSection } from '../../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../../components/status-badge';
import { ActionLink, OpsTaskAction } from './booking-operator-actions';
import { BookingOperatorNotesEditor } from './booking-operator-notes-editor';
import type { BookingOutcomeReviewPanel } from './booking-outcome-review-panel';
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
          <PillClassBadge pillClass={outcomeReview.tone}>{outcomeReview.status}</PillClassBadge>
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
          <a className="ops-task-card" href={row.href} key={row.label}>
            <div>
              <PillClassBadge pillClass={row.tone}>{row.label}</PillClassBadge>
              <h3>{row.value}</h3>
              <p>{row.helper}</p>
            </div>
          </a>
        ))}
      </div>
      {outcomeReview.postMatchDecision.visible ? (
        <BookingOutcomePostMatchDecision bookingId={bookingId} outcomeReview={outcomeReview} />
      ) : null}
    </AdminSection>
  );
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
        <PillClassBadge pillClass={decision.resolutionTone}>{decision.resolutionLabel}</PillClassBadge>
        <PillClassBadge pillClass={decision.feeTone}>{decision.feeLabel}</PillClassBadge>
        <PillClassBadge pillClass={decision.timingTone}>{decision.timingLabel}</PillClassBadge>
      </div>
      {decision.canResolve ? (
        <div className="booking-outcome-decision-actions">
          <form action={approvePostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.approveNote} />
            <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
              Approve cancellation
            </AdminFormControlButton>
          </form>
          <form action={holdPostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.holdNote} />
            <AdminFormControlButton className="button-secondary admin-inline-action" type="submit">
              Hold fee deduction
            </AdminFormControlButton>
          </form>
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
          <PillClassBadge pillClass={chatRepair.tone}>{chatRepair.status}</PillClassBadge>
        ) : null
      }
      className="ops-command-center admin-mb-16"
      description="Create the retained booking chat room after a final Partner exists."
      id="chat-repair"
      title="Chat room repair"
    >
      {chatRepair.canSubmit ? (
        <form action={repairBookingChatRoom} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormControlButton type="submit">Repair chat room</AdminFormControlButton>
          <small>{chatRepair.helper}</small>
        </form>
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
        <PillClassBadge pillClass={sameShiftCount > 0 ? 'pill-warn' : 'pill-success'}>
          {sameShiftCount} same-shift
        </PillClassBadge>
      }
      className="admin-mb-16"
      description="Next handling steps for this booking."
      title="Dispatch checklist"
    >
      <div className="dispatch-checklist">
        {dispatchSteps.map((step) => (
          <div className={`dispatch-step-card dispatch-${step.priority.toLowerCase()}`} key={step.title}>
            <div>
              <PillClassBadge pillClass={step.tone}>{step.priority}</PillClassBadge>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <small>{step.owner}</small>
            </div>
            {step.actionHref && <ActionLink href={step.actionHref} label={step.actionLabel ?? 'Open'} />}
          </div>
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
        <PillClassBadge pillClass={allDone ? 'pill-success' : 'pill-info'}>
          {allDone ? 'All done' : `${visibleTasks.length} open / ${opsTaskCards.length}`}
        </PillClassBadge>
      }
      className="admin-mb-16"
      description="Open handling checkpoints for this booking."
      title="Structured ops status"
    >
      {visibleTasks.length > 0 ? (
        <div className="ops-task-grid">
          {visibleTasks.map((task) => (
            <div className={`ops-task-card ops-task-${task.status.toLowerCase()}`} key={task.type}>
              <div>
                <PillClassBadge pillClass={opsTaskTone(task.status)}>{task.status}</PillClassBadge>
                <h3>{task.label}</h3>
                <p title={task.helper}>{compactOpsTaskHelper(task.helper)}</p>
                <small>{task.updatedBy}</small>
                {task.note && <small className="ops-task-note">Note: {task.note}</small>}
              </div>
              <div className="ops-task-actions">
                <OpsTaskAction bookingId={bookingId} type={task.type} status="DONE" label="Mark done" />
                <OpsTaskAction bookingId={bookingId} type={task.type} status="BLOCKED" label="Blocked" />
                <OpsTaskAction bookingId={bookingId} type={task.type} status="PENDING" label="Reset" />
              </div>
            </div>
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
      <form action={addBookingOpsNote} className="ops-note-form booking-action-note-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <AdminCard className="booking-action-note-panel">
          <div className="booking-action-note-field">
            <span className="booking-action-note-label">Operator note</span>
            <BookingOperatorNotesEditor />
            <small className="booking-action-note-help">Use one short note per action or decision.</small>
          </div>
          <div className="booking-action-note-actions">
            <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
              Add note
            </AdminFormControlButton>
          </div>
        </AdminCard>
      </form>
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
      actions={<PillClassBadge pillClass={closeout.tone}>{closeout.label}</PillClassBadge>}
      className="admin-mb-16"
      description="Confirm the final finance state for this completed booking."
      id="completed-closeout"
      title="Completed closeout"
    >
      {closeout.canSubmit ? (
        <form action={closeoutCompletedBooking} className="ops-note-form booking-action-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminCard className="booking-action-note-panel">
            <div className="booking-action-note-field">
              <span className="booking-action-note-label">Closeout note</span>
              <AdminFormTextarea
                label="Closeout note"
                name="note"
                placeholder="Add a short reconciliation note."
                rows={3}
              />
              <small className="booking-action-note-help">Use retained chat, payment, and Partner evidence.</small>
            </div>
            <div className="booking-action-note-actions">
              <AdminFormControlButton className="button-primary admin-inline-action" type="submit">
                Reconcile booking
              </AdminFormControlButton>
            </div>
          </AdminCard>
        </form>
      ) : (
        <p className="muted admin-mt-12">No manual closeout action is available for this booking.</p>
      )}
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
        <form action={expireBooking} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormTextarea
            label="Expiry reason"
            name="reason"
            placeholder="Example: Matching window passed and no suitable Partner was available."
          />
          <AdminFormControlButton type="submit">Expire matching</AdminFormControlButton>
        </form>
      ) : (
        <PillClassBadge pillClass={matchingExpiry.status === 'EXPIRED' ? 'pill-warn' : 'pill-neutral'}>
          {matchingExpiry.status === 'EXPIRED' ? 'Already expired' : 'Expiry not available for this status'}
        </PillClassBadge>
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
        <form action={markBookingNoShow} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <AdminFormTextarea
            label="No-show reason"
            name="reason"
            placeholder="Example: Customer did not answer calls after Partner arrival."
          />
          <AdminFormControlButton type="submit">Mark no-show</AdminFormControlButton>
        </form>
      ) : (
        <PillClassBadge pillClass={noShow.status === 'NO_SHOW' ? 'pill-danger' : 'pill-neutral'}>
          {noShow.status === 'NO_SHOW' ? 'Already no-show' : 'No-show not available for this status'}
        </PillClassBadge>
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
      <div className="grid admin-mt-12">
        {liveSignals.map((signal) => (
          <div className="ops-signal-card" key={signal.label}>
            <PillClassBadge pillClass={signal.tone}>{signal.label}</PillClassBadge>
            <strong>{signal.value}</strong>
            <p className="muted">{signal.helper}</p>
          </div>
        ))}
      </div>
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
