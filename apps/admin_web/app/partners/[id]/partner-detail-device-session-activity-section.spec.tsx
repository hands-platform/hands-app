import { PartnerDetailDeviceSessionActivitySection } from './partner-detail-device-session-activity-section';

describe('PartnerDetailDeviceSessionActivitySection', () => {
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
          detail: 'Android / last seen 20 Jun 2026, 10:00',
          id: 'device-1',
          smallLabel: 'dev-1',
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
    expect(rendered).toContain('Android / last seen 20 Jun 2026, 10:00');
    expect(rendered).toContain('Review device');
    expect(rendered).toContain('Recent sessions');
    expect(rendered).toContain('Session');
    expect(rendered).toContain('Mobile session');
    expect(rendered).toContain('Session note: Fresh login');
    expect(rendered).toContain('Shared device match');
    expect(rendered).toContain('Same device appears on another partner profile.');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['#device-review']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-table-scroll',
        'table vuexy-data-table',
        'pill pill-danger',
        'pill pill-blocked',
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
