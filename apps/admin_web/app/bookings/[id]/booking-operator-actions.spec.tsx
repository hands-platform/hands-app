import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { ActionLink } from './booking-operator-actions';

describe('booking operator actions', () => {
  it('uses the shared Vuexy text link atom for action links', () => {
    const source = readFileSync('app/bookings/[id]/booking-operator-actions.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders action links with the shared text-link class and original href', () => {
    const markup = renderToStaticMarkup(<ActionLink href="#booking-closeout-readiness" label="Open" />);

    expect(markup).toContain('href="#booking-closeout-readiness"');
    expect(markup).toContain('class="text-link"');
    expect(markup).toContain('Open');
  });
});
