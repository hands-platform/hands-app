import { readFileSync } from 'node:fs';
import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorMarketplaceParticipantLedgerSection } from './booking-monitor-marketplace-participant-ledger-section';

describe('BookingMonitorMarketplaceParticipantLedgerSection', () => {
  it('uses shared Vuexy badge atoms for participant summary and row chips', () => {
    const source = readFileSync('app/bookings/booking-monitor-marketplace-participant-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-card">');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-14">');
    expect(source).not.toContain('<span className={`pill ${pill.tone}`} key={pill.label}>');
    expect(source).not.toContain('<span className="pill">Participant evidence</span>');
    expect(source).not.toContain('<span className="pill">{row.roleLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.evidenceTone}`} title={row.evidenceDetail}>');
    expect(source).not.toContain('<span className={`pill ${row.statusTone}`}>{row.statusLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.distancePolicyTone}`} title={row.distancePolicyHelper}>');
    expect(source).not.toContain('<span className={`pill ${row.alertTone}`}>{row.alertLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.choiceTone}`} title={row.choiceReason}>');
    expect(source).not.toContain('<span className={`pill ${row.chatHandoffTone}`} title={row.choiceNextStep}>');
  });

  it('uses the shared Vuexy text link atom for marketplace participant booking links', () => {
    const source = readFileSync('app/bookings/booking-monitor-marketplace-participant-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

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
      providerProfile: { id: 'partner_123', user: { phone: '+84900000000' } },
      providerStatusAtJoin: 'ONLINE',
      status: 'JOINED',
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
      expect.arrayContaining([
        '/bookings?view=marketplace',
        '/bookings/booking_123456789',
        '/partners/partner_123',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-avatar-status-dot is-matching',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
        'text-link',
        'vuexy-booking-person',
      ]),
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
