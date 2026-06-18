import {
  PartnerOperationsListSection,
  type PartnerOperationsListSectionRow,
} from './partner-operations-list-section';

describe('PartnerOperationsListSection', () => {
  it('renders operations rows with gate, marketplace, money, and detail facts', () => {
    const section = PartnerOperationsListSection({
      directReadyCount: 1,
      hiddenPartnerCount: 2,
      rows: buildRows(),
      totalPartnerCount: 3,
      walletHoldCount: 1,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner operations list');
    expect(rendered).toContain('3 partner(s)');
    expect(rendered).toContain('1 can receive direct requests');
    expect(rendered).toContain('1 wallet marketplace hold');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Direct request clear');
    expect(rendered).toContain('Marketplace ready');
    expect(rendered).toContain('Preferred');
    expect(rendered).toContain('active');
    expect(rendered).toContain('4 completed');
    expect(rendered).toContain('First revenue: yes');
    expect(rendered).toContain('Open all records');
    expect(rendered).toContain('2 more partner row(s) are hidden for page speed.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table service-trace',
        'pill pill-success',
        'button button-secondary admin-inline-action',
      ]),
    );
  });

  it('renders an empty state when no partner operation rows are visible', () => {
    const section = PartnerOperationsListSection({
      directReadyCount: 0,
      hiddenPartnerCount: 0,
      rows: [],
      totalPartnerCount: 0,
      walletHoldCount: 0,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 partner(s)');
    expect(rendered).toContain('No partners found');
    expect(rendered).toContain('Change the filters or clear search to view partner records.');
  });
});

function buildRows(): PartnerOperationsListSectionRow[] {
  return [
    {
      acceptanceDetail: 'Ready to receive preferred direct booking requests.',
      acceptanceLabel: 'Direct request clear',
      acceptanceTone: 'ok',
      checklist: [
        {
          label: 'KYC',
          status: 'ok',
          tone: 'ok',
        },
      ],
      completedWorkCount: 4,
      lastActivityAt: '2026-06-01T00:00:00.000Z',
      lastWorkAt: '2026-05-30T00:00:00.000Z',
      locationState: 'recent',
      marketplaceAccessDetail: 'Can participate in marketplace bookings.',
      marketplaceAccessLabel: 'Marketplace ready',
      marketplaceAccessTone: 'ok',
      marketplaceCanParticipate: true,
      marketplaceCanReceiveAlerts: true,
      marketplaceCanView: true,
      marketplacePartnerAppMessage: null,
      matchingFlow: [
        {
          label: 'Preferred',
          status: 'active',
          tone: 'ok',
        },
      ],
      matchingFlowDetail: 'Preferred Partner can accept first while marketplace remains visible.',
      name: 'Linh Wellness',
      nextAction: {
        detail: 'No immediate blocker.',
        operatorAction: 'Monitor daily queue.',
        priority: 1,
        status: 'Clear',
        tone: 'done',
      },
      phone: '0865907184',
      provider: {
        blockedAt: null,
        currentLocationUpdatedAt: '2026-06-01T00:00:00.000Z',
        displayName: 'Linh Wellness',
        earnings: [
          {
            bookingId: 'booking-1',
            currency: 'VND',
            grossAmount: 450000,
            id: 'earning-1',
            netAmount: 380000,
            platformFee: 45000,
            providerProfileId: 'partner-1',
            status: 'AVAILABLE',
            withholdingAmount: 25000,
          },
        ],
        id: 'partner-1',
        level: 'LEVEL_2_ACTIVE',
        status: 'ONLINE_AVAILABLE',
        taxProfile: {
          id: 'tax-1',
          legalName: 'Linh Legal',
          registeredAddress: 'District 1',
          status: 'APPROVED',
        },
      },
      walletBalance: 120000,
    },
  ];
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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
