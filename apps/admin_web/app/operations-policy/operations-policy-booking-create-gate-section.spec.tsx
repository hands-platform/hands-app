import { OperationsPolicyBookingCreateGateSection } from './operations-policy-booking-create-gate-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyBookingCreateGateSection', () => {
  it('renders booking gate rows and recent blocked attempts', () => {
    const section = OperationsPolicyBookingCreateGateSection({
      review: {
        currentPolicyLabel: 'Distance gates active',
        recentAttempts: [
          {
            createdAt: '2026-06-14T10:00:00.000Z',
            detail: 'Booking address was outside the enabled service area.',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            id: 'audit-booking-create-rejected-1',
            pillClass: 'pill-danger',
            reason: 'Service area',
          },
        ],
        rows: [
          {
            current: 'Required',
            defaultValue: 'Required',
            evidence: '1 reject(s)',
            gate: 'Service area',
            href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
            key: 'booking.service_area_required',
            operatorMeaning: 'Booking address must be inside an enabled Vietnam service area.',
            pillClass: 'pill-success',
          },
        ],
        summary: [
          {
            helper: 'Recent booking create requests stopped before payment and matching.',
            label: 'Blocked attempts',
            value: '1',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Booking create gate controls');
    expect(rendered).toContain('Distance gates active');
    expect(rendered).toContain('Service area');
    expect(rendered).toContain('Blocked booking create attempt');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=blocked-create',
        '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      ]),
    );
  });

  it('renders the empty blocked-create state', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyBookingCreateGateSection({
        review: {
          currentPolicyLabel: 'Distance gates active',
          recentAttempts: [],
          rows: [],
          summary: [],
        },
      }),
    );

    expect(rendered).toContain('No booking create gate rejections are currently recorded.');
  });
});
