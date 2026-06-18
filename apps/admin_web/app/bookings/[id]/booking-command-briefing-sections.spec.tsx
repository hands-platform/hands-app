import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import { BookingMvpAuthorityContractSection } from './booking-command-briefing-sections';

describe('BookingMvpAuthorityContractSection', () => {
  it('renders authority contract rows with shared table styling and links', () => {
    const section = BookingMvpAuthorityContractSection({
      rows: [
        {
          contract: 'Vietnam-only service boundary',
          evidence: 'Booking address is inside supported service area.',
          href: '/operations-policy#service-boundary',
          operatorUse: 'Use this before approving booking creation disputes.',
          scope: 'Booking creation',
          status: 'Clear',
          tone: 'pill-success',
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('MVP authority contract');
    expect(rendered).toContain('Vietnam-only service boundary');
    expect(rendered).toContain('Booking address is inside supported service area.');
    expect(rendered).toContain('Use this before approving booking creation disputes.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/operations-policy', '/operations-policy#service-boundary']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'button button-secondary admin-inline-action',
        'pill pill-success',
      ]),
    );
  });
});
