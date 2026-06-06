import { participantReadableDecision } from './admin-participant-ledger-copy';

describe('participantReadableDecision', () => {
  it('describes a customer-selected final partner', () => {
    expect(
      participantReadableDecision({
        isFinal: true,
        isPreferred: false,
        status: 'SELECTED',
        customerSelectable: true,
      }),
    ).toEqual({
      title: 'Final customer choice',
      decision: 'Customer selected this partner as the final match.',
      nextStep: 'Keep chat, payment, location, and closeout evidence linked to this row.',
    });
  });

  it('describes a selectable marketplace participant without auto assignment', () => {
    expect(
      participantReadableDecision({
        isFinal: false,
        isPreferred: false,
        status: 'JOINED',
        customerSelectable: true,
      }),
    ).toEqual({
      title: 'Customer-selectable marketplace option',
      decision: 'Customer can choose this partner as the final match; the system will not auto-assign.',
      nextStep: 'Wait for the customer final choice; operators must not assign the final partner manually.',
    });
  });

  it('describes first-pick participation before acceptance', () => {
    expect(
      participantReadableDecision({
        isFinal: false,
        isPreferred: true,
        status: 'JOINED',
        customerSelectable: false,
      }).title,
    ).toBe('First-pick response pending');
  });

  it('describes rejected rows as archived evidence', () => {
    expect(
      participantReadableDecision({
        isFinal: false,
        isPreferred: false,
        status: 'REJECTED',
        customerSelectable: false,
      }).title,
    ).toBe('Archived decline evidence');
  });
});
