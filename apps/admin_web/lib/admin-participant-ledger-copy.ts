export type ParticipantReadableDecisionInput = {
  isFinal: boolean;
  isPreferred: boolean;
  status: string;
  customerSelectable: boolean;
};

export type ParticipantChoicePresentationInput = ParticipantReadableDecisionInput & {
  anotherFinalPartnerSelected: boolean;
};

export function marketplaceParticipantLedgerBoundaryCopy() {
  return {
    helper:
      'Marketplace visibility is not an activity record. If the partner wallet is negative, the partner app blocks marketplace booking participation with an unpaid HANDS fee message before any participant row is created.',
    pills: [
      'Actual participant rows only',
      'Negative wallet blocks marketplace participation',
      'No view-only activity log',
      'Customer-selected final partner only',
      'No automatic final assignment',
    ],
  };
}

export function participantReadableDecision(input: ParticipantReadableDecisionInput) {
  if (input.isFinal || input.status === 'SELECTED') {
    return {
      title: 'Final customer choice',
      decision: 'Customer selected this partner as the final match.',
      nextStep: 'Keep chat, payment, location, and closeout evidence linked to this row.',
    };
  }

  if (input.customerSelectable) {
    return {
      title: input.isPreferred
        ? 'Customer-selectable first-pick option'
        : 'Customer-selectable marketplace option',
      decision: 'Customer can choose this partner as the final match; the system will not auto-assign.',
      nextStep: 'Wait for the customer final choice; operators must not assign the final partner manually.',
    };
  }

  if (input.status === 'REJECTED') {
    return {
      title: 'Archived decline evidence',
      decision: 'Partner declined or could not take this booking.',
      nextStep: 'Keep the row as response evidence only.',
    };
  }

  if (input.isPreferred && input.status === 'JOINED') {
    return {
      title: 'First-pick response pending',
      decision:
        'First-pick participation is retained, but the partner must accept before customer choice.',
      nextStep: 'Monitor the first-pick response window and marketplace shortlist visibility.',
    };
  }

  return {
    title: 'Archived participation evidence',
    decision:
      'Participant row is retained as evidence, but it is not a customer selection candidate.',
    nextStep: 'Wait for a customer-selectable participant status or a retained final selected row.',
  };
}

export function participantChoicePresentation(input: ParticipantChoicePresentationInput) {
  const readable = participantReadableDecision(input);

  if (input.isFinal || input.status === 'SELECTED') {
    return {
      choiceLabel: 'Selected by customer',
      choiceTone: 'pill-success',
      choiceReason: readable.decision,
      choiceNextStep: readable.nextStep,
    };
  }

  if (input.anotherFinalPartnerSelected) {
    return {
      choiceLabel: 'Not final choice',
      choiceTone: 'pill-neutral',
      choiceReason: 'Customer already selected another final partner.',
      choiceNextStep: 'Keep this row as participation history only.',
    };
  }

  if (input.customerSelectable) {
    return {
      choiceLabel: 'Customer-selectable',
      choiceTone: 'pill-info',
      choiceReason: readable.decision,
      choiceNextStep: readable.nextStep,
    };
  }

  if (input.isPreferred && input.status === 'JOINED') {
    return {
      choiceLabel: 'Evidence-only',
      choiceTone: 'pill-warn',
      choiceReason: readable.decision,
      choiceNextStep: readable.nextStep,
    };
  }

  return {
    choiceLabel: 'Evidence-only',
    choiceTone: 'pill-neutral',
    choiceReason: readable.decision,
    choiceNextStep: readable.nextStep,
  };
}
