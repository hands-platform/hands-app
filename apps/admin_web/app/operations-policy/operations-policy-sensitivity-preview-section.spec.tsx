import { OperationsPolicySensitivityPreviewSection } from './operations-policy-sensitivity-preview-section';
import { classNamesIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicySensitivityPreviewSection', () => {
  it('renders radius and freshness sensitivity tables', () => {
    const section = OperationsPolicySensitivityPreviewSection({
      sensitivity: {
        currentPolicyLabel: '10 km / 30m fresh',
        freshnessRows: [
          {
            eligible: 4,
            freshnessLabel: '30 min',
            operatorRead: 'Current live freshness.',
            pillClass: 'pill-info',
            staleExcluded: 1,
          },
        ],
        radiusRows: [
          {
            eligible: 3,
            finalGateHeld: 1,
            fresh: 5,
            operatorRead: 'Current live radius.',
            pillClass: 'pill-info',
            radiusLabel: '10 km',
          },
        ],
        referenceLabel: 'Booking cmqbcwop...oqle',
        summary: [
          {
            helper: 'Online and fresh enough.',
            label: 'Current visible supply',
            value: '3',
          },
        ],
      },
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Policy sensitivity preview');
    expect(rendered).toContain('10 km / 30m fresh');
    expect(rendered).toContain('Marketplace supply sensitivity');
    expect(rendered).toContain('Visible Partners');
    expect(rendered).toContain('Location freshness sensitivity');
    expect(rendered).toContain('Eligible Partners');
  });

  it('does not duplicate the base pill class for radius and freshness badges', () => {
    const section = OperationsPolicySensitivityPreviewSection({
      sensitivity: {
        currentPolicyLabel: '10 km / 30m fresh',
        freshnessRows: [
          {
            eligible: 4,
            freshnessLabel: '30 min',
            operatorRead: 'Current live freshness.',
            pillClass: 'pill pill-warn',
            staleExcluded: 1,
          },
        ],
        radiusRows: [
          {
            eligible: 3,
            finalGateHeld: 1,
            fresh: 5,
            operatorRead: 'Current live radius.',
            pillClass: 'pill pill-info',
            radiusLabel: '10 km',
          },
        ],
        referenceLabel: 'Booking cmqbcwop...oqle',
        summary: [],
      },
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-info');
    expect(classNames).toContain('pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-info');
    expect(classNames).not.toContain('pill pill pill-warn');
  });
});
