import { renderToStaticMarkup } from 'react-dom/server';

import { OperationsPolicyNextChoicesSection } from './operations-policy-next-choices-section';
import { classNamesIn } from './operations-policy-section-test-utils';

describe('OperationsPolicyNextChoicesSection', () => {
  it('renders the recommended owner choices with Partner-facing wording', () => {
    const section = OperationsPolicyNextChoicesSection();
    const rendered = renderToStaticMarkup(section);

    expect(classNamesIn(section)).toContain('card admin-section');
    expect(rendered).toContain('Recommended next choices');
    expect(rendered.match(/class="card admin-card insight-card"/g)).toHaveLength(7);
    expect(rendered).toContain('First-pick Partner acceptance');
    expect(rendered).toContain('Partner response window');
    expect(rendered).toContain('Vietnam sender rules');
    expect(rendered).toContain('Partner alert routing');
  });
});
