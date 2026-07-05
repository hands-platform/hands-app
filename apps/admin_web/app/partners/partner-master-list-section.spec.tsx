import { readFileSync } from 'node:fs';
import { PartnerMasterListSection, type PartnerMasterListSectionRow } from './partner-master-list-section';
import { buildProviderFilters, type PartnerPagination, type ProviderFilters } from './partner-filters';

describe('PartnerMasterListSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/partner-master-list-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No partner rows found</strong>');
  });

  it('uses shared Vuexy badge atoms instead of raw partner master list pill spans', () => {
    const source = readFileSync('app/partners/partner-master-list-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${row.online ? \'pill-success\' : \'pill-neutral\'}`}>');
    expect(source).not.toContain('<span className="pill pill-warn">Withdrawal action</span>');
    expect(source).not.toContain('<span className="pill pill-info">Withdrawal pending</span>');
    expect(source).not.toContain('<span className="pill pill-success">Approval clear</span>');
    expect(source).not.toContain('className={`pill ${');
    expect(source).not.toContain('<span className={`pill ${row.accountBlocked ? \'pill-danger\' : \'pill-success\'}`}>');
    expect(source).not.toContain("{row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}");
    expect(source).not.toContain("Joined {row.joinedAt ? formatDate(row.joinedAt) : 'not recorded'}");
  });

  it('uses the shared table pagination footer for partner master pagination', () => {
    const source = readFileSync('app/partners/partner-master-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('className="vuexy-partner-table-footer"');
    expect(source).not.toContain('<AdminTableFooter');
    expect(source).not.toContain('<span>{partnerMasterListFooterLabel(pagination)}</span>');
  });

  it('uses the shared Vuexy table panel atom instead of repeating table card classes', () => {
    const source = readFileSync('app/partners/partner-master-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card',
    );
  });

  it('renders partner master rows with operations facts and detail links', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'unapproved' }),
      pagination: pagination(buildRows(), { page: 1, totalRows: 12 }),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partners');
    expect(rendered).toContain('Compact admin list for ID, profile, contact');
    expect(rendered).toContain('12 visible row(s)');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('0865907184 Linh Legal');
    expect(rendered).not.toContain('Partner ID');
    expect(rendered).not.toContain('Phone');
    expect(rendered).not.toContain('partner-1');
    expect(rendered).toContain('State');
    expect(rendered).toContain('Access');
    expect(rendered).toContain('Work');
    expect(rendered).toContain('Wallet');
    expect(rendered).toContain('Withdrawal action');
    expect(rendered).toContain('650.000 VND');
    expect(rendered).not.toContain('Current state');
    expect(rendered).not.toContain('Joined / recent access');
    expect(rendered).not.toContain('Device / IP');
    expect(rendered).not.toContain('Feedback records');
    expect(rendered).not.toContain('Ops trail');
    expect(rendered).toContain('ONLINE_AVAILABLE');
    expect(rendered).toContain('KYC APPROVED');
    expect(rendered).toContain('1 Jun 2026, 07:00');
    expect(rendered).toContain('Joined 1 May 2026, 07:00');
    expect(rendered).toContain('2 approval need(s)');
    expect(rendered).not.toContain('verification review');
    expect(rendered).not.toContain('bank MISSING');
    expect(rendered).toContain('12 review(s)');
    expect(rendered).toContain('Account clear');
    expect(rendered).toContain('Showing 1 to 10 of 12 entries');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partners/partner-1',
        '/partners?review=unapproved',
        '/partners?review=unapproved&page=2',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-table',
        'vuexy-booking-table-footer vuexy-partner-table-footer',
        'vuexy-booking-pagination',
        'pill pill-success',
        'vuexy-booking-person-link',
        'vuexy-booking-person vuexy-partner-person',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-person-avatar-shell', 'admin-avatar-status-dot is-online']),
    );
  });

  it('renders an empty state when no partner rows are visible', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters(),
      pagination: pagination([]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 visible row(s)');
    expect(rendered).toContain('No partner rows found');
    expect(rendered).toContain('Change the filters or clear search to view partner records.');
  });

  it('renders blocked account state with explicit operations copy', () => {
    const row = buildRows()[0]!;
    const section = PartnerMasterListSection({
      filters: buildFilters(),
      pagination: pagination([
        {
          ...row,
          accountBlocked: true,
          accountNote: 'Manual hold for safety review',
        },
      ]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Account blocked');
    expect(rendered).toContain('Manual hold for safety review');
    expect(rendered).not.toContain('Account clear');
  });

  it('renders approval-focused copy for unapproved partners', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'unapproved' }),
      mode: 'unapproved',
      pagination: pagination(buildRows()),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Unapproved Partners');
    expect(rendered).toContain('Approval-first list for Partners who cannot operate yet');
    expect(rendered).toContain('registration, KYC, required documents, public media, device, or account-hold facts');
    expect(rendered).not.toContain('public media, bank, tax');
    expect(rendered).toContain('1 approval row(s)');
    expect(rendered).toContain('Approval needs');
    expect(rendered).toContain('KYC / Level');
    expect(rendered).not.toContain('Work');
    expect(rendered).not.toContain('Wallet');
  });

  it('renders settlement-focused copy for unsettled partners', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'unsettled' }),
      mode: 'unsettled',
      pagination: pagination(buildRows()),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Unsettled Partners');
    expect(rendered).toContain('Settlement-first list for Partners with negative wallet balance');
    expect(rendered).toContain('1 settlement row(s)');
    expect(rendered).toContain('Wallet');
    expect(rendered).toContain('Revenue');
    expect(rendered).toContain('Payout');
    expect(rendered).toContain('Settlement required');
    expect(rendered).not.toContain('Gender');
  });
});

function buildFilters(input: Partial<ProviderFilters> = {}): ProviderFilters {
  return {
    ...buildProviderFilters({}),
    ...input,
  };
}

function pagination(
  rows: readonly PartnerMasterListSectionRow[],
  input: { readonly page?: number; readonly totalRows?: number } = {},
): PartnerPagination<PartnerMasterListSectionRow> {
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: totalRows === 0 ? 0 : 1,
    page: input.page ?? 1,
    pageSize: 10,
    rows,
    to: Math.min(10, totalRows),
    totalPages: Math.max(1, Math.ceil(totalRows / 10)),
    totalRows,
  };
}

function buildRows(): PartnerMasterListSectionRow[] {
  return [
    {
      accountBlocked: false,
      accountNote: 'Normal account',
      adminClosedCount: 0,
      approvalIssues: [
        { label: 'verification review', severity: 'high' },
        { label: 'bank MISSING', severity: 'medium' },
      ],
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
      walletBalance: -120000,
      walletWithdrawalAdminActionCount: 1,
      walletWithdrawalLatestAmount: 650000,
      walletWithdrawalLatestStatus: 'REQUESTED',
      walletWithdrawalOpenCount: 1,
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
