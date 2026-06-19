import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import {
  BookingCloseoutReadinessSection,
  BookingMarketplaceWalletEvidenceSection,
  BookingOperatingLedgerSection,
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
