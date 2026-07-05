import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import { CommandCopyButton } from './command-copy-button';

const source = readFileSync('components/command-copy-button.tsx', 'utf8');

describe('CommandCopyButton', () => {
  it('renders a compact accessible copy action', () => {
    const markup = renderToStaticMarkup(<CommandCopyButton value="npm.cmd run fcm:push-smoke -- --preflight" />);

    expect(markup).toContain('aria-label="Copy command"');
    expect(markup).toContain('class="admin-icon-button command-copy-button"');
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

  it('renders through the shared Vuexy icon button atom', () => {
    expect(source).toContain("import { AdminIconButton } from './admin-icon-button';");
    expect(source).toContain('<AdminIconButton');
    expect(source).not.toContain('<button');
  });
});
