import {
  PartnerMasterListSection,
  type PartnerMasterListSectionRow,
} from './partner-master-list-section';

describe('PartnerMasterListSection', () => {
  it('renders partner master rows with operations facts and detail links', () => {
    const section = PartnerMasterListSection({
      rows: buildRows(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner master list');
    expect(rendered).toContain('Compact admin list for ID, profile, contact');
    expect(rendered).toContain('1 visible row(s)');
    expect(rendered).toContain('partner-1');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Linh Legal');
    expect(rendered).toContain('ONLINE_AVAILABLE');
    expect(rendered).toContain('KYC APPROVED');
    expect(rendered).toContain('12 feedback record(s)');
    expect(rendered).toContain('Open');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table service-trace',
        'pill pill-success',
        'button button-secondary admin-inline-action',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-person-avatar-shell', 'admin-avatar-status-dot is-online']),
    );
  });

  it('renders an empty state when no partner rows are visible', () => {
    const section = PartnerMasterListSection({
      rows: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 visible row(s)');
    expect(rendered).toContain('No partner rows found');
    expect(rendered).toContain('Change the filters or clear search to view partner records.');
  });
});

function buildRows(): PartnerMasterListSectionRow[] {
  return [
    {
      accountBlocked: false,
      accountNote: 'Normal account',
      adminClosedCount: 0,
      auditLogCount: 2,
      availablePayout: 320000,
      avatarStatus: 'online',
      bookingCount: 5,
      closedCount: 1,
      completedCount: 4,
      customerClosedCount: 1,
      displayName: 'Linh Wellness',
      gender: 'FEMALE',
      grossRevenue: 450000,
      initials: 'LW',
      joinedAt: '2026-05-01T00:00:00.000Z',
      kycStatus: 'APPROVED',
      lastSeenAt: '2026-06-01T00:00:00.000Z',
      latestSessionAppVersion: 'v0.4.0',
      latestAuditDetail: 'Manual memo saved',
      latestAuditTitle: 'provider.ops_note.add',
      latestSessionDevice: 'android / v0.4.0 / abc123',
      latestSessionIp: '203.0.113.7',
      latestSessionPlatform: 'android',
      legalName: 'Linh Legal',
      level: 'LEVEL_2_ACTIVE',
      locationState: 'recent',
      noShowCount: 0,
      online: true,
      partnerClosedCount: 0,
      pendingPayout: 120000,
      phone: '0865907184',
      platformFee: 12000,
      provider: {
        currentLocationUpdatedAt: '2026-06-01T00:00:00.000Z',
        displayName: 'Linh Wellness',
        id: 'partner-1',
        status: 'ONLINE_AVAILABLE',
      },
      reviewCount: 12,
      status: 'ONLINE_AVAILABLE',
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
