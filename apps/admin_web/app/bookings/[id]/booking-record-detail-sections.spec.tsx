import { renderToStaticMarkup } from 'react-dom/server';

import { BookingRecordDetailSections } from './booking-record-detail-sections';

type SectionsProps = Parameters<typeof BookingRecordDetailSections>[0];

const participantRow: SectionsProps['participantLedger']['rows'][number] = {
  id: 'participant_1',
  partner: 'Partner One',
  avatarStatus: 'working',
  identity: '+84900000000',
  href: '/partners/partner_1',
  evidenceTone: 'pill-info',
  evidenceLabel: 'Accepted',
  evidenceDetail: 'Partner accepted the customer request.',
  roleTone: 'pill-success',
  role: 'Final Partner',
  statusTone: 'pill-success',
  status: 'Selected',
  choiceTone: 'pill-success',
  choiceState: 'Customer-selected',
  operatorStatus: 'No action needed.',
  decision: 'Customer selected this Partner.',
  eligibilityLabel: 'Selectable',
  eligibilityTone: 'pill-success',
  eligibilityReason: 'Inside active booking rules.',
  eligibilityNextStep: 'Continue monitoring.',
  distance: '2.1 km',
  distancePolicyLabel: 'Inside radius',
  distancePolicyTone: 'pill-success',
  distancePolicyHelper: 'Within service area.',
  facts: [{ label: 'Wallet', value: 'Clear', tone: 'pill-success' }],
  timing: 'Joined 2m ago',
  operatorUse: 'Audit selected Partner.',
};

const participantLedger: SectionsProps['participantLedger'] = {
  status: 'Ledger ready',
  tone: 'pill-success',
  boundary: {
    helper: 'Only Partners with real booking participation are retained here.',
    pills: ['Activity boundary', 'Wallet gate enforced', 'Evidence retained'],
  },
  cards: [
    {
      href: '#participants',
      label: 'Participants',
      value: '1',
      helper: 'Actual marketplace records.',
    },
  ],
  selectionTrace: [
    {
      label: 'Customer choice',
      value: 'Partner One',
      helper: 'Final customer-selected Partner.',
      status: 'Ready',
      tone: 'pill-success',
    },
  ],
  lifecycleRows: [
    {
      stage: 'Acceptance',
      scope: 'Partner response',
      status: 'Accepted',
      evidence: 'Partner accepted inside the active window.',
      operatorUse: 'No intervention needed.',
      tone: 'pill-success',
    },
  ],
  rows: [participantRow],
};

function buildProps(overrides: Partial<SectionsProps> = {}): SectionsProps {
  return {
    cashFeeSettlementPath: {
      status: 'Not cash',
      tone: 'pill-neutral',
      cards: [
        {
          href: '#payment',
          label: 'Payment',
          value: 'Card',
          helper: 'No cash settlement lane.',
        },
      ],
      rows: [
        {
          lane: 'Cash fee',
          scope: 'Booking settlement',
          status: 'Closed',
          tone: 'pill-success',
          evidence: 'No cash balance remains.',
          nextStep: 'Monitor payout closeout.',
        },
      ],
    },
    chatEvidenceRows: [],
    chatMessages: [],
    customerProfileId: 'customer_1',
    customerRows: [{ label: 'Customer phone', value: '+84911111111' }],
    finalPartnerId: 'partner_1',
    financeRows: [{ label: 'Finance state', value: 'Balanced' }],
    hasLatestPartnerLocation: true,
    handoffRows: [{ label: 'Handoff status', value: 'Ready' }],
    locationTrailRows: [
      {
        badge: 'Action',
        badgeTone: 'pill-info',
        coordinate: 'District 1, Ho Chi Minh City',
        detail: 'Pin 10.1, 106.1',
        id: 'location_1',
        label: 'Booking action snapshot',
        recordedAt: 'Just now',
      },
    ],
    participantLedger,
    paymentRows: [{ label: 'Payment status', value: 'Captured' }],
    serviceRows: [{ label: 'Service', value: 'Deep tissue massage' }],
    timelineStages: [
      {
        label: 'Requested',
        value: 'Done',
        hint: 'Booking request received.',
        done: true,
      },
    ],
    ...overrides,
  };
}

function renderSections(overrides: Partial<SectionsProps> = {}) {
  return renderToStaticMarkup(<BookingRecordDetailSections {...buildProps(overrides)} />).replace(/\s+/g, ' ');
}

describe('BookingRecordDetailSections', () => {
  it('renders participant ledger details and toolbar-linked record state', () => {
    const markup = renderSections();

    expect(markup).toContain('Actual marketplace participant ledger');
    expect(markup).toContain('class="card admin-section" id="flow"');
    expect(markup).toContain('class="card admin-section" id="participants"');
    expect(markup).toContain('class="ops-section-header admin-section-header"');
    expect(markup).toContain('Partner participation rows');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('Wallet: Clear');
    expect(markup).toContain('booking-participant-row-list');
    expect(markup).toContain('card admin-card booking-participant-row-card');
    expect(markup).toContain('aria-label="Participant selection trace rows"');
    expect(markup).toContain('aria-label="Participant lifecycle rows"');
    expect(markup).toContain('Cash fee settlement path');
    expect(markup).toContain('booking-settlement-ledger');
    expect(markup).toContain('aria-label="Cash fee settlement rows"');
    expect(markup).not.toContain('table vuexy-data-table');
    expect(markup).not.toContain('setup-stage-list');
    expect(markup).toContain('admin-avatar-status-dot is-working');
    expect(markup).toContain('vuexy-booking-person');
    expect(markup.match(/vuexy-booking-person/g)).toHaveLength(1);
    expect(markup.match(/Linked in toolbar/g)).toHaveLength(2);
    expect(markup).toContain('href="/partners/partner_1"');
    expect(markup).toContain('Location evidence');
    expect(markup).toContain('1 snapshot');
    expect(markup).toContain('aria-label="Booking location evidence rows"');
    expect(markup).toContain('Booking action snapshot');
    expect(markup).toContain('District 1, Ho Chi Minh City');
    expect(markup).toContain('Pin 10.1, 106.1');
  });

  it('renders empty participant and handoff states', () => {
    const markup = renderSections({
      finalPartnerId: null,
      participantLedger: {
        ...participantLedger,
        rows: [],
      },
    });

    expect(markup).toContain('Partner record link pending');
    expect(markup).toContain('No Partner participation has been recorded for this booking yet.');
  });

  it('renders post-match cancellation chat evidence inside the booking transcript', () => {
    const markup = renderSections({
      chatEvidenceRows: [
        {
          label: 'Review state',
          value: 'Pending admin decision',
          helper: '30m after match / Fee held',
        },
        {
          label: 'Retained chat',
          value: '1 message',
          helper: 'Use this transcript before approving or holding the fee decision.',
        },
      ],
      chatMessages: [
        {
          id: 'message_1',
          body: 'I need to cancel after matching.',
          createdAt: '2026-06-13T03:29:00.000Z',
          sender: {
            id: 'partner_user_1',
            fullName: 'Partner One',
            roles: ['PROVIDER'],
          },
        },
      ],
    });

    expect(markup).toContain('Chat evidence');
    expect(markup).toContain('1 message');
    expect(markup).toContain('Booking chat evidence snapshot');
    expect(markup).toContain('Review state');
    expect(markup).toContain('Pending admin decision');
    expect(markup).toContain('30m after match / Fee held');
    expect(markup).toContain('Retained chat');
    expect(markup).toContain('booking-chat-evidence-grid is-detail');
    expect(markup).not.toContain('I need to cancel after matching.');
  });
});
