type ParticipantChatHandoffInput = {
  chatRequired: boolean;
  customerSelectable: boolean;
  finalPartnerRecorded: boolean;
  hasChatRoom: boolean;
  isFinal: boolean;
  status: string;
};

export function participantChatHandoffState(input: ParticipantChatHandoffInput) {
  if (input.isFinal) {
    if (input.hasChatRoom) {
      return { label: 'Chat retained', tone: 'pill-success' };
    }

    if (input.chatRequired) {
      return { label: 'Chat missing', tone: 'pill-danger' };
    }

    return { label: 'Final choice recorded', tone: 'pill-success' };
  }

  if (input.finalPartnerRecorded) {
    return { label: 'Not final Partner', tone: 'pill-neutral' };
  }

  if (input.customerSelectable) {
    return { label: 'Waiting customer', tone: 'pill-warn' };
  }

  if (input.status === 'REJECTED') {
    return { label: 'No handoff', tone: 'pill-neutral' };
  }

  return { label: 'Evidence only', tone: 'pill-neutral' };
}
