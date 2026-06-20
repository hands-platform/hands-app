import { PartnerDetailBookingGateDecisionSection } from './partner-detail-booking-gate-decision-section';

describe('PartnerDetailBookingGateDecisionSection', () => {
  it('renders marketplace booking gate decisions as a Vuexy table', () => {
    const section = PartnerDetailBookingGateDecisionSection({
      cardClassForTone: (tone) => `card-${tone}`,
      pillClassForTone: (tone) => `pill-${tone}`,
      decision: {
        backupRadiusLabel: '5 km',
        bookableServices: '3 service(s)',
        canDirectFirstPick: false,
        canJoinMarketplace: false,
        cashDebtLabel: '-40,000 VND',
        directFirstPickReason: 'Wallet debt must be settled first.',
        gates: [
          {
            action: 'Settle cash debt',
            detail: 'Negative wallet blocks marketplace alerts and participation.',
            label: 'Cash settlement',
            ok: false,
          },
          {
            action: 'No action',
            detail: 'Location is fresh enough for marketplace matching.',
            label: 'Location freshness',
            ok: true,
          },
        ],
        locationAge: '4m ago',
        locationFreshnessLabel: '10m',
        primaryReason: 'Cash debt blocks marketplace matching.',
        responseWindowLabel: '90 seconds',
        status: 'Join held',
        tone: 'blocked',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Marketplace booking gate decision');
    expect(rendered).toContain('Join held');
    expect(rendered).toContain('Direct first-pick');
    expect(rendered).toContain('Needs repair');
    expect(rendered).toContain('First response window: 90 seconds');
    expect(rendered).toContain('Marketplace radius: 5 km');
    expect(rendered).toContain('Gate');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Detail');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Cash settlement');
    expect(rendered).toContain('BLOCK');
    expect(rendered).toContain('Negative wallet blocks marketplace alerts and participation.');
    expect(rendered).toContain('Location freshness');
    expect(rendered).toContain('OK');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/operations-policy']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
        'pill pill-success',
      ]),
    );
  });

  it('renders an empty state when there are no gate rows', () => {
    const section = PartnerDetailBookingGateDecisionSection({
      cardClassForTone: (tone) => `card-${tone}`,
      pillClassForTone: (tone) => `pill-${tone}`,
      decision: {
        backupRadiusLabel: '5 km',
        bookableServices: '0 service(s)',
        canDirectFirstPick: true,
        canJoinMarketplace: true,
        cashDebtLabel: '0 VND',
        directFirstPickReason: 'No wallet blocker.',
        gates: [],
        locationAge: 'fresh',
        locationFreshnessLabel: '10m',
        primaryReason: 'No marketplace blocker.',
        responseWindowLabel: '90 seconds',
        status: 'Join clear',
        tone: 'done',
      },
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No marketplace booking gate rows.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['admin-table-scroll', 'table vuexy-data-table']));
  });
});

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

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
