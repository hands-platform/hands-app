import { renderToStaticMarkup } from 'react-dom/server';

import {
  BookingActionStatusSections,
  type BookingActionStatusSectionsProps,
} from './booking-action-status-sections';

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
  it('hides inactive action cards that only repeat not-available copy', () => {
    const markup = render();

    expect(markup).not.toContain('Chat room repair');
    expect(markup).not.toContain('Completed closeout');
    expect(markup).not.toContain('Matching expiry handling');
    expect(markup).not.toContain('No-show handling');
    expect(markup).toContain('Dispatch checklist');
    expect(markup).toContain('Structured ops status');
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
    expect(markup).toContain('Matching expiry handling');
    expect(markup).toContain('No-show handling');
    expect(markup).not.toContain('Completed closeout');
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

  it('renders post-match cancellation decision actions on detail pages', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: {
          approveNote: 'Approved after admin chat evidence review.',
          canResolve: true,
          feeLabel: 'Fee held',
          feeTone: 'pill-danger',
          holdNote: 'Held after admin chat evidence review.',
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

    expect(markup).toContain('Pending admin decision');
    expect(markup).toContain('Fee held');
    expect(markup).toContain('16m after match');
    expect(markup).toContain('Approve cancellation');
    expect(markup).toContain('Hold fee deduction');
    expect(markup).toContain('name="bookingId" value="booking-1"');
    expect(markup).toContain('booking-outcome-decision-panel');
  });

  it('locks post-match cancellation decision actions after resolution', () => {
    const markup = render({
      outcomeReview: {
        helper: 'Use retained chat before final confirmation.',
        postMatchDecision: {
          approveNote: '',
          canResolve: false,
          feeLabel: 'Fee restored',
          feeTone: 'pill-success',
          holdNote: '',
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

    expect(markup).toContain('Approved');
    expect(markup).toContain('Fee restored');
    expect(markup).toContain('This cancellation decision is already closed.');
    expect(markup).not.toContain('Approve cancellation');
    expect(markup).not.toContain('Hold fee deduction');
  });
});

function hiddenPostMatchDecision() {
  return {
    approveNote: '',
    canResolve: false,
    feeLabel: '',
    feeTone: 'pill-neutral' as const,
    holdNote: '',
    resolutionLabel: '',
    resolutionTone: 'pill-neutral' as const,
    timingLabel: '',
    timingTone: 'pill-neutral' as const,
    visible: false,
  };
}
