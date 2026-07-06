import { PartnerDetailDeviceSessionActivitySection } from './partner-detail-device-session-activity-section';
import { readFileSync } from 'node:fs';

const sectionSource = readFileSync(
  new URL('./partner-detail-device-session-activity-section.tsx', import.meta.url),
  'utf8',
);

describe('PartnerDetailDeviceSessionActivitySection', () => {
  it('uses the partner detail Vuexy table panel atom for the device session shell', () => {
    expect(sectionSource).toContain('PartnerDetailVuexyTablePanel');
    expect(sectionSource).not.toContain('AdminFilterPanel');
    expect(sectionSource).not.toContain('partnerDetailReviewCardClassName');
  });

  it('uses shared Vuexy badge atoms for device and session status pills', () => {
    expect(sectionSource).toContain('AdminDetailGrid');
    expect(sectionSource).toContain('AdminTaskGrid');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).toContain('StatusBadge');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).toContain('DateTimeText');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).toContain('AdminTaskCard');
    expect(sectionSource).not.toContain('<div className="ops-task-grid"');
    expect(sectionSource).not.toContain('<div className="detail-grid admin-mt-16">');
    expect(sectionSource).not.toContain('className={`ops-task-card');
    expect(sectionSource).not.toContain('<span className={`pill ${pillClassForTone(card.tone)}`}>');
    expect(sectionSource).not.toContain('<span className="pill pill-info">{device.statusLabel}</span>');
    expect(sectionSource).not.toContain('<span className="pill pill-warn">SHARED</span>');
  });

  it('renders device, session, and shared-device activity as Vuexy tables', () => {
    const section = PartnerDetailDeviceSessionActivitySection({
      cardClassForTone: (tone) => `card-${tone}`,
      deviceRows: [
        {
          actionLabel: 'Device actions',
          actions: [
            {
              href: '#device-review',
              kind: 'link',
              label: 'Review device',
              tone: 'warning',
            },
          ],
          blockReason: 'Push token failed repeatedly.',
          blockedAt: '2026-06-20T03:00:00.000Z',
          detail: 'Android / partner app 1.2.3',
          id: 'device-1',
          lastSeenAt: '2026-06-20T04:00:00.000Z',
          smallLabel: 'Active',
          statusLabel: 'Blocked',
          title: 'Samsung S24',
        },
      ],
      followUpNeeded: true,
      pillClassForTone: (tone) => `pill-${tone}`,
      securityCards: [
        {
          action: 'Review blocked device',
          detail: 'Device should be checked before partner routing.',
          status: 'Needs review',
          title: 'Blocked device',
          tone: 'blocked',
        },
      ],
      sessionRows: [
        {
          detail: 'Logged in from partner app.',
          id: 'session-1',
          lastSeenAt: '2026-06-20T04:30:00.000Z',
          loggedInAt: '2026-06-20T02:30:00.000Z',
          sessionNote: 'Fresh login',
          smallLabel: 'sess-1',
          statusLabel: 'Active',
          title: 'Mobile session',
        },
      ],
      sharedDeviceRows: [
        {
          detail: 'Same device appears on another partner profile.',
          id: 'shared-1',
          lastSeenAt: '2026-06-20T05:00:00.000Z',
          smallLabel: 'match-1',
          title: 'Shared device match',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Device and session activity');
    expect(rendered).toContain('Follow-up needed');
    expect(rendered).toContain('Blocked device');
    expect(rendered).toContain('Partner app devices');
    expect(rendered).toContain('Status');
    expect(rendered).toContain('Device');
    expect(rendered).toContain('Activity');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('Samsung S24');
    expect(rendered).toContain('Block reason: Push token failed repeatedly.');
    expect(rendered).toContain('Android / partner app 1.2.3 / last seen 20 Jun 2026, 11:00');
    expect(rendered).toContain('20 Jun 2026, 10:00');
    expect(rendered).toContain('Review device');
    expect(rendered).toContain('Recent sessions');
    expect(rendered).toContain('Session');
    expect(rendered).toContain('Mobile session');
    expect(rendered).toContain('Session note: Fresh login');
    expect(rendered).toContain('Logged in from partner app. / last seen 20 Jun 2026, 11:30');
    expect(rendered).toContain('Shared device match');
    expect(rendered).toContain('Same device appears on another partner profile. / last seen 20 Jun 2026, 12:00');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#device-review']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
        'pill pill-info',
        'pill pill-warn',
        'action-menu',
      ]),
    );
  });

  it('renders empty tables when device and session rows are missing', () => {
    const section = PartnerDetailDeviceSessionActivitySection({
      cardClassForTone: (tone) => `card-${tone}`,
      deviceRows: [],
      followUpNeeded: false,
      pillClassForTone: (tone) => `pill-${tone}`,
      securityCards: [],
      sessionRows: [],
      sharedDeviceRows: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('No active follow-up');
    expect(rendered).toContain('No partner app device record yet. It should appear after partner app sign-in.');
    expect(rendered).toContain('No partner session log yet.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table admin-data-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(sectionSource).toContain('AdminEmptyState');
    expect(sectionSource).not.toContain('<div className="empty-state">');
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
