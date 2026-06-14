import { OperationsPolicyNextChoicesSection } from './operations-policy-next-choices-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyNextChoicesSection', () => {
  it('renders the recommended owner choices with Partner-facing wording', () => {
    const section = OperationsPolicyNextChoicesSection();
    const rendered = normalizedTextContent(section);
    const children = Array.isArray(section.props.children) ? section.props.children : [];
    const radar = children[1];
    const cards = Array.isArray(radar.props.children) ? radar.props.children : [];

    expect(section.type).toBe('section');
    expect(rendered).toContain('Recommended next choices');
    expect(cards).toHaveLength(7);
    expect(cards[0].props.title).toBe('First-pick Partner acceptance');
    expect(cards[1].props.recommendation).toContain('Partner response window');
    expect(cards[3].props.detail).toContain('Vietnam sender rules');
    expect(cards[6].props.title).toBe('Partner alert routing');
  });
});
