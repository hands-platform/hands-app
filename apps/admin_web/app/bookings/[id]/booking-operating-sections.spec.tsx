import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import {
  BookingCloseoutReadinessSection,
  BookingMarketplaceWalletEvidenceSection,
  BookingOperatingLedgerSection,
  BookingOperatingTimelineSection,
} from './booking-operating-sections';

describe('Booking operating sections', () => {
  it('renders marketplace wallet evidence rows with shared table styling', () => {
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

    const rendered = normalizedText(section);

    expect(rendered).toContain('Marketplace participation and wallet evidence');
    expect(rendered).toContain('Wallet gate');
    expect(rendered).toContain('No negative wallet balance.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#marketplace', '#wallet']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-success']),
    );
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

    const rendered = normalizedText(section);

    expect(rendered).toContain('Booking operating ledger');
    expect(rendered).toContain('1 record areas');
    expect(rendered).toContain('Address');
    expect(rendered).toContain('Service address snapshot retained.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#address']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'text-link']),
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

    const rendered = normalizedText(section);
    const classNames = classNamesIn(section);

    expect(rendered).toContain('Operating timeline');
    expect(rendered).toContain('Service completed');
    expect(rendered).toContain('Partner location missing');
    expect(rendered).toContain('Type CLOSE');
    expect(rendered).toContain('State Pending');
    expect(classNames).toEqual(
      expect.arrayContaining([
        'vuexy-basic-timeline booking-operating-timeline-list admin-mt-16',
        'vuexy-basic-timeline-dot is-success',
        'vuexy-basic-timeline-dot is-danger',
        'vuexy-basic-timeline-meta is-compact',
      ]),
    );
    expect(classNames).not.toContain('setup-stage-list admin-mt-12');
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
  });
});
