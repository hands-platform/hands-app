import {
  bookingOperatorPriorityBriefing,
  type BookingOperatorPriorityBriefingInput,
} from './booking-operator-priority-briefing';

const baseInput: BookingOperatorPriorityBriefingInput = {
  primaryCommand: {
    tone: 'pill-warn',
    title: 'Monitor customer choice',
    owner: 'Dispatch operator',
    detail: 'Customer still chooses the final Partner.',
  },
  nextAction: {
    title: 'Keep customer wait visible',
    detail: 'Watch Partner participation and customer choice.',
  },
  customerName: 'Demo Customer',
  customerPhone: '0865907184',
  addressSnapshotLabel: 'District 1, Ho Chi Minh City',
  partnerLabel: 'Linh Wellness',
  hasFinalPartner: true,
  participantCount: 1,
  partnerHint: 'Partner accepted.',
  hasChatRoom: true,
  messageCount: 2,
  locationLabel: 'Recent',
  locationHelper: '10.7769, 106.7009 / 5 min ago',
  paymentLabel: 'MOMO / AUTHORIZED',
  paymentHint: 'Payment authorized.',
  closeoutStatus: 'Open items',
  closeoutHelper: 'Payment capture is still open.',
  closeoutOpenItemCount: 1,
  financeFlagTitles: ['Capture required'],
};

describe('bookingOperatorPriorityBriefing', () => {
  it('builds the first-read rows from explicit booking operation labels', () => {
    const briefing = bookingOperatorPriorityBriefing(baseInput);

    expect(briefing.status).toBe('Action first');
    expect(briefing.tone).toBe('pill-warn');
    expect(briefing.rows.map((row) => row.label)).toEqual([
      'First action',
      'Next operator step',
      'Customer',
      'Partner state',
      'Chat record',
      'Location record',
      'Payment',
      'Closeout',
    ]);
    expect(briefing.rows[2]).toMatchObject({
      value: 'Demo Customer',
      helper: '0865907184 / District 1, Ho Chi Minh City',
    });
    expect(briefing.rows.find((row) => row.label === 'Chat record')).toMatchObject({
      helper: '2 retained message(s). Admin keeps chat history after service closeout.',
      value: 'Ready',
    });
  });

  it('uses monitoring status when the primary command is healthy', () => {
    const briefing = bookingOperatorPriorityBriefing({
      ...baseInput,
      primaryCommand: {
        ...baseInput.primaryCommand,
        tone: 'pill-success',
      },
    });

    expect(briefing.status).toBe('Monitoring');
    expect(briefing.tone).toBe('pill-success');
  });

  it('keeps customer choice visible when no final partner exists', () => {
    const briefing = bookingOperatorPriorityBriefing({
      ...baseInput,
      partnerLabel: 'Not selected',
      hasFinalPartner: false,
    });

    expect(briefing.steps[1]).toMatchObject({
      title: 'Keep Partner choice visible',
      detail:
        'Customer choice is still pending. Keep the shortlist, Partner alerts, and marketplace window easy to audit.',
    });
  });

  it('summarizes finance flags before closeout helper copy', () => {
    const briefing = bookingOperatorPriorityBriefing(baseInput);

    expect(briefing.rows[7]).toMatchObject({
      value: '1 item(s)',
      helper: '1 finance check(s): Capture required',
    });
  });
});
