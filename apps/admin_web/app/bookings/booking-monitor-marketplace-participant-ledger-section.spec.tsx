import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMarketplaceParticipantLedgerSection } from './booking-monitor-marketplace-participant-ledger-section';

describe('BookingMonitorMarketplaceParticipantLedgerSection', () => {
  it('renders participant ledger pills, operations cards, and row details', () => {
    const booking = {
      id: 'booking_123456789',
      payment: { currency: 'VND' },
      services: [
        {
          price: 120000,
          service: {
            basePrice: 120000,
            durationMin: 60,
            name: 'Foot Massage',
            payoutRules: [],
          },
        },
      ],
      status: 'OPEN_MATCHING',
    } as unknown as AdminBooking;
    const participant = {
      id: 'participant_123',
      providerProfile: { user: { phone: '+84900000000' } },
      providerStatusAtJoin: 'ONLINE',
    } as NonNullable<AdminBooking['participants']>[number];

    const section = BookingMonitorMarketplaceParticipantLedgerSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerPills: [{ label: 'Marketplace participants 1', tone: 'pill-info' }],
      marketplaceLedgerRows: [
        {
          alertLabel: 'Alert delivered',
          alertTone: 'pill-info',
          booking,
          chatHandoffLabel: 'Chat ready',
          chatHandoffTone: 'pill-success',
          choiceLabel: 'Customer-selectable',
          choiceNextStep: 'Wait for customer choice.',
          choiceReason: 'Partner is selectable.',
          choiceTone: 'pill-info',
          distanceLabel: '2 km',
          distancePolicyHelper: 'Inside service radius.',
          distancePolicyLabel: 'Inside radius',
          distancePolicyTone: 'pill-success',
          evidenceDetail: 'Participant retained.',
          evidenceLabel: 'Ledger row',
          evidenceTone: 'pill-info',
          joinedLabel: 'Joined now',
          participant,
          partnerLabel: 'Partner A',
          respondedLabel: 'No response yet',
          roleLabel: 'Marketplace participant',
          statusLabel: 'Waiting',
          statusTone: 'pill-warn',
          walletLabel: 'Wallet clear',
          walletTone: 'pill-success',
          windowLabel: '8m left',
        },
      ],
      marketplaceOperationsCards: [
        {
          detail: 'Bookings still visible for Partner participation or customer choice.',
          href: '/bookings?view=marketplace',
          title: 'Open marketplace',
          tone: 'pill-warn',
          value: '1',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Marketplace participants 1');
    expect(rendered).toContain('Open marketplace');
    expect(rendered).toContain('Customer A');
    expect(rendered).toContain('Partner A');
    expect(rendered).toContain('Wallet clear');
    expect(headingTextsIn(section)).toEqual([]);
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=marketplace', '/bookings/booking_123456789']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'text-link']),
    );
  });

  it('renders the empty participant state', () => {
    const section = BookingMonitorMarketplaceParticipantLedgerSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerPills: [],
      marketplaceLedgerRows: [],
      marketplaceOperationsCards: [],
    });

    expect(normalizedText(section)).toContain('No participant records match the current booking filters.');
  });

  it('hides clear operation summary cards when only non-action states remain', () => {
    const section = BookingMonitorMarketplaceParticipantLedgerSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerPills: [],
      marketplaceLedgerRows: [],
      marketplaceOperationsCards: [
        {
          detail: 'Selected Partners are already handled.',
          href: '/bookings?view=marketplace',
          title: 'Selected Partners',
          tone: 'pill-success',
          value: '2',
        },
        {
          detail: 'No customer choice wait.',
          href: '/bookings?view=customer-choice',
          title: 'Customer choice',
          tone: 'pill-neutral',
          value: '0',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('No marketplace participant action is needed');
    expect(rendered).not.toContain('Selected Partners');
    expect(rendered).not.toContain('Customer choice');
  });
});
