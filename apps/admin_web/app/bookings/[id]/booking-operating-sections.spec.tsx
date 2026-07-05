import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import {
  BookingChatLifecycleSection,
  BookingCloseoutReadinessSection,
  BookingCommunicationMovementHandoffSection,
  BookingHandoffChecklistSection,
  BookingMarketplaceWalletEvidenceSection,
  BookingOperatingLedgerSection,
  BookingOperatingSnapshotSection,
  BookingOperatingTimelineSection,
} from './booking-operating-sections';

describe('Booking operating sections', () => {
  it('uses shared Vuexy badge atoms instead of raw operating pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-operating-sections.tsx', 'utf8');

    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(source).not.toContain('<div className={`ops-task-note');
    expect(source).not.toContain('<span className={`pill ${marketplaceWalletEvidence.tone}`}>');
    expect(source).not.toContain('<span className={`pill ${row.tone}`}>{row.status}</span>');
    expect(source).not.toContain('<span className="pill pill-info">{operatingLedger.length} record areas</span>');
    expect(source).not.toContain('<span className={`pill ${closeoutReadiness.tone}`}>{closeoutReadiness.status}</span>');
    expect(source).not.toContain('<span className={`pill ${operatingTimelinePillTone(tone)}`}>{item.status}</span>');
  });

  it('renders marketplace wallet evidence rows as compact ledgers', () => {
    const section = BookingMarketplaceWalletEvidenceSection({
      marketplaceWalletEvidence: {
        cards: [
          {
            helper: 'One Partner joined.',
            href: '#marketplace',
            label: 'Participants',
            value: '1',
          },
        ],
        commandStrip: [
          {
            helper: 'Wallet has no hold.',
            href: '#wallet',
            label: 'Wallet',
            value: 'Clear',
          },
        ],
        rows: [
          {
            lane: 'Wallet gate',
            operatorUse: 'Use before allowing Partner participation.',
            record: 'No negative wallet balance.',
            scope: 'Marketplace participation',
            status: 'Clear',
            tone: 'pill-success',
          },
        ],
        status: 'Evidence linked',
        tone: 'pill-info',
      },
    });

    const rendered = normalizedMarkupText(section);

    expect(rendered).toContain('Marketplace participation and wallet evidence');
    expect(rendered).toContain('Wallet gate');
    expect(rendered).toContain('No negative wallet balance.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#marketplace', '#wallet']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'booking-settlement-ledger admin-mt-14',
        'booking-settlement-ledger admin-mt-12',
        'booking-settlement-ledger-row is-command',
        'card admin-section admin-mb-16',
        'booking-settlement-ledger-row',
        'pill pill-success',
      ]),
    );
    expect(classNamesIn(section)).not.toEqual(expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table']));
  });

  it('renders booking operating ledger rows with shared table styling and links', () => {
    const section = BookingOperatingLedgerSection({
      operatingLedger: [
        {
          area: 'Address',
          evidence: 'Service address snapshot retained.',
          href: '#address',
          status: 'Ready',
        },
      ],
    });

    const rendered = normalizedMarkupText(section);

    expect(rendered).toContain('Booking operating ledger');
    expect(rendered).toContain('1 record areas');
    expect(rendered).toContain('Address');
    expect(rendered).toContain('Service address snapshot retained.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#address']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table',
        'text-link',
      ]),
    );
  });

  it('renders the operating timeline with Vuexy timeline styling instead of a repeated list', () => {
    const section = BookingOperatingTimelineSection({
      operatingTimeline: [
        {
          at: '2026-06-19T08:40:00.000Z',
          detail: 'Completion location is captured only when the Partner taps complete.',
          id: 'completed-location',
          status: 'Recorded',
          title: 'Service completed',
          type: 'CLOSE',
        },
        {
          detail: 'Partner location should be captured only at action time.',
          id: 'missing-location',
          status: 'Pending',
          title: 'Partner location missing',
          type: 'LOC',
        },
      ],
    });

    const rendered = normalizedMarkupText(section);
    const classNames = classNamesIn(section);

    expect(rendered).toContain('Operating timeline');
    expect(rendered).toContain('Service completed');
    expect(rendered).toContain('Partner location missing');
    expect(rendered).toContain('Type CLOSE');
    expect(rendered).toContain('State Pending');
    expect(classNames).toEqual(
      expect.arrayContaining([
        'vuexy-basic-timeline booking-operating-timeline-list admin-mt-16',
        'card admin-section admin-mb-16',
        'vuexy-basic-timeline-dot is-success',
        'vuexy-basic-timeline-dot is-danger',
        'vuexy-basic-timeline-meta is-compact',
      ]),
    );
    expect(classNames).not.toContain('setup-stage-list admin-mt-12');
  });

  it('renders communication and movement events with the same Vuexy timeline styling', () => {
    const section = BookingCommunicationMovementHandoffSection({
      communicationMovementHandoff: {
        events: [
          {
            at: '2026-06-19T08:20:00.000Z',
            detail: 'Partner shared current location near the service address.',
            id: 'location-1',
            title: 'Partner location snapshot',
            type: 'LOC',
          },
          {
            at: '2026-06-19T08:10:00.000Z',
            detail: 'Booking alert failed on one disabled device.',
            id: 'alert-1',
            title: 'Arrival reminder',
            type: 'ALERT',
          },
          {
            at: '2026-06-19T08:00:00.000Z',
            detail: 'I am on the way.',
            id: 'chat-1',
            title: 'Partner: Nguyen',
            type: 'CHAT',
          },
        ],
        href: '#booking-activity',
        hrefLabel: 'Open full activity',
        metrics: [
          {
            helper: '3 message(s) kept in admin archive.',
            label: 'Chat room',
            value: 'Retained',
          },
        ],
        nextAction: 'Continue normal monitoring',
        nextDetail: 'Chat, alert, and movement evidence can be reviewed from this record.',
        noteClassName: 'ops-task-success',
        status: 'Handoff visible',
        tone: 'pill-success',
      },
    });

    const rendered = normalizedMarkupText(section);
    const classNames = classNamesIn(section);

    expect(rendered).toContain('Communication and movement handoff');
    expect(rendered).toContain('Partner location snapshot');
    expect(rendered).toContain('Arrival reminder');
    expect(rendered).toContain('Partner: Nguyen');
    expect(rendered).toContain('Channel LOC');
    expect(rendered).toContain('Evidence Partner movement');
    expect(rendered).toContain('Evidence Notification delivery');
    expect(rendered).toContain('Evidence Admin chat archive');
    expect(classNames).toEqual(
      expect.arrayContaining([
        'vuexy-basic-timeline booking-operating-timeline-list admin-mt-16',
        'card admin-section admin-mb-16',
        'vuexy-basic-timeline-dot is-success',
        'vuexy-basic-timeline-dot is-warning',
        'vuexy-basic-timeline-dot is-info',
      ]),
    );
    expect(classNames).not.toContain('setup-stage-list admin-mt-12');
  });

  it('renders chat lifecycle as a compact Vuexy timeline', () => {
    const section = BookingChatLifecycleSection({
      chatLifecycle: {
        adminDetail: 'Full chat archive is retained for support.',
        adminState: 'Retained',
        customerDetail: 'Customer can see the room until service closeout.',
        customerState: 'Visible',
        partnerDetail: 'Partner can coordinate arrival and service handoff.',
        partnerState: 'Active',
        roomLabel: 'room-abcd',
        status: 'Chat ready',
        tone: 'pill-success',
      },
      messageCount: 5,
    });

    const rendered = normalizedMarkupText(section);
    const classNames = classNamesIn(section);

    expect(rendered).toContain('Chat lifecycle and retention');
    expect(rendered).toContain('Mobile customer app');
    expect(rendered).toContain('Mobile Partner app');
    expect(rendered).toContain('Admin archive');
    expect(rendered).toContain('Surface Customer app');
    expect(rendered).toContain('Room room-abcd');
    expect(rendered).toContain('Messages 5 retained');
    expect(classNames).toEqual(
      expect.arrayContaining([
        'vuexy-basic-timeline booking-operating-timeline-list admin-mt-16',
        'card admin-section admin-mb-16',
        'vuexy-basic-timeline-dot is-success',
      ]),
    );
    expect(classNames).not.toContain('service-trace-summary admin-mt-12');
  });

  it('renders closeout readiness with only unresolved focus items', () => {
    const section = BookingCloseoutReadinessSection({
      bookingStatus: 'CANCELLED',
      closeoutReadiness: {
        helper: 'Payment should be checked before the next handoff or closeout.',
        items: [
          {
            detail: 'Customer linked.',
            href: '#customer',
            id: 'customer-record',
            label: 'Customer',
            owner: 'Support',
            status: 'Customer and address linked',
          },
          {
            detail: 'MOMO / AUTHORIZED / 500.000 VND',
            href: '#payment',
            id: 'payment-state',
            label: 'Payment',
            owner: 'Finance',
            status: 'Payment closeout pending',
          },
        ],
        openItems: [
          {
            detail: 'MOMO / AUTHORIZED / 500.000 VND',
            href: '#payment',
            id: 'payment-state',
            label: 'Payment',
            owner: 'Finance',
            status: 'Payment closeout pending',
          },
        ],
        status: '1 closeout item(s)',
        tone: 'pill-warn',
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Closeout readiness');
    expect(rendered).toContain('Closeout focus');
    expect(rendered).toContain('Payment: Payment closeout pending');
    expect(rendered).toContain('Clear before the next handoff.');
    expect(rendered).not.toContain('Customer and address linked');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#payment']));
    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
  });

  it('renders a compact closeout success state when there are no exceptions', () => {
    const section = BookingCloseoutReadinessSection({
      bookingStatus: 'COMPLETED',
      closeoutReadiness: {
        helper: 'All factual records needed for this booking stage are aligned.',
        items: [],
        openItems: [],
        status: 'Ready',
        tone: 'pill-success',
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No closeout exceptions for the current booking stage.');
    expect(rendered).toContain('No exceptions');
    expect(classNamesIn(section)).toContain('card admin-section admin-mb-16');
  });

  it('renders operating snapshot and handoff checklist with shared Vuexy surfaces', () => {
    const sections = [
      BookingOperatingSnapshotSection({
        operatingSnapshot: {
          facts: [{ helper: 'Customer choice retained.', label: 'Choice', value: 'Recorded' }],
          href: '#participants',
          hrefLabel: 'Open participants',
          nextAction: 'Monitor service handoff',
          nextDetail: 'No blocking issue is active.',
          noteClassName: 'ops-task-success',
          status: 'Ready',
          tone: 'pill-success',
        },
      }),
      BookingHandoffChecklistSection({
        handoffChecklist: [
          {
            detail: 'Customer app state is visible.',
            href: '#customer',
            id: 'customer-handoff',
            label: 'Customer',
            status: 'Open customer',
            title: 'Customer handoff',
          },
        ],
      }),
    ];

    const classNames = sections.flatMap(classNamesIn);

    expect(normalizedText(sections)).toContain('Booking operating snapshot');
    expect(normalizedText(sections)).toContain('Booking handoff checklist');
    expect(classNames.filter((className) => className === 'card admin-section admin-mb-16')).toHaveLength(2);
  });
});

function normalizedMarkupText(value: ReactNode) {
  return renderToStaticMarkup(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
