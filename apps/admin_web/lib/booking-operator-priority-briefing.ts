type PriorityTone = 'pill-danger' | 'pill-info' | 'pill-neutral' | 'pill-success' | 'pill-warn';

export type BookingOperatorPriorityBriefingInput = {
  primaryCommand: {
    tone: PriorityTone;
    title: string;
    owner: string;
    detail: string;
  };
  nextAction: {
    title: string;
    detail: string;
  };
  customerName: string;
  customerPhone: string;
  addressSnapshotLabel: string;
  partnerLabel: string;
  hasFinalPartner: boolean;
  participantCount: number;
  partnerHint: string;
  hasChatRoom: boolean;
  messageCount: number;
  locationLabel: string;
  locationHelper: string;
  paymentLabel: string;
  paymentHint: string;
  closeoutStatus: string;
  closeoutHelper: string;
  closeoutOpenItemCount: number;
  financeFlagTitles: string[];
};

export function bookingOperatorPriorityBriefing(input: BookingOperatorPriorityBriefingInput) {
  const closeoutLabel =
    input.closeoutOpenItemCount > 0 ? `${input.closeoutOpenItemCount} item(s)` : input.closeoutStatus;

  return {
    status: input.primaryCommand.tone === 'pill-success' ? 'Monitoring' : 'Action first',
    tone: input.primaryCommand.tone,
    rows: [
      {
        label: 'First action',
        value: input.primaryCommand.title,
        helper: `${input.primaryCommand.owner}: ${input.primaryCommand.detail}`,
      },
      {
        label: 'Next operator step',
        value: input.nextAction.title,
        helper: input.nextAction.detail,
      },
      {
        label: 'Customer',
        value: input.customerName,
        helper: `${input.customerPhone} / ${input.addressSnapshotLabel}`,
      },
      {
        label: 'Partner state',
        value: input.partnerLabel,
        helper: `${input.participantCount} participant record(s) / ${input.partnerHint}`,
      },
      {
        label: 'Chat record',
        value: input.hasChatRoom ? 'Ready' : 'Missing',
        helper: `${input.messageCount} retained message(s). Admin keeps chat history after service closeout.`,
      },
      {
        label: 'Location record',
        value: input.locationLabel,
        helper: input.locationHelper,
      },
      {
        label: 'Payment',
        value: input.paymentLabel,
        helper: input.paymentHint,
      },
      {
        label: 'Closeout',
        value: closeoutLabel,
        helper:
          input.financeFlagTitles.length > 0
            ? `${input.financeFlagTitles.length} finance check(s): ${input.financeFlagTitles.join(', ')}`
            : input.closeoutHelper,
      },
    ],
    steps: [
      {
        id: 'priority-command',
        label: '1',
        title: input.primaryCommand.title,
        detail: input.primaryCommand.detail,
        href: '#operator-command-queue',
        linkLabel: 'Open queue',
      },
      {
        id: 'priority-handoff',
        label: '2',
        title: input.hasFinalPartner ? 'Confirm Partner handoff' : 'Keep Partner choice visible',
        detail: input.hasFinalPartner
          ? `${input.partnerLabel} is linked. Confirm chat, service pin, and payment handoff are visible.`
          : 'Customer choice is still pending. Keep the shortlist, Partner alerts, and marketplace window easy to audit.',
        href: '#booking-handoff-checklist',
        linkLabel: 'Open handoff',
      },
      {
        id: 'priority-closeout',
        label: '3',
        title: input.closeoutStatus,
        detail: input.closeoutHelper,
        href: '#booking-closeout-readiness',
        linkLabel: 'Open closeout',
      },
    ],
  };
}
