import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import {
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
});
