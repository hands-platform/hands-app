import { ReviewsTableSection, type ReviewTableRow } from './reviews-table-section';

describe('ReviewsTableSection', () => {
  it('renders review moderation evidence and action links', () => {
    const section = ReviewsTableSection({
      emptyMessage: 'No feedback records loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Feedback record');
    expect(rendered).toContain('review');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Feedback has a follow-up marker');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('Reported');
    expect(rendered).toContain('Needs moderation follow-up');
    expect(rendered).toContain('Needs moderation');
    expect(rendered).toContain('Report: Service arrived late');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/reviews?confirm=moderate&reviewId=review-1&status=PUBLISHED',
        '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN&reportReason=Hidden+by+admin',
      ]),
    );
  });

  it('renders the empty state when there are no review rows', () => {
    const section = ReviewsTableSection({
      emptyMessage: 'No feedback records currently match this queue.',
      rows: [],
    });

    expect(textContent(section)).toContain('No feedback records currently match this queue.');
  });
});

function buildRow(): ReviewTableRow {
  return {
    actionLabel: 'Feedback actions for review',
    actions: [
      {
        description: 'Review before making this feedback visible.',
        href: '/reviews?confirm=moderate&reviewId=review-1&status=PUBLISHED',
        kind: 'link',
        label: 'Publish',
        tone: 'info',
      },
      {
        description: 'Review before removing this feedback from public visibility.',
        href: '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN&reportReason=Hidden+by+admin',
        kind: 'link',
        label: 'Hide',
        tone: 'danger',
      },
    ],
    commentLabel: 'The service arrived late but recovered well.',
    customerLabel: 'Customer One',
    customerPhone: '+84900000000',
    id: 'review-1',
    opsHint: 'Review the text, confirm the report reason, and decide whether to keep it hidden.',
    opsSignal: 'Needs moderation',
    providerHint: 'Feedback has a follow-up marker',
    providerLabel: 'Massage Partner',
    reportReasonLabel: 'Report: Service arrived late',
    shortIdLabel: 'review',
    signalClassName: 'signal signal-warn',
    statusLabel: 'Reported',
    statusMeaning: 'Needs moderation follow-up',
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
