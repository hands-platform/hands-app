import Link from 'next/link';
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
    <section className="card admin-mb-16" id="booking-outcome-review">
      <div className="ops-section-header">
        <div>
          <h2>{outcomeReview.title}</h2>
          <p className="muted">{outcomeReview.helper}</p>
        </div>
        <div className="booking-outcome-review-actions">
          <span className={`pill ${outcomeReview.tone}`}>{outcomeReview.status}</span>
          {outcomeReview.primaryHref && outcomeReview.primaryLabel ? (
            <Link className="button button-secondary admin-inline-action" href={outcomeReview.primaryHref}>
              {outcomeReview.primaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="ops-task-grid">
        {outcomeReview.rows.map((row) => (
          <a className="ops-task-card" href={row.href} key={row.label}>
            <div>
              <span className={`pill ${row.tone}`}>{row.label}</span>
              <h3>{row.value}</h3>
              <p>{row.helper}</p>
            </div>
          </a>
        ))}
      </div>
      {outcomeReview.postMatchDecision.visible ? (
        <BookingOutcomePostMatchDecision bookingId={bookingId} outcomeReview={outcomeReview} />
      ) : null}
    </section>
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
    <div className="booking-outcome-decision-panel">
      <div className="booking-outcome-decision-copy">
        <span className={`pill ${decision.resolutionTone}`}>{decision.resolutionLabel}</span>
        <span className={`pill ${decision.feeTone}`}>{decision.feeLabel}</span>
        <span className={`pill ${decision.timingTone}`}>{decision.timingLabel}</span>
      </div>
      {decision.canResolve ? (
        <div className="booking-outcome-decision-actions">
          <form action={approvePostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.approveNote} />
            <button className="button button-primary admin-inline-action" type="submit">
              Approve cancellation
            </button>
          </form>
          <form action={holdPostMatchCancellationFromDetail}>
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="note" value={decision.holdNote} />
            <button className="button button-secondary admin-inline-action" type="submit">
              Hold fee deduction
            </button>
          </form>
        </div>
      ) : (
        <span className="muted">This cancellation decision is already closed.</span>
      )}
    </div>
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
    <section className="card ops-command-center admin-mb-16" id="chat-repair">
      <div>
        <h2>Chat room repair</h2>
        <p className="muted">
          Create the retained booking chat room after a final Partner exists.
        </p>
      </div>
      {chatRepair.canSubmit ? (
        <form action={repairBookingChatRoom} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <button type="submit">Repair chat room</button>
          <small>{chatRepair.helper}</small>
        </form>
      ) : (
        <span className={`pill ${chatRepair.tone}`}>{chatRepair.status}</span>
      )}
      <p className="muted">{chatRepair.helper}</p>
    </section>
  );
}

function BookingDispatchChecklistSection({ dispatchSteps }: BookingDispatchChecklistSectionProps) {
  const sameShiftCount = dispatchSteps.filter((step) => step.priority === 'Now').length;

  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Dispatch checklist</h2>
          <p className="muted">
            Next handling steps for this booking.
          </p>
        </div>
        <span className={`pill ${sameShiftCount > 0 ? 'pill-warn' : 'pill-success'}`}>
          {sameShiftCount} same-shift
        </span>
      </div>
      <div className="dispatch-checklist">
        {dispatchSteps.map((step) => (
          <div className={`dispatch-step-card dispatch-${step.priority.toLowerCase()}`} key={step.title}>
            <div>
              <span className={`pill ${step.tone}`}>{step.priority}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <small>{step.owner}</small>
            </div>
            {step.actionHref && <ActionLink href={step.actionHref} label={step.actionLabel ?? 'Open'} />}
          </div>
        ))}
      </div>
    </section>
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
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Structured ops status</h2>
          <p className="muted">
            Open handling checkpoints for this booking.
          </p>
        </div>
        <span className={`pill ${allDone ? 'pill-success' : 'pill-info'}`}>
          {allDone ? 'All done' : `${visibleTasks.length} open / ${opsTaskCards.length}`}
        </span>
      </div>
      {visibleTasks.length > 0 ? (
        <div className="ops-task-grid">
          {visibleTasks.map((task) => (
            <div className={`ops-task-card ops-task-${task.status.toLowerCase()}`} key={task.type}>
              <div>
                <span className={`pill ${opsTaskTone(task.status)}`}>{task.status}</span>
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
    </section>
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

function BookingOperatorNotesSection({
  bookingId,
  notes,
}: {
  bookingId: string;
  notes?: string | null;
}) {
  const recentNotes = notes?.trim() ? notes.trim().split('\n').slice(-6) : [];

  return (
    <section className="card ops-note-panel admin-mb-16" id="operator-notes">
      <div className="ops-note-panel-header">
        <h2>Operator notes</h2>
        <p className="muted">
          Internal handling notes retained with the booking audit trail.
        </p>
      </div>
      <div className="ops-note-history">
        {recentNotes.length > 0 ? (
          recentNotes.map((note) => <p key={note}>{note}</p>)
        ) : (
          <p className="muted">No internal notes yet.</p>
        )}
      </div>
      <form action={addBookingOpsNote} className="ops-note-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <BookingOperatorNotesEditor />
        <div className="actions">
          <button type="submit">Add note</button>
        </div>
      </form>
    </section>
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
    <section className="card ops-command-center admin-mb-16" id="completed-closeout">
      <div>
        <h2>Completed closeout</h2>
        <p className="muted">
          Reconcile a completed service after operational edits or partial failure.
        </p>
      </div>
      {closeout.canSubmit ? (
        <form action={closeoutCompletedBooking} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <textarea
            aria-label="Closeout note"
            name="note"
            placeholder="Example: Reconciled after support confirmed service completion."
          />
          <button type="submit">Reconcile completed booking</button>
        </form>
      ) : (
        <span className={`pill ${closeout.tone}`}>{closeout.label}</span>
      )}
    </section>
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
    <section className="card ops-command-center admin-mb-16" id="matching-expiry">
      <div>
        <h2>Matching expiry handling</h2>
        <p className="muted">
          Close an open matching request when the customer should stop waiting.
        </p>
      </div>
      {matchingExpiry.canSubmit ? (
        <form action={expireBooking} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <textarea
            aria-label="Expiry reason"
            name="reason"
            placeholder="Example: Matching window passed and no suitable Partner was available."
          />
          <button type="submit">Expire matching</button>
        </form>
      ) : (
        <span className={`pill ${matchingExpiry.status === 'EXPIRED' ? 'pill-warn' : 'pill-neutral'}`}>
          {matchingExpiry.status === 'EXPIRED' ? 'Already expired' : 'Expiry not available for this status'}
        </span>
      )}
    </section>
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
    <section className="card ops-command-center admin-mb-16" id="no-show-handling">
      <div>
        <h2>No-show handling</h2>
        <p className="muted">
          Mark no-show when operations must close a live booking path.
        </p>
      </div>
      {noShow.canSubmit ? (
        <form action={markBookingNoShow} className="ops-note-form">
          <input type="hidden" name="bookingId" value={bookingId} />
          <textarea
            aria-label="No-show reason"
            name="reason"
            placeholder="Example: Customer did not answer calls after Partner arrival."
          />
          <button type="submit">Mark no-show</button>
        </form>
      ) : (
        <span className={`pill ${noShow.status === 'NO_SHOW' ? 'pill-danger' : 'pill-neutral'}`}>
          {noShow.status === 'NO_SHOW' ? 'Already no-show' : 'No-show not available for this status'}
        </span>
      )}
    </section>
  );
}

function BookingLiveServiceBoardSection({ liveSignals }: BookingLiveServiceBoardSectionProps) {
  return (
    <section className="card ops-command-center admin-mb-16">
      <div>
        <h2>Live service board</h2>
        <p className="muted">
          Last-known location monitoring for the live service.
        </p>
      </div>
      <div className="grid admin-mt-12">
        {liveSignals.map((signal) => (
          <div className="ops-signal-card" key={signal.label}>
            <span className={`pill ${signal.tone}`}>{signal.label}</span>
            <strong>{signal.value}</strong>
            <p className="muted">{signal.helper}</p>
          </div>
        ))}
      </div>
    </section>
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
