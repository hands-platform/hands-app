import { OperationsHandoffMetricGridSection } from './operations-handoff-metric-grid-section';

describe('OperationsHandoffMetricGridSection', () => {
  it('renders operations handoff metric links and visible counts', () => {
    const section = OperationsHandoffMetricGridSection({
      activeBookingCount: 4,
      matchingBookingCount: 2,
      inServiceBookingCount: 1,
      cashSummary: {
        generatedAt: new Date(0).toISOString(),
        currency: 'VND',
        rowCount: 1,
        providerCount: 3,
        totalDebtAmount: 125000,
        totalPlatformFee: 0,
        totalTaxAmount: 0,
        oldestOpenAt: null,
        oldestOpenAgeMinutes: 0,
        staleDebtRowCount: 0,
        highDebtProviderCount: 0,
        missingPaymentEvidenceCount: 0,
        cashPaymentRowCount: 0,
        topProviderGroups: [],
      },
      presence: {
        customerLive: 5,
        customerRecent: 8,
        partnerLive: 6,
        partnerRecent: 9,
      },
      chatSignals: {
        roomCount: 7,
        recentMessageCount: 10,
      },
      failedNotificationCount: 11,
    });

    const rendered = textContent(section);
    const hrefs = hrefsIn(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Cash fee debt');
    expect(rendered).toContain('125.000 VND across partner wallet gates');
    expect(rendered).toContain('11');
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/bookings?view=attention',
        '/bookings?view=matching',
        '/bookings?view=closeout',
        '/cash-settlements',
        '/notifications?review=failed',
      ]),
    );
  });
});

function textContent(value: unknown): string {
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
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return textContent(expanded);
  }
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const expanded = renderKnownComponent(record);
  if (expanded !== null) {
    return hrefsIn(expanded);
  }
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

type RenderableComponent = (props: Record<string, unknown>) => unknown;

function renderKnownComponent(record: Record<string, unknown> | null) {
  const component = record?.type;
  if (typeof component === 'function' && component.name === 'MetricCard') {
    return (component as RenderableComponent)(readRecord(record?.props) ?? {});
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
