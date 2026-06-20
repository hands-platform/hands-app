import { PartnerDetailReportsControlsSection } from './partner-detail-reports-controls-section';

describe('PartnerDetailReportsControlsSection', () => {
  it('renders reports and account controls as Vuexy tables', () => {
    const section = PartnerDetailReportsControlsSection({
      accountControls: [
        {
          id: 'control-1',
          liftControlHref: '/partners/partner-1?controlAction=lift',
          reason: 'Payout review pending because a customer complaint is open.',
          reportLine: 'Report: payout / HIGH',
          smallLabel: 'ctrl-1',
          status: 'ACTIVE',
          timeline: 'Started 20 Jun 2026, 10:00 / expires Missing',
          type: 'PAYOUT_HOLD',
        },
      ],
      payoutHold: {
        idLabel: 'hold-1',
        reason: 'Payout review pending because a customer complaint is open.',
        timeline: 'Started 20 Jun 2026, 10:00 / expires Missing',
        type: 'PAYOUT_HOLD',
      },
      providerId: 'partner-1',
      reports: [
        {
          bookingHref: '/bookings/booking-1',
          bookingLabel: 'booking-1',
          category: 'payout',
          createdLabel: '20 Jun 2026, 10:00',
          defaultControlType: 'ACCOUNT_BLOCK',
          details: 'Customer uploaded supporting evidence.',
          id: 'report-1',
          resolutionNote: null,
          severity: 'HIGH',
          smallLabel: 'rep-1',
          source: 'CUSTOMER',
          status: 'INVESTIGATING',
          summary: 'Partner payout complaint',
        },
      ],
      reportsDeskHref: '/partner-controls?q=partner-1',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Reports and account controls');
    expect(rendered).toContain('State');
    expect(rendered).toContain('Control');
    expect(rendered).toContain('Timeline');
    expect(rendered).toContain('ID');
    expect(rendered).toContain('ACTIVE');
    expect(rendered).toContain('Partner payout complaint');
    expect(rendered).toContain('HIGH');
    expect(rendered).toContain('INVESTIGATING');
    expect(rendered).toContain('PAYOUT_HOLD');
    expect(rendered).toContain('Payout review pending because a customer complaint is open.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partner-controls?q=partner-1',
        '/bookings/booking-1',
        '/partners/partner-1?controlAction=lift',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
        'admin-action-dropdown action-menu-dropdown',
      ]),
    );
  });

  it('renders an empty payout hold table when no hold is active', () => {
    const section = PartnerDetailReportsControlsSection({
      accountControls: [],
      payoutHold: null,
      providerId: 'partner-1',
      reports: [],
      reportsDeskHref: '/partner-controls?q=partner-1',
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No payout hold');
    expect(rendered).toContain('No active payout hold is currently applied.');
    expect(rendered).toContain('No Partner reports recorded yet.');
    expect(rendered).toContain('No active or historical account control recorded yet.');
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
