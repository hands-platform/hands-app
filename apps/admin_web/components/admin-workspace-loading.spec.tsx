import { renderToStaticMarkup } from 'react-dom/server';

import { AdminWorkspaceLoading } from './admin-workspace-loading';

describe('AdminWorkspaceLoading', () => {
  it('keeps the priority queue and supporting records distinguishable while loading', () => {
    const markup = renderToStaticMarkup(<AdminWorkspaceLoading title="Partner Operations" />);

    expect(markup).toContain('<h1>Partner Operations</h1>');
    expect(markup).toContain('Loading priority queue');
    expect(markup).toContain('Loading records');
    expect(markup).toContain('role="status"');
  });
});
