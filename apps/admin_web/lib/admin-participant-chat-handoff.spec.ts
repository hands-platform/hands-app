import { participantChatHandoffState } from './admin-participant-chat-handoff';

describe('participant chat handoff state', () => {
  it('marks the final selected Partner chat as retained when a chat room exists', () => {
    expect(
      participantChatHandoffState({
        chatRequired: true,
        customerSelectable: true,
        finalPartnerRecorded: true,
        hasChatRoom: true,
        isFinal: true,
        status: 'SELECTED',
      }),
    ).toEqual({ label: 'Chat retained', tone: 'pill-success' });
  });

  it('flags a selected final Partner with missing retained chat', () => {
    expect(
      participantChatHandoffState({
        chatRequired: true,
        customerSelectable: true,
        finalPartnerRecorded: true,
        hasChatRoom: false,
        isFinal: true,
        status: 'SELECTED',
      }),
    ).toEqual({ label: 'Chat missing', tone: 'pill-danger' });
  });

  it('keeps non-final marketplace participants as evidence after customer final choice', () => {
    expect(
      participantChatHandoffState({
        chatRequired: true,
        customerSelectable: true,
        finalPartnerRecorded: true,
        hasChatRoom: true,
        isFinal: false,
        status: 'JOINED',
      }),
    ).toEqual({ label: 'Not final Partner', tone: 'pill-neutral' });
  });

  it('marks customer-selectable participants as waiting before final choice', () => {
    expect(
      participantChatHandoffState({
        chatRequired: false,
        customerSelectable: true,
        finalPartnerRecorded: false,
        hasChatRoom: false,
        isFinal: false,
        status: 'JOINED',
      }),
    ).toEqual({ label: 'Waiting customer', tone: 'pill-warn' });
  });
});
