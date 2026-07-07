import { bookingDecisionEvidenceGuardrails } from './booking-decision-evidence-guardrails';

const baseInput = {
  bookingStatus: 'CREATED',
  hasAddressSnapshot: true,
  addressSnapshotLabel: 'District 1, Ho Chi Minh City',
  addressPinLabel: '10.7769, 106.7009',
  hasSelectedPartner: false,
  selectedPartnerLabel: 'No selected Partner',
  participantCount: 0,
  preferredPartnerLabel: 'Linh Wellness',
  hasChatRoom: false,
  chatRoomShortId: null,
  messageCount: 0,
  hasLatestLocation: false,
  latestLocationAtLabel: null,
  latestLocationAtValue: null,
  notificationCount: 0,
  operatorNoteCount: 0,
  hasOpsTrail: false,
  paymentStatus: null,
  paymentMethod: null,
  paymentAmountLabel: 'No payment amount',
  refundRowCount: 0,
  cashFeeDebtNeedsSettlement: false,
  platformFeeLabel: '0 VND',
  withholdingLabel: '0 VND',
  walletLedgerLabel: 'No wallet movement',
  closeoutOpenItemLabels: [],
  financeLedgerRowCount: 0,
  partnerPayoutLabel: 'No Partner payout',
};

describe('bookingDecisionEvidenceGuardrails', () => {
  it('requires a confirmed service address for booking operations', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      hasAddressSnapshot: false,
      addressSnapshotLabel: 'No confirmed address',
      addressPinLabel: 'No pin',
    });

    expect(rows[0]).toMatchObject({
      id: 'required-address',
      status: 'Needs repair',
      tone: 'pill-danger',
      evidence: 'No confirmed service address is attached.',
    });
    expect(rows[0].scope).not.toContain('source of truth');
  });

  it('does not echo raw coordinate labels in required address evidence', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      addressSnapshotLabel: 'District 1, Ho Chi Minh City',
      addressPinLabel: '10.7769, 106.7009',
    });

    expect(rows[0]).toMatchObject({
      id: 'required-address',
      evidence: 'District 1, Ho Chi Minh City / Confirmed service address saved',
    });
    expect(JSON.stringify(rows[0])).not.toMatch(/\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/);
  });

  it('keeps open matching visible without auto-selecting a Partner', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      participantCount: 3,
    });

    expect(rows[1]).toMatchObject({
      id: 'required-final-partner',
      status: 'Customer choice pending',
      tone: 'pill-info',
      evidence: '3 marketplace participant(s) / preferred Linh Wellness',
    });
  });

  it('requires retained chat after a booking is matched', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasSelectedPartner: true,
      selectedPartnerLabel: 'Linh Wellness',
    });

    expect(rows[2]).toMatchObject({
      id: 'required-chat',
      status: 'Repair needed',
      tone: 'pill-danger',
      evidence: 'Matched or service-stage booking has no retained room.',
    });
    expect(rows[2]).toMatchObject({
      scope: 'Matched bookings need customer-Partner chat; admin keeps the record after mobile closeout.',
      status: 'Repair needed',
    });
  });

  it('blocks cash fee debt until settlement is recorded', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      paymentAmountLabel: '450.000 VND',
      cashFeeDebtNeedsSettlement: true,
      platformFeeLabel: '80.000 VND',
      withholdingLabel: '20.000 VND',
      walletLedgerLabel: '-80.000 VND Partner wallet',
    });

    expect(rows[5]).toMatchObject({
      id: 'finance-cash-debt',
      scope:
        'Cash bookings can create Partner fee debt; negative wallet gates final acceptance, service start, and payout release.',
      status: 'Settlement required',
      tone: 'pill-danger',
      evidence: '80.000 VND HANDS fee / 20.000 VND withholding / -80.000 VND Partner wallet',
      nextStep: 'Record verified company deposit or approved admin offset before clearing the block.',
      href: '/cash-settlements',
    });
  });

  it('keeps supporting location timestamps available for shared date rendering', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      messageCount: 2,
      hasLatestLocation: true,
      latestLocationAtLabel: '07 Jun 2026 10:31',
      latestLocationAtValue: '2026-06-07T03:31:00.000Z',
      notificationCount: 1,
      operatorNoteCount: 1,
    });

    expect(rows[3]).toMatchObject({
      id: 'supporting-context',
      evidence: '07 Jun 2026 10:31',
      evidenceDateTimePrefix: '2 message(s) / location ',
      evidenceDateTimeSuffix: ' / 1 alert row(s) / 1 note(s)',
      evidenceDateTimeValue: '2026-06-07T03:31:00.000Z',
    });
  });

  it('surfaces closeout open items before completion finance release', () => {
    const rows = bookingDecisionEvidenceGuardrails({
      ...baseInput,
      closeoutOpenItemLabels: ['Payment', 'Cash'],
      financeLedgerRowCount: 5,
      partnerPayoutLabel: '380.000 VND',
    });

    expect(rows[6]).toMatchObject({
      id: 'finance-closeout',
      status: '2 item(s) open',
      tone: 'pill-warn',
      evidence: 'Payment, Cash',
    });
  });
});
