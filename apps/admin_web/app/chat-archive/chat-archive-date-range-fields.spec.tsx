import { renderToStaticMarkup } from 'react-dom/server';

import { ChatArchiveDateRangeFields } from './chat-archive-date-range-fields';

describe('ChatArchiveDateRangeFields', () => {
  it('renders valid custom inputs and the 90-day limit before submit', () => {
    const html = renderToStaticMarkup(
      <ChatArchiveDateRangeFields
        initialFrom="2026-08-01"
        initialRange="custom"
        initialTo="2026-08-07"
        validationError={null}
      />,
    );

    expect(html).toContain('name="from"');
    expect(html).toContain('name="to"');
    expect(html).toContain('Custom range: maximum 90 days.');
  });

  it('does not submit stale custom dates for a preset range', () => {
    const html = renderToStaticMarkup(
      <ChatArchiveDateRangeFields
        initialFrom="2026-08-01"
        initialRange="7d"
        initialTo="2026-08-07"
        validationError={null}
      />,
    );

    expect(html).not.toContain('name="from"');
    expect(html).not.toContain('name="to"');
  });
});
