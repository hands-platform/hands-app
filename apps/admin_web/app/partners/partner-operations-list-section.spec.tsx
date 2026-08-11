import { readFileSync } from 'node:fs';
import {
  PartnerOperationsListSection,
  type PartnerOperationsListSectionRow,
} from './partner-operations-list-section';

describe('PartnerOperationsListSection', () => {
  it('uses the shared Vuexy empty-state atom', () => {
    const source = readFileSync('app/partners/partner-operations-list-section.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<strong>No partners found</strong>');
  });

  it('uses shared Vuexy badge atoms instead of raw operations list pill spans', () => {
    const source = readFileSync('app/partners/partner-operations-list-section.tsx', 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className={`signal ${partnerOperationSignalClass(row.acceptanceTone)}`}>');
    expect(source).not.toContain('<span className={`signal ${partnerOperationSignalClass(row.marketplaceAccessTone)}`}>');
    expect(source).not.toContain('<span className="pill pill-success">{directReadyCount} can receive direct requests</span>');
    expect(source).not.toContain('<span className="pill pill-warn">{settlementWarningCount} settlement warning</span>');
    expect(source).not.toContain('<span className="pill pill-info">{row.provider.level ?? \'LEVEL_1_SIGNUP\'}</span>');
    expect(source).not.toContain('<span className={`pill ${row.provider.blockedAt ? \'pill-danger\' : \'pill-success\'}`}>');
    expect(source).not.toContain('<span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>');
    expect(source).not.toContain("row.lastWorkAt ? formatDate(row.lastWorkAt) : 'none'");
    expect(source).not.toContain("row.lastActivityAt ? formatDate(row.lastActivityAt) : 'not recorded'");
  });

  it('uses the shared Vuexy table panel wrapper instead of hand-composed table card classes', () => {
    const source = readFileSync('app/partners/partner-operations-list-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-mb-16',
    );
  });

  it('renders operations rows with approval, booking access, wallet, and app check facts', () => {
    const section = PartnerOperationsListSection({
      directReadyCount: 1,
      hiddenPartnerCount: 2,
      rows: buildRows(),
      settlementWarningCount: 1,
      totalPartnerCount: 3,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner operations list');
    expect(rendered).toContain('Approval');
    expect(rendered).toContain('Booking access');
    expect(rendered).toContain('App / next check');
    expect(rendered).not.toContain('Basic checklist');
    expect(rendered).not.toContain('Direct request gate');
    expect(rendered).not.toContain('Matching flow');
    expect(rendered).not.toContain('Marketplace access');
    expect(rendered).not.toContain('Money');
    expect(rendered).not.toContain('App/location');
    expect(rendered).not.toContain('Next operator check');
    expect(rendered).toContain('3 Partners');
    expect(rendered).toContain('1 can receive direct requests');
    expect(rendered).toContain('1 settlement warning');
    expect(rendered).not.toContain('wallet marketplace hold');
    expect(rendered).toContain('Linh Wellness');
    expect(rendered).toContain('Direct request clear');
    expect(rendered).toContain('Marketplace ready');
    expect(rendered).toContain('Preferred');
    expect(rendered).toContain('active');
    expect(rendered).toContain('4 completed');
    expect(rendered).toContain('Last work: 30 May 2026, 07:00');
    expect(rendered).toContain('Last app activity: 1 Jun 2026, 07:00');
    expect(rendered).toContain('First revenue: yes');
    expect(rendered).toContain('2 more Partner rows are hidden for page speed.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-table-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-table service-trace',
        'vuexy-booking-table-footer vuexy-partner-table-footer',
        'admin-avatar-status-dot is-online',
        'pill pill-success',
        'table-link',
        'vuexy-booking-person',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders negative wallet rows as settlement warnings', () => {
    const section = PartnerOperationsListSection({
      directReadyCount: 0,
      hiddenPartnerCount: 0,
      rows: [
        {
          ...buildRows()[0],
          marketplaceAccessDetail:
            'Marketplace visibility stays open; final acceptance, service start, and payout release wait for settlement.',
          marketplaceAccessLabel: 'Settlement warning',
          marketplaceAccessTone: 'warn',
          walletBalance: -120000,
        },
      ],
      settlementWarningCount: 1,
      totalPartnerCount: 1,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Settlement warning');
    expect(rendered).toContain('final acceptance, service start, and payout release');
    expect(rendered).not.toContain('marketplace alerts and participation');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn', 'signal signal-warn']));
  });

  it('renders an empty state when no partner operation rows are visible', () => {
    const section = PartnerOperationsListSection({
      directReadyCount: 0,
      hiddenPartnerCount: 0,
      rows: [],
      settlementWarningCount: 0,
      totalPartnerCount: 0,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('0 Partners');
    expect(rendered).toContain('Showing 0 entries');
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
      avatarStatus: 'online',
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
