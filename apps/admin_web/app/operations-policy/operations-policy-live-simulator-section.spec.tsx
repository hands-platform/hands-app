import { OperationsPolicyLiveSimulatorSection } from './operations-policy-live-simulator-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyLiveSimulatorSection', () => {
  it('renders the ready simulator state with partner links and checks', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      simulation: {
        checks: [
          {
            className: 'ops-task-done',
            detail: 'Fresh Partner locations are inside the current radius.',
            operatorAction: 'This can support a real wait screen.',
            pillClass: 'pill-success',
            status: 'Supply ready',
            title: 'Dispatch supply check',
          },
        ],
        metrics: [
          {
            helper: '10.7769, 106.7009',
            label: 'Reference location',
            value: 'Booking cmqbcwop...oqle',
          },
        ],
        partnerRows: [
          {
            distanceLabel: '2 km',
            id: 'provider-1',
            locationAgeLabel: '5m ago',
            name: 'Partner One',
            pillClass: 'pill-success',
            status: 'Fresh',
          },
        ],
        ready: true,
        timeline: [
          {
            className: 'timeline-active',
            detail: 'Marketplace list opens immediately.',
            step: '1',
            tags: [{ label: '10 min', tone: 'pill-success' }],
            title: 'Customer creates direct request',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Live policy simulator');
    expect(rendered).toContain('Ready for dispatch check');
    expect(rendered).toContain('Simulated booking path');
    expect(rendered).toContain('Eligible Partner preview');
    expect(rendered).toContain('Dispatch supply check');
    expect(hrefsIn(section)).toContain('/partners/provider-1');
  });

  it('renders empty partner guidance when supply is not ready', () => {
    const rendered = normalizedTextContent(
      OperationsPolicyLiveSimulatorSection({
        simulation: {
          checks: [],
          metrics: [],
          partnerRows: [],
          ready: false,
          timeline: [],
        },
      }),
    );

    expect(rendered).toContain('Needs better location data');
    expect(rendered).toContain('No online Partner with a usable location');
  });

  it('does not duplicate the base pill class for simulator tag, partner, and check badges', () => {
    const section = OperationsPolicyLiveSimulatorSection({
      simulation: {
        checks: [
          {
            className: 'ops-task-warning',
            detail: 'Partner location data is stale.',
            operatorAction: 'Refresh Partner app location before launch.',
            pillClass: 'pill pill-warn',
            status: 'Needs review',
            title: 'Location freshness',
          },
        ],
        metrics: [],
        partnerRows: [
          {
            distanceLabel: '3 km',
            id: 'provider-legacy-pill',
            locationAgeLabel: '28m ago',
            name: 'Legacy Pill Partner',
            pillClass: 'pill pill-success',
            status: 'Fresh',
          },
        ],
        ready: true,
        timeline: [
          {
            className: 'timeline-active',
            detail: 'Marketplace list opens immediately.',
            step: '1',
            tags: [{ label: '10 min', tone: 'pill pill-info' }],
            title: 'Customer creates direct request',
          },
        ],
      },
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-info');
    expect(classNames).toContain('pill pill-success');
    expect(classNames).toContain('pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-info');
    expect(classNames).not.toContain('pill pill pill-success');
    expect(classNames).not.toContain('pill pill pill-warn');
  });
});
