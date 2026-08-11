import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import {
  BookingActionStatusSections,
  type BookingActionStatusSectionsProps,
} from './booking-action-status-sections';

vi.mock('next/link', () => ({
  default: ({ children, prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => {
    void prefetch;
    return <a {...props}>{children}</a>;
  },
}));

function props(
  overrides: Partial<BookingActionStatusSectionsProps> = {},
): BookingActionStatusSectionsProps {
  return {
    bookingId: 'booking-1',
    chatRepair: {
      canSubmit: false,
      helper: 'Chat opens after match or final Partner selection.',
      status: 'Not required',
      tone: 'pill-neutral',
    },
    closeout: {
      canSubmit: false,
      label: 'Closeout available after completion',
      tone: 'pill-neutral',
    },
    dispatchSteps: [
      {
        detail: 'Monitor the booking.',
        owner: 'Operations',
        priority: 'Later',
        title: 'Monitor',
        tone: 'pill-neutral',
      },
    ],
    liveSignals: [
      {
        helper: 'No live location needed for this booking state.',
        label: 'Location',
        tone: 'pill-neutral',
        value: 'Not required',
      },
    ],
    matchingExpiry: {
      canSubmit: false,
      status: 'MATCHED',
    },
    noShow: {
      canSubmit: false,
      status: 'COMPLETED',
    },
    notes: null,
    opsTaskCards: [
      {
        helper: 'Confirm the customer has been updated.',
        label: 'Customer update',
        note: null,
        status: 'DONE',
        type: 'CUSTOMER_UPDATE',
        updatedBy: 'System',
      },
    ],
    outcomeReview: {
      helper: '',
      postMatchDecision: hiddenPostMatchDecision(),
      primaryHref: null,
      primaryLabel: null,
      rows: [],
      status: '',
      title: '',
      tone: 'pill-neutral',
      visible: false,
    },
    ...overrides,
  };
}

function render(overrides: Partial<BookingActionStatusSectionsProps> = {}) {
  return renderToStaticMarkup(<BookingActionStatusSections {...props(overrides)} />).replace(/\s+/g, ' ');
}

describe('BookingActionStatusSections', () => {
  it('uses shared Vuexy admin card surfaces for action panels', () => {
    const source = readFileSync('app/bookings/[id]/booking-action-status-sections.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminDetailGrid');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<a className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('<div className="ops-signal-card"');
    expect(source).not.toContain('className="ops-signal-card"');
    expect(source).toContain('variant="ops-signal"');
    expect(source).not.toContain('<div className="grid admin-mt-12">');
    expect(source).not.toContain('<div className={`dispatch-step-card');
    expect(source).not.toContain('className="card admin-card booking-outcome-decision-panel"');
    expect(source).not.toContain('className="card admin-card booking-action-note-panel"');
    expect(source).toContain('AdminFormControlStack');
    expect(source).not.toContain('<div className="admin-form-control-stack admin-form-control-fluid">');
    expect(source).toContain('admin-form-control-help');
    expect(source).not.toContain('<small className="ops-task-note">Note: {task.note}</small>');
    expect(source).not.toContain('booking-action-note-field');
    expect(source).not.toContain('booking-action-note-label');
    expect(source).not.toContain('booking-action-note-help');
  });

  it('uses shared Vuexy badge atoms instead of raw action status pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-action-status-sections.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${outcomeReview.tone}`}>{outcomeReview.status}</span>');
    expect(source).not.toContain('<span className={`pill ${decision.resolutionTone}`}>{decision.resolutionLabel}</span>');
    expect(source).not.toContain('actions={!chatRepair.canSubmit ? <span className={`pill ${chatRepair.tone}`}>{chatRepair.status}</span> : null}');
    expect(source).not.toContain('<span className="pill pill-info">{countLabel(recentNotes.length, \'note\')}</span>');
    expect(source).not.toContain('<span className={`pill ${signal.tone}`}>{signal.label}</span>');
  });

  it('uses the shared DateTimeText atom for visible outcome timestamps', () => {
    const source = readFileSync('app/bookings/[id]/booking-action-status-sections.tsx', 'utf8');

    expect(source).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(source).toContain('<DateTimeText fallback={row.value} value={row.dateTimeValue} />');
    expect(source).not.toContain('title={row.value}');
  });

  it('hides inactive action cards that only repeat not-available copy', () => {
    const markup = render();

    expect(markup).not.toContain('Chat room repair');
    expect(markup).not.toContain('Completed closeout');
    expect(markup).not.toContain('Matching expiry handling');
    expect(markup).not.toContain('No-show handling');
    expect(markup).toContain('Dispatch checklist');
    expect(markup).toContain('Structured ops status');
  });

  it('only offers reasoned reopening for completed structured ops checkpoints', () => {
    const markup = render({
      opsTaskCards: [
        {
          helper: 'Confirm the customer has been updated.',
          label: 'Customer update',
          note: null,
          status: 'DONE',
          type: 'CUSTOMER_CONTACTED',
          updatedBy: 'System',
        },
        {
          helper: 'Confirm the Partner has been reached.',
          label: 'Partner update',
          note: null,
          status: 'DONE',
          type: 'PROVIDER_CONTACTED',
          updatedBy: 'System',
        },
      ],
    });

    expect(markup).toContain('Structured ops status');
    expect(markup).toContain('All checkpoints complete');
    expect(markup).toContain('Reopen checkpoint');
    expect(markup).toContain('Reason for reopening');
    expect(markup).toContain('required=""');
    expect(markup).not.toContain('Mark done');
    expect(markup).not.toContain('Could not confirm');
  });

  it('keeps open structured ops checkpoints actionable', () => {
    const markup = render({
      opsTaskCards: [
        {
          helper: 'Confirm the customer has been updated.',
          label: 'Customer update',
          note: null,
          status: 'PENDING',
          type: 'CUSTOMER_CONTACTED',
          updatedBy: 'System',
        },
        {
          helper: 'Confirm the Partner has been reached.',
          label: 'Partner update',
          note: null,
          status: 'DONE',
          type: 'PROVIDER_CONTACTED',
          updatedBy: 'System',
        },
      ],
    });

    expect(markup).toContain('1 checkpoints remaining');
    expect(markup).toContain('Customer update checkpoint.');
    expect(markup).toContain('Customer contact confirmed');
    expect(markup).toContain('Record unable to confirm');
    expect(markup).toContain('Reason');
    expect(markup).toContain('Next check');
    expect(markup).toContain('Partner contact checkpoint.');
    expect(markup).not.toContain('Reopen checkpoint');
    expect(markup).not.toContain('>Reset<');
  });

  it('opens actions for only the selected checkpoint row', () => {
    const markup = render({
      opsTaskCards: [
        {
          helper: 'Confirm the customer has been updated.',
          label: 'Customer update',
          note: null,
          status: 'PENDING',
          type: 'CUSTOMER_CONTACTED',
          updatedBy: 'System',
        },
        {
          helper: 'Confirm the Partner has been reached.',
          label: 'Partner update',
          note: null,
          status: 'PENDING',
          type: 'PROVIDER_CONTACTED',
          updatedBy: 'System',
        },
      ],
      selectedOpsTaskType: 'PROVIDER_CONTACTED',
    });

    expect(markup).toContain('?checkpoint=CUSTOMER_CONTACTED#booking-structured-ops-status');
    expect(markup).not.toContain('?checkpoint=PROVIDER_CONTACTED#booking-structured-ops-status');
    expect(markup).toContain('Partner contact confirmed');
    expect(markup).not.toContain('Customer contact confirmed');
  });

  it('shows only actionable booking controls', () => {
    const markup = render({
      chatRepair: {
        canSubmit: true,
        helper: 'Final Partner is recorded, but the retained chat room is missing.',
        status: 'Repair available',
        tone: 'pill-danger',
      },
      matchingExpiry: {
        canSubmit: true,
        status: 'OPEN_MATCHING',
      },
      noShow: {
        canSubmit: true,
        status: 'OPEN_MATCHING',
      },
    });

    expect(markup).toContain('Chat room repair');
    expect(markup).toContain('Review matching expiry impact');
    expect(markup).toContain('Expire booking and close matching');
    expect(markup).toContain('Close matching without a Partner');
    expect(markup).not.toContain('Review and confirm no-show');
    expect(markup).toContain('required=""');
    expect(markup).not.toContain('Completed closeout');
    expect(markup.match(/Final Partner is recorded, but the retained chat room is missing\./g)).toHaveLength(1);
  });

  it('shows no-show handling only after matching expiry is unavailable', () => {
    const markup = render({
      matchingExpiry: { canSubmit: false, status: 'ARRIVED' },
      noShow: { canSubmit: true, status: 'ARRIVED' },
    });

    expect(markup).toContain('Review and confirm no-show');
    expect(markup).not.toContain('Close expired matching');
  });

  it('renders actionable status panels with the shared Vuexy admin section surface', () => {
    const markup = render({
      chatRepair: {
        canSubmit: true,
        helper: 'Final Partner is recorded, but the retained chat room is missing.',
        status: 'Repair available',
        tone: 'pill-danger',
      },
      closeout: {
        canSubmit: true,
        label: 'Completed closeout needs reconciliation',
        tone: 'pill-warn',
      },
      matchingExpiry: {
        canSubmit: true,
        status: 'OPEN_MATCHING',
      },
      noShow: {
        canSubmit: true,
        status: 'OPEN_MATCHING',
      },
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: hiddenPostMatchDecision(),
        primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
        primaryLabel: 'Open review queue',
        rows: [],
        status: 'Post-match cancellation',
        title: 'Post-match cancellation review',
        tone: 'pill-warn',
        visible: true,
      },
    });

    expect(markup.match(/class="card admin-section/g)).toHaveLength(8);
    expect(markup).toContain('class="ops-section-header admin-section-header"');
    expect(markup).toContain('class="admin-section-body"');
  });

  it('keeps warning repair states visible even when the submit button is locked', () => {
    const markup = render({
      chatRepair: {
        canSubmit: false,
        helper: 'Repair is locked until first-pick match or customer final selection is recorded.',
        status: 'Final Partner missing',
        tone: 'pill-warn',
      },
    });

    expect(markup).toContain('Chat room repair');
    expect(markup).toContain('Final Partner missing');
  });

  it('links post-match outcome reviews back to the cancellation queue', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: hiddenPostMatchDecision(),
        primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
        primaryLabel: 'Open review queue',
        rows: [],
        status: 'Post-match cancellation',
        title: 'Post-match cancellation review',
        tone: 'pill-warn',
        visible: true,
      },
    });

    expect(markup).toContain('Post-match cancellation review');
    expect(markup).toContain('Open review queue');
    expect(markup).toContain('href="/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1"');
    expect(markup).toContain('booking-outcome-review-actions');
  });

  it('renders outcome review timestamps through the shared date atom', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Review completed service before final closeout.',
        postMatchDecision: hiddenPostMatchDecision(),
        primaryHref: null,
        primaryLabel: null,
        rows: [
          {
            dateTimeValue: '2026-06-13T03:15:00.000Z',
            helper: 'Completed at',
            href: '#operating-timeline',
            label: 'Outcome time',
            tone: 'pill-info',
            value: 'Not set',
          },
        ],
        status: 'Completed',
        title: 'Completed booking review',
        tone: 'pill-success',
        visible: true,
      },
    });

    expect(markup).toContain('class="date-time-text"');
    expect(markup).toContain('dateTime="2026-06-13T03:15:00.000Z"');
    expect(markup).toContain('Outcome time');
  });

  it('can hide outcome review when the decision is rendered under the lifecycle list', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: hiddenPostMatchDecision(),
        primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
        primaryLabel: 'Open review queue',
        rows: [],
        status: 'Post-match cancellation',
        title: 'Post-match cancellation review',
        tone: 'pill-warn',
        visible: true,
      },
      showOutcomeReview: false,
    });

    expect(markup).not.toContain('Post-match cancellation review');
    expect(markup).toContain('Dispatch checklist');
  });

  it('can hide dispatch and live-service sections for terminal booking details', () => {
    const markup = render({
      showDispatchChecklist: false,
      showLiveServiceBoard: false,
    });

    expect(markup).not.toContain('Dispatch checklist');
    expect(markup).not.toContain('Live service board');
    expect(markup).toContain('Structured ops status');
    expect(markup).toContain('Operator notes');
  });

  it('can hide structured ops status while keeping notes and outcome actions visible', () => {
    const markup = render({
      closeout: {
        canSubmit: true,
        label: 'Completed closeout needs reconciliation',
        tone: 'pill-warn',
      },
      outcomeReview: {
        helper: 'Review completed service before final closeout.',
        postMatchDecision: hiddenPostMatchDecision(),
        primaryHref: null,
        primaryLabel: null,
        rows: [],
        status: 'Completed',
        title: 'Completed booking review',
        tone: 'pill-success',
        visible: true,
      },
      operatorNotesPlacement: 'after-actions',
      showStructuredOpsStatus: false,
    });

    expect(markup).not.toContain('Structured ops status');
    expect(markup).toContain('Operator notes');
    expect(markup).toContain('Completed booking review');
    expect(markup).toContain('Completed closeout');
    expect(markup).toContain('Confirm the final finance state for this completed booking.');
    expect(markup).toContain('card admin-card booking-action-note-panel');
    expect(markup).toContain('Add a short reconciliation note.');
    expect(markup).toContain('Reconcile booking');
    expect(markup.indexOf('Completed booking review')).toBeLessThan(markup.indexOf('Completed closeout'));
    expect(markup.indexOf('Completed closeout')).toBeLessThan(markup.indexOf('Operator notes'));
  });

  it('does not keep unreachable raw empty copy inside the completed closeout form', () => {
    const source = readFileSync('app/bookings/[id]/booking-action-status-sections.tsx', 'utf8');

    expect(source).toContain('{closeout.canSubmit && <BookingCompletedCloseoutSection');
    expect(source).not.toContain('No manual closeout action is available for this booking.');
  });

  it('renders operator notes with a simple text area', () => {
    const markup = render();

    expect(markup).toContain('class="admin-form-label">Operator note</span>');
    expect(markup).toContain('class="admin-form-textarea admin-form-control-labeled"');
    expect(markup).toContain('class="admin-form-control-stack admin-form-control-fluid"');
    expect(markup).toContain('class="admin-form-control-help"');
    expect(markup).toContain('class="ops-note-textarea"');
    expect(markup).toContain('placeholder="Add a short operator note."');
    expect(markup).toContain('Keep short internal notes for the booking audit trail.');
    expect(markup).toContain('Use one short note per action or decision.');
    expect(markup).toContain('card admin-card booking-action-note-panel');
    expect(markup).toContain('class="ops-note-history"');
    expect(markup).toContain('No internal notes yet.');
    expect(markup).toContain('class="empty-state');
    expect(markup).toContain('name="note"');
    expect(markup).toContain('Add note');
    expect(markup).not.toContain('Operator note full editor');
    expect(markup).not.toContain('Insert image');
    expect(markup).not.toContain('Text color');
    expect(markup).not.toContain('Customer contacted');
    expect(markup).not.toContain('Partner contacted');
    expect(markup).not.toContain('Payment reviewed');
  });

  it('links to the single post-match decision section without duplicating its form', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: {
          ...hiddenPostMatchDecision(),
          actions: [
            {
              decision: 'approve',
              helper: 'Close the customer money outcome.',
              label: 'Approve cancellation outcome',
              tone: 'primary',
            },
          ],
          canResolve: true,
          feeLabel: 'Fee held',
          feeTone: 'pill-danger',
          resolutionLabel: 'Pending admin decision',
          resolutionTone: 'pill-warn',
          timingLabel: '16m after match',
          timingTone: 'pill-warn',
          visible: true,
        },
        primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
        primaryLabel: 'Open review queue',
        rows: [],
        status: 'Post-match cancellation',
        title: 'Post-match cancellation review',
        tone: 'pill-warn',
        visible: true,
      },
    });

    expect(markup).toContain('Continue to cancellation decision');
    expect(markup).toContain('href="#booking-post-match-cancellation-decision"');
    expect(markup).not.toContain('name="decision"');
    expect(markup).not.toContain('booking-outcome-decision-panel');
  });

  it('does not duplicate resolved post-match decision state in the outcome summary', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: {
          ...hiddenPostMatchDecision(),
          canResolve: false,
          feeLabel: 'Fee restored',
          feeTone: 'pill-success',
          resolutionLabel: 'Approved',
          resolutionTone: 'pill-success',
          timingLabel: 'Review locked',
          timingTone: 'pill-neutral',
          visible: true,
        },
        primaryHref: '/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-1',
        primaryLabel: 'Open review queue',
        rows: [],
        status: 'Post-match cancellation',
        title: 'Post-match cancellation review',
        tone: 'pill-warn',
        visible: true,
      },
    });

    expect(markup).toContain('Continue to cancellation decision');
    expect(markup).not.toContain('Approved');
    expect(markup).not.toContain('Fee restored');
    expect(markup).not.toContain('name="decision"');
  });
});

function hiddenPostMatchDecision() {
  return {
    actions: [],
    canResolve: false,
    customerMoneyAfter: '',
    customerMoneyBefore: '',
    feeLabel: '',
    feeTone: 'pill-neutral' as const,
    partnerFeeApproveAfter: '',
    partnerFeeBefore: '',
    reviewAfter: '',
    reviewBefore: '',
    resolutionLabel: '',
    resolutionTone: 'pill-neutral' as const,
    timingLabel: '',
    timingTone: 'pill-neutral' as const,
    visible: false,
  };
}
