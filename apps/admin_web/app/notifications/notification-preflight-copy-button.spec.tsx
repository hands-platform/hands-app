import { renderToStaticMarkup } from 'react-dom/server';

import { NotificationPreflightCopyButton } from './notification-preflight-copy-button';

describe('NotificationPreflightCopyButton', () => {
  it('renders a compact accessible copy action', () => {
    const markup = renderToStaticMarkup(
      <NotificationPreflightCopyButton command="npm.cmd run fcm:push-smoke -- --preflight" />,
    );

    expect(markup).toContain('aria-label="Copy preflight command"');
    expect(markup).toContain('class="command-copy-button"');
    expect(markup).toContain('title="Copy preflight command"');
    expect(markup).toContain('type="button"');
  });
});
