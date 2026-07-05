import { readFileSync } from 'node:fs';

import type { AdminProvider } from '../../lib/admin-api';
import { PartnerSecurityCell } from './partner-security-cell';

describe('PartnerSecurityCell', () => {
  it('uses the shared Vuexy badge atom for account security state', () => {
    const source = readFileSync('app/partners/partner-security-cell.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`pill ${partnerSecurityPillClass(status)}`}>');
    expect(source).not.toContain('formatDate(provider.blockedAt)');
    expect(source).not.toContain('formatDate(latestSession.lastSeenAt)');
  });

  it('renders account block, latest device, latest session, and issue counters', () => {
    const cell = PartnerSecurityCell({
      provider: {
        blockedAt: '2026-06-08T10:00:00.000Z',
        blockedReason: 'Safety hold',
        devices: [
          {
            blockedAt: '2026-06-08T09:00:00.000Z',
            deviceId: 'android-device-abcdef123456',
            id: 'device-1',
            platform: 'android',
          },
        ],
        id: 'partner-security',
        sessions: [
          {
            id: 'session-1',
            ipAddress: '203.0.113.9',
            lastSeenAt: '2026-06-08T08:30:00.000Z',
            suspicious: true,
          },
        ],
        sharedDeviceMatches: [
          {
            deviceId: 'android-device-abcdef123456',
            id: 'shared-1',
          },
        ],
      } as AdminProvider,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('Account blocked');
    expect(rendered).toContain('Last app device: androi...3456 / android');
    expect(rendered).toContain('Account block: Safety hold / 8 Jun 2026, 17:00');
    expect(rendered).toContain('Last session: 203.0.113.9 / 8 Jun 2026, 15:30');
    expect(rendered).toContain('1 blocked device(s)');
    expect(rendered).toContain('1 session check(s)');
    expect(rendered).toContain('1 shared device id(s)');
    expect(rendered).toContain('Review device/session');
    expect(hrefsIn(cell)).toEqual(expect.arrayContaining(['/partners/partner-security']));
    expect(classNamesIn(cell)).toEqual(
      expect.arrayContaining([
        'pill pill-danger',
        'admin-form-control-link button button-secondary admin-inline-action admin-mt-8',
      ]),
    );
  });

  it('renders a missing-device fallback for partners without app devices', () => {
    const cell = PartnerSecurityCell({
      provider: {
        id: 'partner-no-device',
      } as AdminProvider,
    });

    const rendered = normalizedText(cell);

    expect(rendered).toContain('No app device');
    expect(rendered).toContain('No partner app device recorded yet.');
    expect(hrefsIn(cell)).toEqual(expect.arrayContaining(['/partners/partner-no-device']));
    expect(classNamesIn(cell)).toEqual(expect.arrayContaining(['pill pill-neutral']));
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
