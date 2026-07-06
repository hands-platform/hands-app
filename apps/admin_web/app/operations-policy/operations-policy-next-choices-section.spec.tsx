import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { OperationsPolicyNextChoicesSection } from './operations-policy-next-choices-section';
import { classNamesIn } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(new URL('./operations-policy-next-choices-section.tsx', import.meta.url), 'utf8');

describe('OperationsPolicyNextChoicesSection', () => {
  it('renders the recommended owner choices with Partner-facing wording', () => {
    const section = OperationsPolicyNextChoicesSection();
    const rendered = renderToStaticMarkup(section);

    expect(classNamesIn(section)).toContain('card admin-section');
    expect(rendered).toContain('Recommended next choices');
    expect(rendered.match(/class="card admin-card insight-card"/g)).toHaveLength(7);
    expect(sectionSource).toContain('AdminInsightCard');
    expect(sectionSource).not.toContain('<AdminCard className="insight-card"');
    expect(sectionSource).not.toContain('<div className="card admin-card insight-card">');
    expect(rendered).toContain('First-pick Partner acceptance');
    expect(rendered).toContain('Partner response window');
    expect(rendered).toContain('Vietnam sender rules');
    expect(rendered).toContain('Partner alert routing');
  });
});
