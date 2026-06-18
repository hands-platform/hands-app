import { classNamesIn, hrefsIn, normalizedText } from '../booking-section-test-utils';
import { BookingOperatorQueueSections } from './booking-operator-sections';

describe('BookingOperatorQueueSections', () => {
  it('renders command queue and action availability table with shared table styling', () => {
    const section = BookingOperatorQueueSections({
      bookingId: 'booking-1',
      operatorActionMatrix: [
        {
          action: 'Payment capture',
          available: true,
          evidence: 'Payment is authorized.',
          href: '#booking-ops',
          hrefLabel: 'Open gate',
          operatorRule: 'Capture only after Partner completion evidence.',
          status: 'Available',
          tone: 'pill-success',
        },
      ],
      operatorCommandQueue: {
        commands: [
          {
            action: {
              href: '#booking-ops',
              label: 'Open ops',
              type: 'link',
            },
            detail: 'Review the manual action gate.',
            id: 'command-1',
            label: '1',
            owner: 'Ops',
            title: 'Check payment gate',
            tone: 'pill-info',
          },
        ],
        labels: [
          {
            helper: 'One same-shift action.',
            label: 'Queued',
            value: '1',
          },
        ],
        status: 'Action needed',
        tone: 'pill-warn',
      },
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Operator command queue');
    expect(rendered).toContain('Check payment gate');
    expect(rendered).toContain('Operator action availability');
    expect(rendered).toContain('1 / 1 available');
    expect(rendered).toContain('Payment capture');
    expect(rendered).toContain('Payment is authorized.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#booking-ops']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table', 'pill pill-success']),
    );
  });
});
