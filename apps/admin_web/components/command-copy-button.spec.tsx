import { renderToStaticMarkup } from 'react-dom/server';

import { CommandCopyButton } from './command-copy-button';

describe('CommandCopyButton', () => {
  it('renders a compact accessible copy action', () => {
    const markup = renderToStaticMarkup(<CommandCopyButton value="npm.cmd run fcm:push-smoke -- --preflight" />);

    expect(markup).toContain('aria-label="Copy command"');
    expect(markup).toContain('class="command-copy-button"');
    expect(markup).toContain('title="Copy command"');
    expect(markup).toContain('type="button"');
  });

  it('accepts a scoped accessible label for specialized command blocks', () => {
    const markup = renderToStaticMarkup(
      <CommandCopyButton label="Copy preflight command" value="npm.cmd run fcm:push-smoke -- --preflight" />,
    );

    expect(markup).toContain('aria-label="Copy preflight command"');
    expect(markup).toContain('title="Copy preflight command"');
  });
});
