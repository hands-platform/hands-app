import { renderToStaticMarkup } from 'react-dom/server';

import { PathCopyRow } from './path-copy-row';

describe('PathCopyRow', () => {
  it('renders a copyable path row with path-specific labels', () => {
    const markup = renderToStaticMarkup(<PathCopyRow path="docs\architecture\master-progress-roadmap.md" />);

    expect(markup).toContain('docs\\architecture\\master-progress-roadmap.md');
    expect(markup).toContain('class="command-copy-row"');
    expect(markup).toContain('aria-label="Copy path"');
    expect(markup).toContain('title="Copy path"');
  });
});
