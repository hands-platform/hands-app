import { ActionLink, OpsTaskAction } from './booking-operator-actions';
import {
  addBookingOpsNote,
  closeoutCompletedBooking,
  expireBooking,
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
  opsTaskCards,
}: BookingActionStatusSectionsProps) {
  return (
    <>
      <BookingDispatchChecklistSection dispatchSteps={dispatchSteps} />
      <BookingStructuredOpsStatusSection bookingId={bookingId} opsTaskCards={opsTaskCards} />
      <BookingOperatorNotesSection bookingId={bookingId} notes={notes} />
      <BookingChatRepairSection bookingId={bookingId} chatRepair={chatRepair} />
      <BookingCompletedCloseoutSection bookingId={bookingId} closeout={closeout} />
      <BookingMatchingExpirySection bookingId={bookingId} matchingExpiry={matchingExpiry} />
      <BookingNoShowHandlingSection bookingId={bookingId} noShow={noShow} />
      <BookingLiveServiceBoardSection liveSignals={liveSignals} />
    </>
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
          Create a retained customer-Partner chat room only after a final Partner exists. This is an
          operator command, not automatic assignment.
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
            Operator-facing next steps for this booking. These are guidance cards, not hidden automation.
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
  const doneCount = opsTaskCards.filter((task) => task.status === 'DONE').length;

  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Structured ops status</h2>
          <p className="muted">
            Track concrete handling steps separately from free-text notes. These statuses are saved per booking.
          </p>
        </div>
        <span className={`pill ${doneCount === opsTaskCards.length ? 'pill-success' : 'pill-info'}`}>
          {doneCount}/{opsTaskCards.length} done
        </span>
      </div>
      <div className="ops-task-grid">
        {opsTaskCards.map((task) => (
          <div className={`ops-task-card ops-task-${task.status.toLowerCase()}`} key={task.type}>
            <div>
              <span className={`pill ${opsTaskTone(task.status)}`}>{task.status}</span>
              <h3>{task.label}</h3>
              <p>{task.helper}</p>
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
    </section>
  );
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
      <div>
        <h2>Operator notes</h2>
        <p className="muted">
          Add internal handling notes for support handoff. Notes are appended to the booking and mirrored to the
          audit log.
        </p>
        <div className="ops-note-history">
          {recentNotes.length > 0 ? (
            recentNotes.map((note) => <p key={note}>{note}</p>)
          ) : (
            <p className="muted">No internal notes yet.</p>
          )}
        </div>
      </div>
      <form action={addBookingOpsNote} className="ops-note-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <textarea
          aria-label="Operator note"
          name="note"
          placeholder="Example: Called Partner, confirmed arrival in 15 minutes."
        />
        <div className="actions">
          <button type="submit">Add note</button>
          <button name="preset" type="submit" value="Customer contacted and updated about the booking status.">
            Customer contacted
          </button>
          <button name="preset" type="submit" value="Partner contacted and asked to confirm location/status.">
            Partner contacted
          </button>
          <button name="preset" type="submit" value="Payment reviewed by operations.">
            Payment reviewed
          </button>
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
          Reconcile a completed service after operational edits or a partial failure. This confirms payment
          capture, Partner earning, tax log, platform fee log, and wallet ledger are present.
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
          Close an open matching request when the customer should stop waiting. This releases any active payment
          hold and leaves a customer-contact task for follow-up.
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
          Use only when the customer or Partner did not proceed and operations must close the live booking path.
          Payment, refund, and customer communication still need review after marking no-show.
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
          Last-known location monitoring only. HANDS does not use routing, directions, or continuous GPS streaming
          in the MVP.
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
