import {
  marketplaceParticipantLedgerBoundaryCopy,
  participantChoicePresentation,
  participantReadableDecision,
} from './admin-participant-ledger-copy';

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

describe('marketplaceParticipantLedgerBoundaryCopy', () => {
  it('explains that only actual marketplace participation is retained', () => {
    expect(marketplaceParticipantLedgerBoundaryCopy()).toEqual({
      helper:
        'Marketplace visibility is not an activity record. If the partner wallet is negative, the partner app warns before final acceptance or service start while actual participant rows remain the evidence source.',
      pills: [
        'Actual participant rows only',
        'Negative wallet blocks final acceptance and service start',
        'No view-only activity log',
        'Customer-selected final partner only',
        'No automatic final assignment',
      ],
    });
  });
});

describe('participantChoicePresentation', () => {
  it('keeps selected rows prominent in marketplace ledgers', () => {
    expect(
      participantChoicePresentation({
        isFinal: true,
        isPreferred: false,
        status: 'SELECTED',
        customerSelectable: true,
        anotherFinalPartnerSelected: false,
      }),
    ).toEqual({
      choiceLabel: 'Selected by customer',
      choiceTone: 'pill-success',
      choiceReason: 'Customer selected this partner as the final match.',
      choiceNextStep: 'Keep chat, payment, location, and closeout evidence linked to this row.',
    });
  });

  it('explains eligible marketplace rows without implying auto assignment', () => {
    expect(
      participantChoicePresentation({
        isFinal: false,
        isPreferred: false,
        status: 'ACCEPTED',
        customerSelectable: true,
        anotherFinalPartnerSelected: false,
      }),
    ).toEqual({
      choiceLabel: 'Customer-selectable',
      choiceTone: 'pill-info',
      choiceReason:
        'Customer can choose this partner as the final match; the system will not auto-assign.',
      choiceNextStep:
        'Wait for the customer final choice; operators must not assign the final partner manually.',
    });
  });

  it('keeps non-selected rows as history after the customer chose another partner', () => {
    expect(
      participantChoicePresentation({
        isFinal: false,
        isPreferred: false,
        status: 'ACCEPTED',
        customerSelectable: true,
        anotherFinalPartnerSelected: true,
      }),
    ).toEqual({
      choiceLabel: 'Not final choice',
      choiceTone: 'pill-neutral',
      choiceReason: 'Customer already selected another final partner.',
      choiceNextStep: 'Keep this row as participation history only.',
    });
  });
});
