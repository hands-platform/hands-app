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
    expect(source).not.toContain("<span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>");
    expect(source).not.toContain('<span className="pill pill-warn">Withdrawal action</span>');
    expect(source).not.toContain('<span className="pill pill-info">Withdrawal pending</span>');
    expect(source).not.toContain('<span className="pill pill-success">Approval clear</span>');
    expect(source).not.toContain('className={`pill ${');
    expect(source).not.toContain(
      "<span className={`pill ${row.accountBlocked ? 'pill-danger' : 'pill-success'}`}>",
    );
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
    const css = readFileSync('app/globals.css', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('ariaLabel={`${copy.title} records`}');
    expect(source).not.toContain('AdminFilterPanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card',
    );
    expect(css).toContain('.vuexy-partner-table {\n  min-width: 0;');
    expect(css).toContain('.vuexy-partner-table.is-approval-pending {\n  min-width: 0;');
    expect(css).not.toContain('.vuexy-partner-table {\n  min-width: 1440px;');
    expect(css).toContain('.vuexy-partner-table td:last-child a {\n  overflow-wrap: normal;\n  word-break: keep-all;');
    expect(css).toContain(
      '.vuexy-partner-stack > .pill {\n  overflow-wrap: normal;\n  white-space: normal;',
    );
    expect(css).toContain('.vuexy-partner-filter-group.is-primary .admin-directory-filter-select');
    expect(css).toContain('min-width: 148px');
    expect(css).toContain(
      '@media (max-width: 800px) {\n  .vuexy-partner-table-card .admin-table-scroll {\n    overflow-x: visible;',
    );
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('content: attr(data-label);');
    expect(source).toContain('<td data-label="Availability">');
    expect(source).toContain('<td data-label="Action">');
  });

  it('renders partner master rows with operations facts and detail links', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters(),
      pagination: pagination(buildRows(), { page: 1, totalRows: 12 }),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner directory');
    expect(rendered).toContain(
      'Search by partner name, phone, or ID, then open a profile to review status and restrictions.',
    );
    expect(rendered).toContain('12 matching Partners');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Partner ID artner-1');
    expect(rendered).toContain('Phone saved');
    expect(rendered).not.toContain('0865907184');
    expect(rendered).not.toContain('Female · Linh Legal');
    expect(rendered).toContain('Availability');
    expect(rendered).toContain('Onboarding');
    expect(rendered).toContain('Activity');
    expect(rendered).toContain('App active 7D');
    expect(rendered).toContain('4 completed / 1 closed');
    expect(rendered).toContain('Wallet');
    expect(rendered).toContain('Account / action');
    expect(rendered).not.toContain('Gender State');
    expect(rendered).toContain('Withdrawal action');
    expect(rendered).toContain('650.000 VND');
    expect(rendered).not.toContain('Current state');
    expect(rendered).not.toContain('Joined / recent access');
    expect(rendered).not.toContain('Device / IP');
    expect(rendered).not.toContain('Feedback records');
    expect(rendered).not.toContain('Ops trail');
    expect(rendered).toContain('Ready now');
    expect(rendered).toContain('KYC Approved');
    expect(rendered).toContain('1 Jun 2026, 07:00');
    expect(rendered).not.toContain('Joined 1 May 2026, 07:00');
    expect(rendered).toContain('verification review');
    expect(rendered).toContain('bank MISSING');
    expect(rendered.match(/verification review/g)).toHaveLength(1);
    expect(rendered.match(/bank MISSING/g)).toHaveLength(1);
    expect(rendered).toContain('12 reviews');
    expect(rendered).toContain('Account clear');
    expect(rendered).toContain('Open profile');
    expect(rendered).toContain('Showing 1 to 10 of 12 entries');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partners/partner-1',
        '/partners',
        '/partners?page=2',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-table is-default',
        'vuexy-booking-table-footer vuexy-partner-table-footer',
        'admin-rounded-pagination vuexy-booking-pagination',
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

    expect(rendered).toContain('0 matching Partners');
    expect(rendered).toContain('This queue is clear');
    expect(rendered).toContain('No Partners are currently available in this queue.');
    expect(rendered).toContain('Refresh current queue');
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

    expect(rendered).toContain('Onboarding blockers');
    expect(rendered).toContain(
      'Partners blocked from onboarding by verification, KYC, required evidence, or an account hold.',
    );
    expect(rendered).toContain('1 onboarding blocker');
    expect(rendered).toContain('Stage');
    expect(rendered).toContain('Next action');
    expect(rendered).toContain('Partner activity');
    expect(rendered).toContain('Account');
    expect(rendered).toContain('Operator');
    expect(rendered).toContain('Review required: verification review');
    expect(rendered).toContain('+1 more');
    expect(rendered).toContain('Review blockers');
    expect(rendered).not.toContain('Wallet');
  });

  it('renders an approval decision queue with submission age and correction context', () => {
    const row = buildRows()[0]!;
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'approval-pending', sort: 'oldest' }),
      mode: 'approval-pending',
      pagination: pagination([{ ...row, kycStatus: 'PENDING', verificationStatus: 'SUBMITTED' }]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner approvals');
    expect(rendered).toContain('1 awaiting decision');
    expect(rendered).toContain('Submitted / Age');
    expect(rendered).toContain('Review state');
    expect(rendered).toContain('Top issues');
    expect(rendered).toContain('Correction context');
    expect(rendered).toContain('Verification Submitted for review');
    expect(rendered).toContain('KYC Review pending');
    expect(rendered).toContain('identity docs 2/3 missing');
    expect(rendered).toContain('document pending');
    expect(rendered).toContain('+1 more');
    expect(rendered).toContain('Previous CCCD image was unreadable');
    expect(rendered).toContain('Review submission');
    expect(hrefsIn(section)).toContain('/partners/partner-1?decisionQueue=approval-pending');
    expect(classNamesIn(section)).toContain(
      'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-table is-approval-pending',
    );
    expect(rendered).not.toContain('location missing');
    expect(rendered).not.toContain('Wallet');
  });

  it('replaces an empty approval table with recovery destinations', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'approval-pending', sort: 'oldest' }),
      mode: 'approval-pending',
      pagination: pagination([]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Approval queue is clear');
    expect(rendered).toContain('No Partner submission is waiting for an approval decision.');
    expect(rendered).toContain('View onboarding blockers');
    expect(rendered).toContain('Open partner directory');
    expect(rendered).not.toContain('Refresh approval queue');
    expect(rendered).not.toContain('No partner rows found');
    expect(rendered).not.toContain('Submitted / Age');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners?review=unapproved', '/partners']));
  });

  it('offers filter recovery when no approval matches the active criteria', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({
        approvalMissing: 'public-media',
        review: 'approval-pending',
        sort: 'oldest',
      }),
      mode: 'approval-pending',
      pagination: pagination([]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No approvals match these filters');
    expect(rendered).toContain('Clear approval filters');
    expect(hrefsIn(section)).toContain('/partners?review=approval-pending&sort=oldest');
  });

  it('keeps onboarding recovery actions inside the current queue', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ q: 'missing-partner', review: 'unapproved' }),
      mode: 'unapproved',
      pagination: pagination([]),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No results match these filters');
    expect(rendered).toContain('Reset filters');
    expect(rendered).not.toContain('Change filters');
    expect(hrefsIn(section)).toContain('/partners?review=unapproved');
  });

  it('renders settlement-focused copy for unsettled partners', () => {
    const section = PartnerMasterListSection({
      filters: buildFilters({ review: 'unsettled' }),
      mode: 'unsettled',
      pagination: pagination(buildRows()),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Wallet debt');
    expect(rendered).toContain(
      'Partners with a negative canonical VND wallet balance. Open Partner detail to review ledger origin before clearing restrictions.',
    );
    expect(rendered).toContain('1 wallet debt record');
    expect(rendered).toContain('Canonical VND wallet balance');
    expect(rendered).toContain('Acceptance / service blocked');
    expect(rendered).toContain('Withdrawal');
    expect(rendered).not.toContain('Work origin');
    expect(rendered).toContain('Review wallet debt');
    expect(rendered).not.toContain('Settlement required');
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
      appActivityStatus: 'active',
      appLastActiveAt: '2026-06-01T00:30:00.000Z',
      adminClosedCount: 0,
      approvalIssues: [
        { label: 'verification review', severity: 'high' },
        { label: 'bank MISSING', severity: 'medium' },
      ],
      approvalQueueIssues: [
        { label: 'identity docs 2/3 missing', severity: 'high' },
        { label: 'document pending', severity: 'medium' },
        { label: 'media pending', severity: 'medium' },
      ],
      approvalSubmittedAt: '2026-06-01T00:00:00.000Z',
      approvalHoldReason: 'Previous CCCD image was unreadable',
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
      verificationStatus: 'APPROVED',
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
